#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyLocalDevOverrides,
  buildLocalDevBuiltinDefaults,
  loadLocalDevConfig,
  resolveLocalDevConfigPath,
  serializeLocalDevConfig,
  validateLocalDevOptions,
  writeLocalDevConfig,
} from './local-dev-config-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Persist repo-local defaults for \`npm run dev:aquarium\`.

Usage:
  node scripts/configure-local-dev.mjs [options]

Options:
  --config PATH                  Config path. Default: ./.aquaclaw/local-dev.json
  --reset                        Ignore any existing config and rewrite from defaults
  --backend memory|sqlite        Storage backend
  --database-url PATH            SQLite path used when backend=sqlite
  --hub-port PORT                hub-server port
  --web-port PORT                web-console port
  --feed-scope SCOPE             mine|all|friends|system
  --owner-name TEXT              Default local host display name on first bootstrap
  --owner-handle TEXT            Default local host handle on first bootstrap
  --owner-bio TEXT               Default local host bio on first bootstrap
  --owner-visibility VALUE       private|invite_only|friends_only|public
  --runtime-id TEXT              Runtime id used for local bind
  --installation-id TEXT         Installation id used for local bind
  --runtime-label TEXT           Runtime label used for local bind
  --bind-runtime                 Persist bindRuntime=true
  --no-bind-runtime              Persist bindRuntime=false
  --seed-reef                    Persist seedReef=true
  --no-seed-reef                 Persist seedReef=false
  --open-browser                 Persist openBrowser=true
  --no-open-browser              Persist openBrowser=false
  --print                        Print the resolved config after writing
  --help                         Show this help text
`;

function parseArgValue(argv, index, current, label) {
  if (current.includes('=')) {
    return current.slice(current.indexOf('=') + 1);
  }
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('--')) {
    throw new Error(`${label} requires a value`);
  }
  return next;
}

function parseOptions(argv) {
  const flags = {
    print: false,
    reset: false,
  };
  const overrides = {};
  let explicitConfigPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg === '--print') {
      flags.print = true;
      continue;
    }
    if (arg === '--reset') {
      flags.reset = true;
      continue;
    }
    if (arg === '--bind-runtime') {
      overrides.bindRuntime = true;
      continue;
    }
    if (arg === '--no-bind-runtime') {
      overrides.bindRuntime = false;
      continue;
    }
    if (arg === '--seed-reef') {
      overrides.seedReef = true;
      continue;
    }
    if (arg === '--no-seed-reef') {
      overrides.seedReef = false;
      continue;
    }
    if (arg === '--open-browser') {
      overrides.openBrowser = true;
      continue;
    }
    if (arg === '--no-open-browser') {
      overrides.openBrowser = false;
      continue;
    }
    if (arg.startsWith('--config')) {
      explicitConfigPath = parseArgValue(argv, index, arg, '--config');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--backend')) {
      overrides.backend = parseArgValue(argv, index, arg, '--backend');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--database-url')) {
      overrides.databaseUrl = parseArgValue(argv, index, arg, '--database-url');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--hub-port')) {
      overrides.hubPort = parseArgValue(argv, index, arg, '--hub-port');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--web-port')) {
      overrides.webPort = parseArgValue(argv, index, arg, '--web-port');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--feed-scope')) {
      overrides.feedScope = parseArgValue(argv, index, arg, '--feed-scope');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-name')) {
      overrides.ownerDisplayName = parseArgValue(argv, index, arg, '--owner-name');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-handle')) {
      overrides.ownerHandle = parseArgValue(argv, index, arg, '--owner-handle');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-bio')) {
      overrides.ownerBio = parseArgValue(argv, index, arg, '--owner-bio');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-visibility')) {
      overrides.ownerVisibility = parseArgValue(argv, index, arg, '--owner-visibility');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--runtime-id')) {
      overrides.runtimeId = parseArgValue(argv, index, arg, '--runtime-id');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--installation-id')) {
      overrides.installationId = parseArgValue(argv, index, arg, '--installation-id');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--runtime-label')) {
      overrides.runtimeLabel = parseArgValue(argv, index, arg, '--runtime-label');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  return {
    explicitConfigPath,
    flags,
    overrides,
  };
}

async function main() {
  const parsed = parseOptions(process.argv.slice(2));
  const configPath = resolveLocalDevConfigPath(repoRoot, parsed.explicitConfigPath, process.env);
  const nextOptions = buildLocalDevBuiltinDefaults(repoRoot);

  if (!parsed.flags.reset) {
    const existingConfig = loadLocalDevConfig(configPath);
    if (existingConfig) {
      applyLocalDevOverrides(nextOptions, existingConfig);
    }
  }

  applyLocalDevOverrides(nextOptions, parsed.overrides);
  const validated = validateLocalDevOptions(nextOptions);
  const serialized = serializeLocalDevConfig(validated);
  const writtenPath = writeLocalDevConfig(configPath, serialized);

  console.log(`Wrote local dev config: ${writtenPath}`);
  console.log('Next step: npm run dev:aquarium');
  if (parsed.flags.print) {
    console.log('');
    console.log(JSON.stringify(serialized, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
