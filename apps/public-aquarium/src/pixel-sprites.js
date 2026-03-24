import { STAGE_ART_MANIFEST, listStageArtSpecs } from './stage-art-manifest.js';

const SPRITES = {
  lobsterClassic: [
    '..aa....aa....',
    '.aaaa..aaaa...',
    '..aaccccccaa..',
    '.acbbbbbbbbca.',
    'acbbbbbbbbbbca',
    '.cbbbbebbbbbc.',
    'acbbbbbbbbbbca',
    '.acbbbbbbbbca.',
    '..acbbbbbbca..',
    '.aa.cccc.ccaa.',
    'a..a.cccc.a..a',
    '...c..cc..c...',
    '..c........c..',
  ],
  lobsterPincer: [
    'aa........aa..',
    '.aaa....aaaa..',
    '..aaccccccaa..',
    '.acbbbbbbbbca.',
    'acbbbbbbbbbbca',
    '.cbbbbebbbbbca',
    '..cbbbbbbbbbc.',
    '.acbbbbbbbbca.',
    '..acbbbbbbca..',
    '...ccccc.cc...',
    'aa..c.cc.c..aa',
    '.c....cc....c.',
    '..c........c..',
  ],
  lobsterRound: [
    '....aa..aa....',
    '..aaaaaaaaaa..',
    '...acccccca...',
    '..acbbbbbbca..',
    '.acbbbbbbbbca.',
    '.cbbbbebbbbbc.',
    '.acbbbbbbbbca.',
    '..acbbbbbbca..',
    '...acbbbbca...',
    '.aa..cccc..aa.',
    'a..a..cc..a..a',
    '..c....c....c.',
    '...c........c.',
  ],
  snail: [
    '....aaaa......',
    '..aacbbca.....',
    '.acbbbbbbca...',
    '.cbbbbbbbbca..',
    '..cbbbbbbbca..',
    '....cbbbbbbca.',
    '..acccccbbbca.',
    '.acbbbbbbbbbbb',
    '.cbbbb....eabc',
    '..cbbbbbbbbbbc',
    '....cc....cc..',
    '..............',
  ],
  scallop: [
    '......a.......',
    '....aaaaa.....',
    '..aacbbbca....',
    '.acbbbbbbbca..',
    'acbbbbbbbbbbca',
    '.cbbbbbbbbbbc.',
    '..cbbbcbbbcc..',
    '.acbbbbbbbbca.',
    '.cc..cc..cc...',
    '..c..cc..c....',
    '..............',
    '..............',
  ],
  conch: [
    '......a.......',
    '.....aaa......',
    '....aacbc.....',
    '...acbbbbc....',
    '..acbbbbbbca..',
    '..cbbbbbbbbca.',
    '...cbbbbbbbca.',
    '....cbbbbbbbbc',
    '....acbbbbbbca',
    '...acbbbbebca.',
    '.....cc..cc...',
    '......c..c....',
  ],
  krustyKrab: [
    '......aa......',
    '.....aaaa.....',
    '....aaccca....',
    '...acbbbbca...',
    '..acbbbbbbca..',
    '..cbeecceebc..',
    '.acbbbbbbbbca.',
    '.cbbcbbbbcbbc.',
    '.acbbaaaabbca.',
    'cbbbbbbbbbbbbc',
    '..cbb....bbc..',
    '..cbb....bbc..',
  ],
  shellbucks: [
    '......aa......',
    '.....aeea.....',
    '....acccca....',
    '...acbbbbca...',
    '..acbbbbbbca..',
    '..cbbbbbbbbc..',
    '.acbbceeeccca.',
    '.cbbbbbbbbbbc.',
    '..cbbbbbbbbc..',
    '..ccb....bcc..',
    '.ccb......bcc.',
    '..............',
  ],
};

const GATEWAY_VARIANTS = ['lobsterClassic', 'lobsterPincer', 'lobsterRound'];

const GATEWAY_PALETTES = [
  {
    name: 'coral',
    body: '#ef6f54',
    accent: '#ffd6a6',
    eye: '#fffdf2',
    shadow: '#9b4238',
  },
  {
    name: 'ember',
    body: '#ff8b3d',
    accent: '#ffe18e',
    eye: '#fff7ea',
    shadow: '#a94d1e',
  },
  {
    name: 'gold',
    body: '#f2bf3c',
    accent: '#fff1b1',
    eye: '#fff8ec',
    shadow: '#9f7620',
  },
  {
    name: 'mint',
    body: '#61cfa8',
    accent: '#c6fff1',
    eye: '#f7fffc',
    shadow: '#2f7f66',
  },
  {
    name: 'lagoon',
    body: '#4ca3d6',
    accent: '#c3ecff',
    eye: '#f3fbff',
    shadow: '#2a6285',
  },
  {
    name: 'rose',
    body: '#eb798d',
    accent: '#ffd8df',
    eye: '#fff8fb',
    shadow: '#91485a',
  },
];

const COMMUNITY_CAST = {
  xiaowo: {
    sprite: 'snail',
    palette: {
      body: '#f2b96b',
      accent: '#ffe1a4',
      eye: '#fff9ed',
      shadow: '#9b6d32',
    },
  },
  beibei: {
    sprite: 'scallop',
    palette: {
      body: '#ef8796',
      accent: '#ffd6bd',
      eye: '#fff8ef',
      shadow: '#934d67',
    },
  },
  qiaoqiao: {
    sprite: 'conch',
    palette: {
      body: '#71d6c7',
      accent: '#d7fff6',
      eye: '#f7fffd',
      shadow: '#2f7f77',
    },
  },
};

const VENUES = {
  'krusty-krab': {
    sprite: 'krustyKrab',
    palette: {
      body: '#9b6235',
      accent: '#f2bf64',
      eye: '#f8f0c6',
      shadow: '#573318',
    },
  },
  shellbucks: {
    sprite: 'shellbucks',
    palette: {
      body: '#337866',
      accent: '#79e3c8',
      eye: '#effff8',
      shadow: '#1b473d',
    },
  },
};

const CACHE = new Map();
const EXTERNAL_ASSET_STATUS = new Map();
let externalAssetProbePromise = null;

function paletteColorFor(token, palette) {
  switch (token) {
    case 'a':
      return palette.accent;
    case 'e':
      return palette.eye;
    case 'c':
    case 'd':
      return palette.shadow ?? palette.body;
    case 'b':
    default:
      return palette.body;
  }
}

function toDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderSvg(rows, palette) {
  const rects = [];
  const width = Math.max(...rows.map((row) => row.length), 1);
  const height = rows.length || 1;

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const token = row[x];
      if (token === '.' || token === ' ') {
        continue;
      }

      rects.push(
        `<rect x="${x}" y="${y}" width="1" height="1" fill="${paletteColorFor(token, palette)}" />`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">`,
    rects.join(''),
    '</svg>',
  ].join('');
}

function imageProbe(path) {
  if (typeof Image === 'undefined') {
    return Promise.resolve({ available: false, width: 0, height: 0 });
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        available: true,
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0,
      });
    };
    image.onerror = () => {
      resolve({ available: false, width: 0, height: 0 });
    };
    image.src = path;
  });
}

export function primeStageArtAssets() {
  if (externalAssetProbePromise) {
    return externalAssetProbePromise;
  }

  const specs = listStageArtSpecs();
  if (specs.length === 0) {
    externalAssetProbePromise = Promise.resolve(false);
    return externalAssetProbePromise;
  }

  externalAssetProbePromise = Promise.all(
    specs.map(async (spec) => {
      if (EXTERNAL_ASSET_STATUS.has(spec.path)) {
        return EXTERNAL_ASSET_STATUS.get(spec.path)?.available === true;
      }

      const result = await imageProbe(spec.path);
      EXTERNAL_ASSET_STATUS.set(spec.path, result);
      return result.available;
    }),
  ).then((results) => results.some(Boolean));

  return externalAssetProbePromise;
}

export function stableHash(value) {
  const text = String(value ?? 'sprite-seed');
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function spriteDescriptor(spriteName, palette, cacheKey) {
  const key = `${cacheKey}|${spriteName}|${palette.body}|${palette.accent}|${palette.eye}`;
  const cached = CACHE.get(key);
  if (cached) {
    return cached;
  }

  const rows = SPRITES[spriteName];
  const width = Math.max(...rows.map((row) => row.length), 1);
  const height = rows.length || 1;
  const descriptor = {
    spriteName,
    src: toDataUrl(renderSvg(rows, palette)),
    width,
    height,
  };

  CACHE.set(key, descriptor);
  return descriptor;
}

function externalSpriteDescriptor(spec, cacheKey) {
  const status = EXTERNAL_ASSET_STATUS.get(spec.path);
  if (!status?.available) {
    return null;
  }

  const width = spec.width || status.width || 1;
  const height = spec.height || status.height || 1;
  const key = `${cacheKey}|external|${spec.path}|${width}|${height}`;
  const cached = CACHE.get(key);
  if (cached) {
    return cached;
  }

  const descriptor = {
    spriteName: spec.id,
    src: spec.path,
    width,
    height,
    origin: 'external',
  };

  CACHE.set(key, descriptor);
  return descriptor;
}

function availableExternalSpecs(specs) {
  return specs.filter((spec) => EXTERNAL_ASSET_STATUS.get(spec.path)?.available);
}

function gatewaySeedSource(gateway) {
  return gateway?.id || gateway?.handle || gateway?.displayName || 'gateway';
}

export function getGatewaySprite(gateway) {
  const seedSource = gatewaySeedSource(gateway);
  const hash = stableHash(seedSource);
  const artVariants = availableExternalSpecs(STAGE_ART_MANIFEST.gateway.variants);
  if (artVariants.length > 0) {
    const artSpec = artVariants[hash % artVariants.length];
    const external = externalSpriteDescriptor(artSpec, `gateway-art:${seedSource}`);
    if (external) {
      return {
        ...external,
        flip: artSpec.canFlip === false ? 1 : hash % 2 === 0 ? 1 : -1,
        paletteName: 'external-art',
        origin: 'external',
      };
    }
  }

  const variant = GATEWAY_VARIANTS[hash % GATEWAY_VARIANTS.length];
  const palette = GATEWAY_PALETTES[Math.floor(hash / GATEWAY_VARIANTS.length) % GATEWAY_PALETTES.length];

  return {
    ...spriteDescriptor(variant, palette, `gateway:${seedSource}`),
    flip: hash % 2 === 0 ? 1 : -1,
    paletteName: palette.name,
    origin: 'generated',
  };
}

export function buildGatewaySpriteResolver(gateways = []) {
  const artVariants = availableExternalSpecs(STAGE_ART_MANIFEST.gateway.variants);
  if (artVariants.length === 0) {
    return (gateway) => getGatewaySprite(gateway);
  }

  const uniqueGateways = [];
  const seen = new Set();
  for (const gateway of gateways) {
    const seedSource = gatewaySeedSource(gateway);
    if (seen.has(seedSource)) {
      continue;
    }
    seen.add(seedSource);
    uniqueGateways.push(gateway);
  }

  uniqueGateways.sort((left, right) => {
    const leftSeed = gatewaySeedSource(left);
    const rightSeed = gatewaySeedSource(right);
    const hashGap = stableHash(leftSeed) - stableHash(rightSeed);
    if (hashGap !== 0) {
      return hashGap;
    }
    return leftSeed.localeCompare(rightSeed);
  });

  const rosterSeed = uniqueGateways.map((gateway) => gatewaySeedSource(gateway)).join('|');
  const startIndex = uniqueGateways.length > 0 ? stableHash(rosterSeed) % artVariants.length : 0;
  const assignments = new Map();
  uniqueGateways.forEach((gateway, index) => {
    assignments.set(gatewaySeedSource(gateway), artVariants[(startIndex + index) % artVariants.length]);
  });

  return (gateway) => {
    const seedSource = gatewaySeedSource(gateway);
    const hash = stableHash(seedSource);
    const artSpec = assignments.get(seedSource) ?? artVariants[hash % artVariants.length];
    const external = externalSpriteDescriptor(artSpec, `gateway-art:${seedSource}`);
    if (external) {
      return {
        ...external,
        flip: artSpec.canFlip === false ? 1 : hash % 2 === 0 ? 1 : -1,
        paletteName: 'external-art',
        origin: 'external',
      };
    }
    return getGatewaySprite(gateway);
  };
}

export function getCommunityCastSprite(id) {
  const artSpec = STAGE_ART_MANIFEST.cast[id];
  if (artSpec) {
    const external = externalSpriteDescriptor(artSpec, `cast-art:${id}`);
    if (external) {
      return {
        ...external,
        flip: artSpec.canFlip === false ? 1 : 1,
        origin: 'external',
      };
    }
  }

  const entry = COMMUNITY_CAST[id];
  if (!entry) {
    return {
      ...spriteDescriptor('snail', COMMUNITY_CAST.xiaowo.palette, `cast:fallback:${id}`),
      flip: 1,
      origin: 'generated',
    };
  }

  return {
    ...spriteDescriptor(entry.sprite, entry.palette, `cast:${id}`),
    flip: 1,
    origin: 'generated',
  };
}

export function getVenueSprite(id) {
  const artSpec = STAGE_ART_MANIFEST.venue[id];
  if (artSpec) {
    const external = externalSpriteDescriptor(artSpec, `venue-art:${id}`);
    if (external) {
      return {
        ...external,
        flip: artSpec.canFlip === false ? 1 : 1,
        origin: 'external',
      };
    }
  }

  const entry = VENUES[id];
  if (!entry) {
    return {
      ...spriteDescriptor('krustyKrab', VENUES['krusty-krab'].palette, `venue:fallback:${id}`),
      flip: 1,
      origin: 'generated',
    };
  }

  return {
    ...spriteDescriptor(entry.sprite, entry.palette, `venue:${id}`),
    flip: 1,
    origin: 'generated',
  };
}
