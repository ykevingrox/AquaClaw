import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';
import { DEFAULT_MAX_BUFFERED_DELIVERIES } from '../src/live-hub.js';
import { createGatewayStore } from '../src/store.js';

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

interface ReplayWindowData {
  retentionPolicy: 'count';
  maxBufferedDeliveries: number;
  retainedDeliveries: number;
  oldestAvailableCursor: string | null;
  latestAvailableCursor: string | null;
}

interface HelloEventData {
  connectedAt: string;
  cursor: string | null;
  replayedCount: number;
  replayWindow: ReplayWindowData;
  viewerGatewayId: string;
}

interface ResyncRequiredData {
  reason: 'cursor_outside_replay_window' | 'invalid_cursor';
  cursor: string;
  action: 'refetch_and_reconnect';
  replayWindow: ReplayWindowData;
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
    host: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function bootstrapHostedSession(app: App, bootstrapKey = 'hosted-secret') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey,
    },
  });
  assert.equal(response.statusCode, 201);
  return response.json().data as {
    host: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function setHostedRegistrationPolicy(app: App, token: string, policy: 'closed' | 'invite_only' | 'open') {
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/registration-policy',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      policy,
    },
  });
  assert.equal(response.statusCode, 200);
}

async function registerGateway(app: App, suffix: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: `Stream Gateway ${suffix}`,
      handle: `stream-gateway-${suffix}`,
    },
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

let currentSequence = 0;

async function writeCurrent(app: App, token: string) {
  currentSequence += 1;
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      key: `live-stream-current-${currentSequence}`,
      label: `Live Stream Current ${currentSequence}`,
      summary: `Live stream current ${currentSequence} keeps the aquarium moving.`,
      tone: 'playful',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  });
  assert.equal(response.statusCode, 201);
}

async function generateVentScene(app: App, token: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/scenes/generate',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      type: 'vent',
    },
  });
  assert.equal(response.statusCode, 201);
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

test('hosted participant gateway can subscribe to sea stream and receive visible system events', async () => {
  const app = buildApp({
    deploymentMode: 'hosted',
    hostedOwnerBootstrapKey: 'hosted-secret',
  });
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);
    const owner = await bootstrapHostedSession(app);
    await setHostedRegistrationPolicy(app, owner.credential.token, 'open');
    const participant = await registerGateway(app, 'hosted-stream');

    stream = await openSeaStream(baseUrl, participant.credential.token);

    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');
    const helloData = hello.data as HelloEventData;
    assert.equal(helloData.viewerGatewayId, participant.gateway.id);

    await writeCurrent(app, owner.credential.token);

    const currentEvent = await stream.nextEvent();
    assert.equal(currentEvent.event, 'sea.invalidate');
    assert.equal((currentEvent.data as { seaEvent: { type: string } }).seaEvent.type, 'current.changed');
    assert.equal((currentEvent.data as { seaEvent: { visibility: string } }).seaEvent.visibility, 'system');
  } finally {
    await closeSeaStream(stream);
    await app.close();
  }
});

test('sea stream replays missed deliveries when the cursor remains inside the replay window', async () => {
  const app = buildApp({
    seaLiveHub: {
      maxBufferedDeliveries: 3,
    },
  });
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);
    const owner = await bootstrapLocalSession(app);

    stream = await openSeaStream(baseUrl, owner.credential.token);

    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');
    const helloData = hello.data as HelloEventData;
    assert.equal(helloData.viewerGatewayId, `host-viewer:${owner.host.id}`);
    assert.equal(helloData.replayWindow.maxBufferedDeliveries, 3);

    await writeCurrent(app, owner.credential.token);

    const currentEvent = await stream.nextEvent();
    assert.equal(currentEvent.event, 'sea.invalidate');
    assert.equal((currentEvent.data as { seaEvent: { type: string } }).seaEvent.type, 'current.changed');
    const lastEventId = currentEvent.id;
    assert.ok(lastEventId);

    await closeSeaStream(stream);
    stream = null;

    await writeCurrent(app, owner.credential.token);
    await writeCurrent(app, owner.credential.token);

    stream = await openSeaStream(baseUrl, owner.credential.token, { lastEventId });

    const replayHello = await stream.nextEvent();
    assert.equal(replayHello.event, 'hello');
    const replayHelloData = replayHello.data as HelloEventData;
    assert.equal(replayHelloData.replayedCount, 2);
    assert.equal(replayHelloData.replayWindow.maxBufferedDeliveries, 3);
    assert.equal(replayHelloData.replayWindow.retainedDeliveries, 3);
    assert.ok(replayHelloData.cursor);

    const replayedEventOne = await stream.nextEvent();
    assert.equal(replayedEventOne.event, 'sea.invalidate');
    assert.equal((replayedEventOne.data as { seaEvent: { type: string } }).seaEvent.type, 'current.changed');

    const replayedEventTwo = await stream.nextEvent();
    assert.equal(replayedEventTwo.event, 'sea.invalidate');
    assert.equal((replayedEventTwo.data as { seaEvent: { type: string } }).seaEvent.type, 'current.changed');
    assert.notEqual(replayedEventOne.id, replayedEventTwo.id);
  } finally {
    await closeSeaStream(stream);
    await app.close();
  }
});

test('sea stream emits resync_required when the cursor falls outside the replay window', async () => {
  const app = buildApp({
    seaLiveHub: {
      maxBufferedDeliveries: 2,
    },
  });
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);
    const owner = await bootstrapLocalSession(app);

    stream = await openSeaStream(baseUrl, owner.credential.token);
    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');

    await writeCurrent(app, owner.credential.token);

    const currentEvent = await stream.nextEvent();
    assert.equal(currentEvent.event, 'sea.invalidate');
    const lastEventId = currentEvent.id;
    assert.ok(lastEventId);

    await closeSeaStream(stream);
    stream = null;

    await writeCurrent(app, owner.credential.token);
    await writeCurrent(app, owner.credential.token);

    stream = await openSeaStream(baseUrl, owner.credential.token, {
      lastEventId,
    });

    const replayHello = await stream.nextEvent();
    assert.equal(replayHello.event, 'hello');
    const replayHelloData = replayHello.data as HelloEventData;
    assert.equal(replayHelloData.replayedCount, 0);
    assert.equal(replayHelloData.replayWindow.maxBufferedDeliveries, 2);
    assert.equal(replayHelloData.replayWindow.retainedDeliveries, 2);

    const resync = await stream.nextEvent();
    assert.equal(resync.event, 'resync_required');
    const resyncData = resync.data as ResyncRequiredData;
    assert.equal(resyncData.reason, 'cursor_outside_replay_window');
    assert.equal(resyncData.cursor, lastEventId);
    assert.equal(resyncData.action, 'refetch_and_reconnect');
    assert.equal(resyncData.replayWindow.maxBufferedDeliveries, 2);
    assert.equal(resyncData.replayWindow.retainedDeliveries, 2);
    assert.ok(resyncData.replayWindow.oldestAvailableCursor);
    assert.ok(resyncData.replayWindow.latestAvailableCursor);
    assert.notEqual(
      resyncData.replayWindow.oldestAvailableCursor,
      resyncData.replayWindow.latestAvailableCursor,
    );
  } finally {
    await closeSeaStream(stream);
    await app.close();
  }
});

test('sea stream emits resync_required for malformed cursors', async () => {
  const store = createGatewayStore();
  const owner = store.register({
    displayName: 'Malformed Cursor Owner',
    handle: 'malformed-cursor-owner',
  });
  const app = buildApp({ store });
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);

    stream = await openSeaStream(baseUrl, owner.token, {
      lastEventId: 'not-a-sea-delivery-id',
    });

    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');
    const helloData = hello.data as HelloEventData;
    assert.equal(helloData.replayedCount, 0);
    assert.equal(helloData.replayWindow.maxBufferedDeliveries, DEFAULT_MAX_BUFFERED_DELIVERIES);
    assert.equal(helloData.replayWindow.retainedDeliveries, 0);

    const resync = await stream.nextEvent();
    assert.equal(resync.event, 'resync_required');
    const resyncData = resync.data as ResyncRequiredData;
    assert.equal(resyncData.reason, 'invalid_cursor');
    assert.equal(resyncData.cursor, 'not-a-sea-delivery-id');
    assert.equal(resyncData.action, 'refetch_and_reconnect');
    assert.equal(resyncData.replayWindow.maxBufferedDeliveries, DEFAULT_MAX_BUFFERED_DELIVERIES);
    assert.equal(resyncData.replayWindow.retainedDeliveries, 0);
    assert.equal(resyncData.replayWindow.oldestAvailableCursor, null);
    assert.equal(resyncData.replayWindow.latestAvailableCursor, null);
  } finally {
    await closeSeaStream(stream);
    await app.close();
  }
});

test('sea stream continues live delivery after resync_required on restart reconnect', async () => {
  const store = createGatewayStore();
  const app = buildApp({ store });
  let appClosed = false;
  let restartedApp: App | null = null;
  let stream: SeaStreamClient | null = null;

  try {
    const baseUrl = await listen(app);
    const owner = await bootstrapLocalSession(app);
    const participant = await registerGateway(app, 'restart');

    stream = await openSeaStream(baseUrl, owner.credential.token);
    const hello = await stream.nextEvent();
    assert.equal(hello.event, 'hello');

    await writeCurrent(app, owner.credential.token);

    const currentEvent = await stream.nextEvent();
    assert.equal(currentEvent.event, 'sea.invalidate');
    const lastEventId = currentEvent.id;
    assert.ok(lastEventId);

    await closeSeaStream(stream);
    stream = null;

    await app.close();
    appClosed = true;

    restartedApp = buildApp({ store });
    const restartedBaseUrl = await listen(restartedApp);

    stream = await openSeaStream(restartedBaseUrl, owner.credential.token, {
      lastEventId,
    });

    const replayHello = await stream.nextEvent();
    assert.equal(replayHello.event, 'hello');
    const replayHelloData = replayHello.data as HelloEventData;
    assert.equal(replayHelloData.replayedCount, 0);
    assert.equal(replayHelloData.replayWindow.retainedDeliveries, 0);
    assert.equal(replayHelloData.cursor, null);

    const resync = await stream.nextEvent();
    assert.equal(resync.event, 'resync_required');
    const resyncData = resync.data as ResyncRequiredData;
    assert.equal(resyncData.reason, 'cursor_outside_replay_window');
    assert.equal(resyncData.cursor, lastEventId);
    assert.equal(resyncData.replayWindow.retainedDeliveries, 0);

    await generateVentScene(restartedApp, participant.credential.token);

    const liveEvent = await stream.nextEvent();
    assert.equal(liveEvent.event, 'sea.invalidate');
    assert.equal((liveEvent.data as { seaEvent: { type: string } }).seaEvent.type, 'scene.vent_generated');
  } finally {
    await closeSeaStream(stream);
    if (!appClosed) {
      await app.close();
    }
    if (restartedApp) {
      await restartedApp.close();
    }
  }
});
