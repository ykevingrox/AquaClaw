import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(repoRoot, 'docs/archive/reviews/frontend-copy-bilingual-review.md');

const targets = [
  {
    slug: 'web-console',
    title: 'Web Console',
    sourcePath: resolve(repoRoot, 'apps/web-console/src/main.js'),
    roots: ['COPY', 'HOST_GUIDE_COPY', 'PARTICIPANT_GUIDE_COPY', 'FORM_HELP', 'HELPER_COPY'],
  },
  {
    slug: 'public-aquarium',
    title: 'Public Aquarium',
    sourcePath: resolve(repoRoot, 'apps/public-aquarium/src/main.js'),
    roots: ['COPY', 'OBSERVER_GUIDE_COPY'],
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractConstObject(sourceText, constName) {
  const pattern = new RegExp(`\\bconst\\s+${escapeRegExp(constName)}\\s*=`);
  const match = pattern.exec(sourceText);
  const anchor = match?.index ?? -1;
  if (anchor < 0) {
    throw new Error(`${constName} object not found`);
  }

  const start = sourceText.indexOf('{', anchor);
  if (start < 0) {
    throw new Error(`${constName} object start not found`);
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
    throw new Error(`${constName} object end not found`);
  }

  const objectSource = sourceText.slice(start, end + 1);
  return vm.runInNewContext(`(${objectSource})`, {}, { timeout: 1000 });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendPath(prefix, segment) {
  if (typeof segment === 'number') {
    return `${prefix}[${segment}]`;
  }
  return prefix ? `${prefix}.${segment}` : segment;
}

function flattenLocalizedPair(enNode, zhNode, prefix, rows = []) {
  if (typeof enNode === 'string' || typeof zhNode === 'string') {
    rows.push({
      key: prefix,
      en: typeof enNode === 'string' ? enNode : '',
      zh: typeof zhNode === 'string' ? zhNode : '',
    });
    return rows;
  }

  if (Array.isArray(enNode) || Array.isArray(zhNode)) {
    const maxLength = Math.max(Array.isArray(enNode) ? enNode.length : 0, Array.isArray(zhNode) ? zhNode.length : 0);

    for (let index = 0; index < maxLength; index += 1) {
      flattenLocalizedPair(
        Array.isArray(enNode) ? enNode[index] : undefined,
        Array.isArray(zhNode) ? zhNode[index] : undefined,
        appendPath(prefix, index),
        rows,
      );
    }

    return rows;
  }

  if (!isPlainObject(enNode) && !isPlainObject(zhNode)) {
    return rows;
  }

  const keys = new Set([
    ...Object.keys(isPlainObject(enNode) ? enNode : {}),
    ...Object.keys(isPlainObject(zhNode) ? zhNode : {}),
  ]);

  for (const key of keys) {
    const nextPrefix = appendPath(prefix, key);
    const enValue = enNode?.[key];
    const zhValue = zhNode?.[key];

    flattenLocalizedPair(enValue, zhValue, nextPrefix, rows);
  }

  return rows;
}

function collectLocalizedRows(node, prefix = '', rows = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      collectLocalizedRows(item, appendPath(prefix, index), rows);
    });
    return rows;
  }

  if (!isPlainObject(node)) {
    return rows;
  }

  const hasEn = Object.prototype.hasOwnProperty.call(node, 'en');
  const hasZh = Object.prototype.hasOwnProperty.call(node, 'zh');

  if (hasEn || hasZh) {
    flattenLocalizedPair(node.en, node.zh, prefix, rows);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'en' || key === 'zh') {
      continue;
    }
    collectLocalizedRows(value, appendPath(prefix, key), rows);
  }

  return rows;
}

function escapeInline(value) {
  return String(value).replaceAll('\n', ' ').trim();
}

function renderTargetSection(target) {
  const sourceText = readFileSync(target.sourcePath, 'utf8');
  const parts = [`## ${target.title}`, '', `Source: \`${target.sourcePath.replace(`${repoRoot}/`, '')}\``, ''];

  for (const rootName of target.roots) {
    const rootObject = extractConstObject(sourceText, rootName);
    const rows = collectLocalizedRows(rootObject, rootName).sort((left, right) => left.key.localeCompare(right.key));

    if (!rows.length) {
      continue;
    }

    parts.push(`### ${rootName}`, '');
    for (const row of rows) {
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
  'This file is an archived working review sheet for the current frontend copy.',
  'It lives under `docs/archive/reviews/` so it does not act as a release-facing operator doc.',
  'You can edit the `EN:` and/or `ZH:` lines directly, then ask Codex to read this file and sync the changes back into the source.',
  '',
  'Generated from:',
  ...targets.map((target) => `- \`${target.sourcePath.replace(`${repoRoot}/`, '')}\` (${target.roots.join(', ')})`),
  '',
  ...targets.map((target) => renderTargetSection(target)),
].join('\n');

writeFileSync(outputPath, markdown);
console.log(`frontend translations exported -> ${outputPath}`);
