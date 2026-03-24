const STAGE_LAYOUTS = {
  observer: {
    gatewayLanes: [
      { y: 30, start: 28, span: 44, baseScale: 3.9, generatedScale: 1, externalScale: 0.58, assetYOffset: 0, depth: 'far' },
      { y: 50, start: 22, span: 54, baseScale: 4.6, generatedScale: 1, externalScale: 0.56, assetYOffset: 0, depth: 'mid' },
      { y: 70, start: 24, span: 52, baseScale: 5.2, generatedScale: 1, externalScale: 0.54, assetYOffset: 0, depth: 'front' },
    ],
    cast: {
      xiaowo: { x: 74, y: 18, baseScale: 4.2, generatedScale: 1, externalScale: 0.56, assetYOffset: -1, depth: 'far', labelMode: 'always' },
      beibei: { x: 22, y: 69, baseScale: 4.8, generatedScale: 1, externalScale: 0.56, assetYOffset: 0, depth: 'front', labelMode: 'always' },
      qiaoqiao: { x: 80, y: 66, baseScale: 5, generatedScale: 1, externalScale: 0.56, assetYOffset: 0, depth: 'front', labelMode: 'always' },
    },
    venue: {
      'krusty-krab': { x: 12, y: 78, baseScale: 6.4, generatedScale: 1, externalScale: 0.42, assetYOffset: 0, depth: 'front', labelMode: 'peek' },
      shellbucks: { x: 87, y: 76, baseScale: 6.2, generatedScale: 1, externalScale: 0.42, assetYOffset: 0, depth: 'front', labelMode: 'peek' },
    },
  },
  stage: {
    gatewayLanes: [
      { y: 28, start: 30, span: 36, baseScale: 3.4, generatedScale: 1, externalScale: 0.56, assetYOffset: -1, depth: 'far' },
      { y: 42, start: 22, span: 54, baseScale: 4, generatedScale: 1, externalScale: 0.54, assetYOffset: 0, depth: 'mid' },
      { y: 57, start: 18, span: 60, baseScale: 4.7, generatedScale: 1, externalScale: 0.52, assetYOffset: 0, depth: 'mid' },
      { y: 71, start: 26, span: 44, baseScale: 5.2, generatedScale: 1, externalScale: 0.5, assetYOffset: 1, depth: 'front' },
    ],
    cast: {
      xiaowo: { x: 52, y: 20, baseScale: 4.4, generatedScale: 1, externalScale: 0.56, assetYOffset: -2, depth: 'far', labelMode: 'always' },
      beibei: { x: 16, y: 63, baseScale: 5, generatedScale: 1, externalScale: 0.54, assetYOffset: 0, depth: 'front', labelMode: 'always' },
      qiaoqiao: { x: 84, y: 60, baseScale: 5.1, generatedScale: 1, externalScale: 0.54, assetYOffset: 0, depth: 'front', labelMode: 'always' },
    },
    venue: {
      'krusty-krab': { x: 11, y: 79, baseScale: 7, generatedScale: 1, externalScale: 0.42, assetYOffset: 0, depth: 'front', labelMode: 'peek' },
      shellbucks: { x: 89, y: 77, baseScale: 6.8, generatedScale: 1, externalScale: 0.42, assetYOffset: 0, depth: 'front', labelMode: 'peek' },
    },
  },
};

function resolveLayout(layoutKey) {
  return STAGE_LAYOUTS[layoutKey] ?? STAGE_LAYOUTS.stage;
}

export function resolvePlacementScale(slot, sprite) {
  if (!slot) {
    return 1;
  }
  return slot.baseScale * (sprite?.origin === 'external' ? (slot.externalScale ?? 1) : (slot.generatedScale ?? 1));
}

export function buildGatewaySlots(layoutKey, gateways, hashFn) {
  const layout = resolveLayout(layoutKey);
  const lanes = layout.gatewayLanes.map(() => []);

  for (let index = 0; index < gateways.length; index += 1) {
    lanes[index % lanes.length].push(gateways[index]);
  }

  const slots = [];
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex];
    const config = layout.gatewayLanes[laneIndex];
    for (let index = 0; index < lane.length; index += 1) {
      const gateway = lane[index];
      const seed = hashFn(gateway.id || gateway.handle || gateway.displayName || `gateway:${index}`);
      slots.push({
        gateway,
        x: config.start + ((index + 1) * config.span) / (lane.length + 1) + ((seed % 7) - 3),
        y: config.y + (((seed >> 4) % 7) - 3),
        bobDuration: 6.8 + ((seed >> 12) % 5) * 0.7,
        bobDelay: -(((seed >> 15) % 12) / 2),
        slot: config,
      });
    }
  }

  return slots;
}

export function getCommunityCastSlot(layoutKey, id) {
  return resolveLayout(layoutKey).cast[id] ?? null;
}

export function getVenueSlot(layoutKey, id) {
  return resolveLayout(layoutKey).venue[id] ?? null;
}
