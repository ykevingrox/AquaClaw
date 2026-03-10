import { buildApp } from './app.js';
import { loadRuntimeConfig } from './config.js';
import { createGatewayStore } from './store.js';

const config = loadRuntimeConfig();
const app = buildApp({
  store: createGatewayStore({ backend: config.storeBackend, databaseUrl: config.databaseUrl }),
  deploymentMode: config.deploymentMode,
});

async function start() {
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      { storeBackend: config.storeBackend, deploymentMode: config.deploymentMode },
      `hub-server listening on http://${config.host}:${config.port}`,
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
