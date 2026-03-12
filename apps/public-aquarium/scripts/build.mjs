import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(scriptDir, '..');
const srcDir = join(workspaceDir, 'src');
const distDir = join(workspaceDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
  cpSync(join(srcDir, entry.name), join(distDir, entry.name), { recursive: true });
}

console.log(`public-aquarium build_ok source=${srcDir} dist=${distDir}`);
