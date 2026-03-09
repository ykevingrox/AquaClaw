import Fastify from 'fastify';
import { createGatewayStore, type GatewayVisibility, type InMemoryGatewayStore } from './store.js';

interface BuildAppOptions {
  store?: InMemoryGatewayStore;
}

interface RegisterBody {
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface UpdateMeBody {
  displayName?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

function extractBearerToken(value: string | undefined) {
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function getAuthedGateway(store: InMemoryGatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      error: {
        code: 'unauthorized',
        message: 'missing or invalid bearer token',
      },
    } as const;
  }

  const gateway = store.findByToken(token);
  if (!gateway) {
    return {
      error: {
        code: 'unauthorized',
        message: 'invalid bearer token',
      },
    } as const;
  }

  return { gateway } as const;
}

function getOptionalAuthedGateway(store: InMemoryGatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return null;
  }
  return store.findByToken(token);
}

export function buildApp(options: BuildAppOptions = {}) {
  const store = options.store ?? createGatewayStore();
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true, data: { status: 'ok' } }));

  app.post<{ Body: RegisterBody }>('/api/v1/gateways/register', async (request, reply) => {
    const { displayName, handle, bio, visibility } = request.body ?? {};

    if (!displayName?.trim() || !handle?.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName and handle are required',
        },
      });
    }

    try {
      const { gateway, token } = store.register({ displayName, handle, bio, visibility });
      return reply.code(201).send({
        ok: true,
        data: {
          gateway: {
            id: gateway.id,
            displayName: gateway.displayName,
            handle: gateway.handle,
            bio: gateway.bio,
            visibility: gateway.visibility,
            createdAt: gateway.createdAt,
          },
          credential: {
            token,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to register gateway';
      const statusCode = message === 'handle already exists' ? 409 : 400;
      return reply.code(statusCode).send({
        ok: false,
        error: {
          code: statusCode === 409 ? 'handle_conflict' : 'validation_failed',
          message,
        },
      });
    }
  });

  app.get('/api/v1/gateways/me', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    return {
      ok: true,
      data: {
        gateway: result.gateway,
      },
    };
  });

  app.get<{ Params: { gatewayId: string } }>('/api/v1/gateways/:gatewayId', async (request, reply) => {
    const gateway = store.findById(request.params.gatewayId);
    if (!gateway) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'not_found',
          message: 'gateway not found',
        },
      });
    }

    const viewer = getOptionalAuthedGateway(store, request.headers.authorization);
    const isSelf = viewer?.id === gateway.id;
    const canView = gateway.visibility === 'public' || isSelf;

    if (!canView) {
      return reply.code(403).send({
        ok: false,
        error: {
          code: 'forbidden',
          message: 'gateway is not visible to the current viewer',
        },
      });
    }

    return {
      ok: true,
      data: {
        gateway,
      },
    };
  });

  app.patch<{ Body: UpdateMeBody }>('/api/v1/gateways/me', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const gateway = store.updateProfile(result.gateway.id, request.body ?? {});
      return {
        ok: true,
        data: {
          gateway,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to update gateway profile';
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message,
        },
      });
    }
  });

  return app;
}
