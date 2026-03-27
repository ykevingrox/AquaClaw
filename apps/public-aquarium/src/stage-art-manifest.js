// Asset handoff contract for user-supplied pixel art.
// Drop transparent PNGs into `apps/public-aquarium/src/assets/stage/` using the paths below.
// If a file is missing, the public aquarium falls back to generated pixel sprites automatically.

const BASE_DIR = './assets/stage';
const GATEWAY_VARIANT_COUNT = 25;

function buildGatewayVariantSpecs(count) {
  return Array.from({ length: count }, (_, index) => {
    const slot = String(index + 1).padStart(2, '0');
    return {
      id: `gateway-${slot}`,
      path: `${BASE_DIR}/gateway-${slot}.png`,
      width: 24,
      height: 24,
      canFlip: true,
    };
  });
}

export const STAGE_ART_MANIFEST = {
  gateway: {
    notes: 'Provide 1-25 lobster variants. Transparent PNG, no anti-aliasing, recommended canvas 24x24.',
    variants: buildGatewayVariantSpecs(GATEWAY_VARIANT_COUNT),
  },
  cast: {
    xiaowo: {
      id: 'xiaowo',
      path: `${BASE_DIR}/xiaowo.png`,
      width: 24,
      height: 24,
      canFlip: false,
      notes: 'Transparent PNG, recommended canvas 24x24.',
    },
    beibei: {
      id: 'beibei',
      path: `${BASE_DIR}/beibei.png`,
      width: 24,
      height: 24,
      canFlip: false,
      notes: 'Transparent PNG, recommended canvas 24x24.',
    },
    qiaoqiao: {
      id: 'qiaoqiao',
      path: `${BASE_DIR}/qiaoqiao.png`,
      width: 24,
      height: 24,
      canFlip: false,
      notes: 'Transparent PNG, recommended canvas 24x24.',
    },
  },
  venue: {
    'krusty-krab': {
      id: 'krusty-krab',
      path: `${BASE_DIR}/krusty-krab.png`,
      width: 40,
      height: 28,
      canFlip: false,
      notes: 'Transparent PNG, recommended canvas 40x28.',
    },
    shellbucks: {
      id: 'shellbucks',
      path: `${BASE_DIR}/shellbucks.png`,
      width: 40,
      height: 28,
      canFlip: false,
      notes: 'Transparent PNG, recommended canvas 40x28.',
    },
  },
};

export function listStageArtSpecs() {
  return [
    ...STAGE_ART_MANIFEST.gateway.variants,
    ...Object.values(STAGE_ART_MANIFEST.cast),
    ...Object.values(STAGE_ART_MANIFEST.venue),
  ];
}
