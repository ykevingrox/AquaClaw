import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';

type App = ReturnType<typeof buildApp>;

interface StreamEvent {
  event: string;
  id: string | null;
  data: unknown;
}

interface SeaStreamClient {
  nextEvent(timeoutMs?: number): Promise<StreamEvent>;
  close(): void;
}

async function closeSeaStream(stream: SeaStreamClient | null) {
  if (!stream) {
    return;
  }
  stream.close();
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
}

async function bootstrapLocalSession(app: App) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
  });
  assert.equal(response.statusCode, 201);
  return response.json().data as {
    gateway: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function registerGateway(app: App, input: { displayName: string; handle: string }) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: input,
  });
  assert.equal(response.statusCode, 201);
  return response.json().data as {
    gateway: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function listen(app: App) {
  return app.listen({
    host: '127.0.0.1',
    port: 0,
  });
}

function parseSseChunk(chunk: string): StreamEvent | null {
  const lines = chunk.split('\n');
  let event = 'message';
  let id: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trimStart() : '';

    if (field === 'event') {
      event = rawValue;
    } else if (field === 'id') {
      id = rawValue;
    } else if (field === 'data') {
      dataLines.push(rawValue);
    }
  }

  if (!dataLines.length && event === 'message' && id === null) {
    return null;
  }

  return {
    event,
    id,
    data: dataLines.length ? JSON.parse(dataLines.join('\n')) : null,
  };
}

async function openSeaStream(baseUrl: string, token: string, options: { lastEventId?: string } = {}): Promise<SeaStreamClient> {
  const controller = new AbortController();
  const headers = new Headers({
    accept: 'text/event-stream',
    authorization: `Bearer ${token}`,
  });

  if (options.lastEventId) {
    headers.set('last-event-id', options.lastEventId);
  }

  const response = await fetch(`${baseUrl}/api/v1/stream/sea`, {
    headers,
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue: StreamEvent[] = [];
  const waiters: Array<{ resolve: (event: StreamEvent) => void; reject: (error: Error) => void }> = [];
  let buffer = '';
  let streamError: Error | null = null;
  let streamClosed = false;

  const flushChunk = (rawChunk: string) => {
    const event = parseSseChunk(rawChunk);
    if (!event) {
      return;
    }
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve(event);
      return;
    }
    queue.push(event);
  };

  const failPending = (error: Error) => {
    streamError = error;
    for (const waiter of waiters.splice(0)) {
      waiter.reject(error);
    }
  };

  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamClosed = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let delimiterIndex = buffer.indexOf('\n\n');
        while (delimiterIndex >= 0) {
          const chunk = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + 2);
          flushChunk(chunk);
          delimiterIndex = buffer.indexOf('\n\n');
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        flushChunk(buffer.trim());
      }
      failPending(new Error('stream closed'));
    } catch (error) {
      if (controller.signal.aborted) {
        failPending(new Error('stream closed'));
        return;
      }
      failPending(error instanceof Error ? error : new Error('stream read failed'));
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    nextEvent(timeoutMs = 5_000) {
      if (queue.length > 0) {
        return Promise.resolve(queue.shift()!);
      }
      if (streamError) {
        return Promise.reject(streamError);
      }
      if (streamClosed) {
        return Promise.reject(new Error('stream closed'));
      }

      return new Promise<StreamEvent>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const waiterIndex = waiters.findIndex((candidate) => candidate === waiter);
          if (waiterIndex >= 0) {
            waiters.splice(waiterIndex, 1);
          }
          reject(new Error(`timed out waiting for stream event after ${timeoutMs}ms`));
        }, timeoutMs);

        const waiter = {
          resolve: (event: StreamEvent) => {
            clearTimeout(timeout);
            resolve(event);
          },
          reject: (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          },
        };
        waiters.push(waiter);
      });
    },
    close() {
      controller.abort();
    },
  };
}

test('sea stream requires authentication', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/stream/sea',
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');

  await app.close();
});

test('sea stream delivers current and scene updates and replays missed deliveries on reconnect', async (t) => {
  const app = buildApp();
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);
    const owner = await bootstrapLocalSession(app);

    stream = await openSeaStream(baseUrl, owner.credential.token);

    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');
    assert.equal((hello.data as { viewerGatewayId: string }).viewerGatewayId, owner.gateway.id);

    const currentWrite = await app.inject({
      method: 'POST',
      url: '/api/v1/currents',
      headers: {
        authorization: `Bearer ${owner.credential.token}`,
      },
      payload: {
        key: 'live-stream-current',
        label: 'Live Stream Current',
        summary: 'A live stream current rolls across the aquarium glass.',
        tone: 'playful',
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    });
    assert.equal(currentWrite.statusCode, 201);

    const currentEvent = await stream.nextEvent();
    assert.equal(currentEvent.event, 'sea.invalidate');
    assert.equal((currentEvent.data as { seaEvent: { type: string } }).seaEvent.type, 'current.changed');
    const lastEventId = currentEvent.id;
    assert.ok(lastEventId);

    await closeSeaStream(stream);
    stream = null;

    const generatedScene = await app.inject({
      method: 'POST',
      url: '/api/v1/scenes/generate',
      headers: {
        authorization: `Bearer ${owner.credential.token}`,
      },
      payload: {
        type: 'vent',
      },
    });
    assert.equal(generatedScene.statusCode, 201);

    stream = await openSeaStream(baseUrl, owner.credential.token, { lastEventId });

    const replayHello = await stream.nextEvent();
    assert.equal(replayHello.event, 'hello');
    assert.equal((replayHello.data as { replayedCount: number }).replayedCount >= 1, true);

    const replayedEvent = await stream.nextEvent();
    assert.equal(replayedEvent.event, 'sea.invalidate');
    assert.equal((replayedEvent.data as { seaEvent: { type: string } }).seaEvent.type, 'scene.vent_generated');
  } finally {
    await closeSeaStream(stream);
    await app.close();
  }
});

test('sea stream emits resync_required for stale cursors and delivers message events to permitted viewers', async (t) => {
  const app = buildApp();
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);

    const alpha = await registerGateway(app, {
      displayName: 'Alpha Stream',
      handle: 'alpha-stream',
    });
    const beta = await registerGateway(app, {
      displayName: 'Beta Stream',
      handle: 'beta-stream',
    });

    const friendRequest = await app.inject({
      method: 'POST',
      url: '/api/v1/friend-requests',
      headers: {
        authorization: `Bearer ${alpha.credential.token}`,
      },
      payload: {
        toGatewayId: beta.gateway.id,
      },
    });
    assert.equal(friendRequest.statusCode, 201);
    const requestId = friendRequest.json().data.request.id as string;

    const accept = await app.inject({
      method: 'POST',
      url: `/api/v1/friend-requests/${requestId}/accept`,
      headers: {
        authorization: `Bearer ${beta.credential.token}`,
      },
    });
    assert.equal(accept.statusCode, 200);
    const conversationId = accept.json().data.conversation.id as string;

    stream = await openSeaStream(baseUrl, beta.credential.token, {
      lastEventId: 'missing-delivery-id',
    });

    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');

    const resync = await stream.nextEvent();
    assert.equal(resync.event, 'resync_required');
    assert.equal((resync.data as { reason: string }).reason, 'cursor_not_available');

    const send = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: {
        authorization: `Bearer ${alpha.credential.token}`,
      },
      payload: {
        body: 'live delivery should reach beta',
      },
    });
    assert.equal(send.statusCode, 201);

    const messageEvent = await stream.nextEvent();
    assert.equal(messageEvent.event, 'sea.invalidate');
    assert.equal((messageEvent.data as { seaEvent: { type: string } }).seaEvent.type, 'conversation.message_sent');
    assert.equal((messageEvent.data as { activityGatewayIds: string[] }).activityGatewayIds.includes(beta.gateway.id), true);
  } finally {
    await closeSeaStream(stream);
    await app.close();
  }
});
