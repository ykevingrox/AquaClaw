import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(repoRoot, 'docs/product/frontend-copy-bilingual-review.md');

const targets = [
  {
    slug: 'web-console',
    title: 'Web Console',
    sourcePath: resolve(repoRoot, 'apps/web-console/src/main.js'),
  },
  {
    slug: 'public-aquarium',
    title: 'Public Aquarium',
    sourcePath: resolve(repoRoot, 'apps/public-aquarium/src/main.js'),
  },
];

function extractCopyObject(sourceText) {
  const anchor = sourceText.indexOf('const COPY =');
  if (anchor < 0) {
    throw new Error('COPY object not found');
  }

  const start = sourceText.indexOf('{', anchor);
  if (start < 0) {
    throw new Error('COPY object start not found');
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let end = -1;

  for (let index = start; index < sourceText.length; index += 1) {
    const char = sourceText[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error('COPY object end not found');
  }

  const objectSource = sourceText.slice(start, end + 1);
  return vm.runInNewContext(`(${objectSource})`, {}, { timeout: 1000 });
}

function flattenTranslations(enNode, zhNode, prefix = '', rows = []) {
  const keys = Object.keys(enNode ?? {});

  for (const key of keys) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    const enValue = enNode?.[key];
    const zhValue = zhNode?.[key];

    if (typeof enValue === 'string' || typeof zhValue === 'string') {
      rows.push({
        key: nextPrefix,
        en: typeof enValue === 'string' ? enValue : '',
        zh: typeof zhValue === 'string' ? zhValue : '',
      });
      continue;
    }

    if (enValue && typeof enValue === 'object' && !Array.isArray(enValue)) {
      flattenTranslations(enValue, zhValue, nextPrefix, rows);
    }
  }

  return rows;
}

function escapeInline(value) {
  return String(value).replaceAll('\n', ' ').trim();
}

function renderTargetSection(target) {
  const sourceText = readFileSync(target.sourcePath, 'utf8');
  const copy = extractCopyObject(sourceText);
  const rows = flattenTranslations(copy.en, copy.zh);
  const grouped = new Map();

  for (const row of rows) {
    const bucket = row.key.split('.')[0] ?? 'misc';
    if (!grouped.has(bucket)) {
      grouped.set(bucket, []);
    }
    grouped.get(bucket).push(row);
  }

  const parts = [`## ${target.title}`, '', `Source: \`${target.sourcePath.replace(`${repoRoot}/`, '')}\``, ''];

  for (const [bucket, bucketRows] of grouped.entries()) {
    parts.push(`### ${bucket}`, '');
    for (const row of bucketRows) {
      parts.push(`#### \`${row.key}\``);
      parts.push(`- EN: ${escapeInline(row.en)}`);
      parts.push(`- ZH: ${escapeInline(row.zh)}`);
      parts.push('');
    }
  }

  return parts.join('\n');
}

const markdown = [
  '# Frontend Copy Bilingual Review',
  '',
  'This file is a working review sheet for the current frontend copy.',
  'You can edit the `ZH:` lines directly, then ask Codex to read this file and sync the changes back into the source.',
  '',
  'Generated from:',
  ...targets.map((target) => `- \`${target.sourcePath.replace(`${repoRoot}/`, '')}\``),
  '',
  ...targets.map((target) => renderTargetSection(target)),
].join('\n');

writeFileSync(outputPath, markdown);
console.log(`frontend translations exported -> ${outputPath}`);
