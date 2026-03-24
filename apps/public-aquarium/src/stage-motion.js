import { stableHash } from './pixel-sprites.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function parseNumeric(value) {
  const numeric = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeVector(dx, dy) {
  const distance = Math.hypot(dx, dy);
  if (!distance) {
    return { dx: 0, dy: 0, distance: 0, x: 0, y: 0 };
  }
  return { dx, dy, distance, x: dx / distance, y: dy / distance };
}

function roleForNode(node) {
  if (!node) {
    return 'gateway';
  }
  if (node.classList.contains('pixel-venue')) {
    return 'venue';
  }
  return node.dataset.role === 'cast' ? 'cast' : 'gateway';
}

function movementEnvelope(stageKind, role) {
  const base = {
    stage: {
      gateway: { x: 14, y: 5, bob: 5.4, duration: 18 },
      cast: { x: 10, y: 4, bob: 4.2, duration: 20 },
      venue: { x: 4, y: 2, bob: 1.4, duration: 24 },
    },
    observer: {
      gateway: { x: 9, y: 3.5, bob: 3.8, duration: 16 },
      cast: { x: 7, y: 3, bob: 3.2, duration: 18 },
      venue: { x: 2.8, y: 1.5, bob: 1, duration: 22 },
    },
  };

  return (base[stageKind] ?? base.stage)[role] ?? base.stage.gateway;
}

function environmentEnvelope(viewport) {
  const surfaceState = viewport.dataset.surfaceState ?? 'glassy';
  const tideDirection = viewport.dataset.tideDirection ?? 'slack';
  let flowRate = 1;
  let swayRate = 1;
  let swayAngle = 1;
  let driftOpacity = 0.42;
  let waterlineRange = 5;

  switch (surfaceState) {
    case 'surging':
      flowRate = 1.28;
      swayRate = 1.18;
      swayAngle = 1.3;
      driftOpacity = 0.58;
      waterlineRange = 10;
      break;
    case 'choppy':
      flowRate = 1.16;
      swayRate = 1.1;
      swayAngle = 1.16;
      driftOpacity = 0.5;
      waterlineRange = 8;
      break;
    case 'rippled':
      flowRate = 1.06;
      swayRate = 1.04;
      swayAngle = 1.06;
      driftOpacity = 0.46;
      waterlineRange = 6;
      break;
    default:
      break;
  }

  let tideBias = 0;
  switch (tideDirection) {
    case 'incoming':
      tideBias = 1;
      break;
    case 'outgoing':
      tideBias = -1;
      break;
    case 'crosswind':
      tideBias = 0.45;
      flowRate += 0.08;
      waterlineRange += 2;
      break;
    default:
      break;
  }

  return { driftOpacity, flowRate, swayAngle, swayRate, tideBias, waterlineRange };
}

function motionPointsFor(key, role, stageKind) {
  const envelope = movementEnvelope(stageKind, role);
  const pointCount = role === 'venue' ? 3 : 4;
  return Array.from({ length: pointCount }, (_, index) => {
    const seed = stableHash(`${key}:motion:${index}`);
    const angle = (index / pointCount) * Math.PI * 2 + (((seed >> 7) % 120) - 60) * (Math.PI / 540);
    const xRadius = envelope.x * (0.45 + ((seed >> 2) % 45) / 100);
    const yRadius = envelope.y * (0.4 + ((seed >> 11) % 45) / 100);
    return {
      x: Math.cos(angle) * xRadius,
      y: Math.sin(angle) * yRadius,
    };
  });
}

function pathMotion(nowMs, key, role, stageKind) {
  const envelope = movementEnvelope(stageKind, role);
  const points = motionPointsFor(key, role, stageKind);
  const seed = stableHash(`${key}:timeline`);
  const elapsed = nowMs / 1000;
  const phase = (seed % 1000) / 1000;
  const raw = ((elapsed / envelope.duration) + phase) * points.length;
  const index = Math.floor(raw) % points.length;
  const nextIndex = (index + 1) % points.length;
  const cycleProgress = raw - Math.floor(raw);
  const holdWindow = role === 'venue' ? 0.44 : 0.28;
  const progress = cycleProgress < holdWindow ? 0 : smoothStep((cycleProgress - holdWindow) / (1 - holdWindow));
  const current = points[index];
  const next = points[nextIndex];
  return {
    dx: next.x - current.x,
    dy: next.y - current.y,
    x: lerp(current.x, next.x, progress),
    y: lerp(current.y, next.y, progress),
  };
}

function updateSpriteFacing(node, face, tilt) {
  for (const sprite of node.querySelectorAll('.pixel-sprite-frame, .pixel-venue-sprite')) {
    const baseFlip = Number(sprite.dataset.baseFlip ?? 1) || 1;
    const composedFlip = sprite.classList.contains('pixel-venue-sprite') ? baseFlip : baseFlip * face;
    sprite.style.setProperty('--composed-flip', String(composedFlip));
    sprite.style.setProperty('--motion-tilt', `${tilt.toFixed(2)}deg`);
  }
}

function nodePoint(node) {
  return {
    x: parseNumeric(node?.dataset.stageX),
    y: parseNumeric(node?.dataset.stageY),
  };
}

function resolveActivityCue(viewport, nodesByKey) {
  const sourceKey = viewport.dataset.activityFocusKey ?? '';
  const venueKey = viewport.dataset.activityVenueKey ?? '';
  const sourceNode = nodesByKey.get(sourceKey) ?? null;
  const venueNode = nodesByKey.get(venueKey) ?? null;
  return {
    kind: viewport.dataset.activityKind ?? 'idle',
    sourceKey,
    sourceNode,
    sourcePoint: sourceNode ? nodePoint(sourceNode) : null,
    venueKey,
    venueNode,
    venuePoint: venueNode ? nodePoint(venueNode) : null,
  };
}

function directorMotion(node, cue, eventPulse) {
  if (!cue || cue.kind === 'idle' || eventPulse <= 0) {
    return { x: 0, y: 0, faceHint: 0 };
  }

  const role = roleForNode(node);
  const point = nodePoint(node);
  const centerBias = normalizeVector(50 - point.x, 54 - point.y);

  switch (cue.kind) {
    case 'speech':
    case 'motion':
    case 'arrival':
    case 'profile': {
      if (cue.sourceNode === node) {
        return {
          x: (centerBias.x * 4.8 + 0.4) * eventPulse,
          y: (centerBias.y * 1.8 - 5.4) * eventPulse,
          faceHint: centerBias.x,
        };
      }
      if (!cue.sourcePoint || role === 'venue') {
        return { x: 0, y: 0, faceHint: 0 };
      }
      const toSource = normalizeVector(cue.sourcePoint.x - point.x, cue.sourcePoint.y - point.y);
      const proximity = clamp(1 - (toSource.distance / 44), 0, 1);
      return {
        x: (-toSource.x * 2.6 + centerBias.x * 0.6) * proximity * eventPulse,
        y: (-0.9 - Math.abs(toSource.y) * 0.7) * proximity * eventPulse,
        faceHint: toSource.x,
      };
    }
    case 'recharge': {
      if (cue.sourceNode === node && cue.venuePoint) {
        const toVenue = normalizeVector(cue.venuePoint.x - point.x, cue.venuePoint.y - point.y);
        return {
          x: toVenue.x * 7.2 * eventPulse,
          y: (toVenue.y * 2.6 - 2.6) * eventPulse,
          faceHint: toVenue.x,
        };
      }
      if (cue.venueNode === node) {
        return {
          x: 0,
          y: -3.4 * eventPulse,
          faceHint: cue.sourcePoint ? normalizeVector(cue.sourcePoint.x - point.x, cue.sourcePoint.y - point.y).x : 0,
        };
      }
      if (!cue.venuePoint || role === 'venue') {
        return { x: 0, y: 0, faceHint: 0 };
      }
      const toVenue = normalizeVector(cue.venuePoint.x - point.x, cue.venuePoint.y - point.y);
      const proximity = clamp(1 - (toVenue.distance / 52), 0, 1);
      return {
        x: toVenue.x * 1.8 * proximity * eventPulse,
        y: (-0.7 + toVenue.y * 0.5) * proximity * eventPulse,
        faceHint: toVenue.x,
      };
    }
    case 'current':
    case 'water': {
      if (cue.sourceNode === node) {
        return {
          x: centerBias.x * 2.4 * eventPulse,
          y: (-4.8 + centerBias.y * 1.2) * eventPulse,
          faceHint: centerBias.x,
        };
      }
      if (!cue.sourcePoint || role === 'venue') {
        return { x: 0, y: 0, faceHint: 0 };
      }
      const toSource = normalizeVector(cue.sourcePoint.x - point.x, cue.sourcePoint.y - point.y);
      return {
        x: toSource.x * 0.9 * eventPulse,
        y: -0.4 * eventPulse,
        faceHint: toSource.x,
      };
    }
    default:
      return { x: 0, y: 0, faceHint: 0 };
  }
}

export function createStageMotionController({ stageKind, stageRoot, viewport }) {
  const state = {
    activitySignature: '',
    facingByKey: new Map(),
    pulseStartedAt: 0,
    rafId: 0,
  };

  function syncActivity(signature) {
    if (!signature || signature === state.activitySignature) {
      return;
    }
    state.activitySignature = signature;
    state.pulseStartedAt = performance.now();
  }

  function applyViewportEnvelope(nowMs) {
    if (!viewport) {
      return;
    }
    const env = environmentEnvelope(viewport);
    const activityEnergy = viewport.dataset.activityEnergy ?? 'steady';
    const activityBoost = activityEnergy === 'high' ? 1.16 : activityEnergy === 'medium' ? 1.08 : 1;
    const phase = nowMs / 1000;
    const waterlineShift = Math.sin(phase / 4.5) * env.waterlineRange + env.tideBias * 4;
    viewport.style.setProperty('--stream-rate', String(env.flowRate * activityBoost));
    viewport.style.setProperty('--kelp-rate', String(env.swayRate));
    viewport.style.setProperty('--kelp-angle', String(env.swayAngle));
    viewport.style.setProperty('--drift-opacity', String(env.driftOpacity));
    viewport.style.setProperty('--waterline-shift', `${waterlineShift.toFixed(2)}px`);
  }

  function applyNodeMotion(node, nowMs, cue) {
    const key = node.dataset.focusKey || node.dataset.venue || 'motion';
    const role = roleForNode(node);
    const env = environmentEnvelope(viewport);
    const envelope = movementEnvelope(stageKind, role);
    const pulseAge = nowMs - state.pulseStartedAt;
    const pulse = state.pulseStartedAt > 0 ? clamp(1 - pulseAge / 6000, 0, 1) : 0;
    const path = pathMotion(nowMs, key, role, stageKind);
    const focused = node.dataset.focused === 'true';
    const active = node.dataset.active === 'true';
    const speaking = node.dataset.speaking === 'true';
    const spotlight = node.dataset.spotlight === 'true';
    const eventWeight = speaking ? 1 : active ? 0.72 : spotlight ? 0.55 : 0;
    const eventPulse = pulse * eventWeight;
    const phase = (nowMs / 1000) + (stableHash(`${key}:phase`) % 1000) / 200;
    const bob = Math.sin(phase * (role === 'venue' ? 0.9 : 1.25)) * envelope.bob;
    const tideDrift = env.tideBias * (role === 'venue' ? 0.6 : 1.6);
    const focusDamp = focused
      ? (viewport.dataset.focusPinned === 'true' ? 0.2 : 0.58)
      : 1;
    const responseX = Math.sin(phase * 7.2) * (role === 'venue' ? 0.7 : 1.2) * eventPulse;
    const responseY = -Math.max(0, Math.sin(phase * 8.8)) * (role === 'venue' ? 2.4 : 5.2) * eventPulse;
    const directed = directorMotion(node, cue, eventPulse);
    const motionX = ((path.x + tideDrift) * focusDamp) + responseX + directed.x;
    const motionY = ((path.y * 0.72 + bob) * focusDamp) + responseY + directed.y - (focused ? 5 : 0);
    node.style.setProperty('--motion-x', `${motionX.toFixed(2)}px`);
    node.style.setProperty('--motion-y', `${motionY.toFixed(2)}px`);

    const lastFacing = state.facingByKey.get(key) ?? 1;
    const facingSource = Math.abs(directed.faceHint) > 0.18 ? directed.faceHint : path.dx;
    const nextFacing = Math.abs(facingSource) > 0.22 ? (facingSource >= 0 ? 1 : -1) : lastFacing;
    state.facingByKey.set(key, nextFacing);
    const tilt = (path.dx * 0.45) + (directed.faceHint * 1.2) + (focused ? 1.5 : 0) - (eventPulse * 2.2);
    node.dataset.facing = nextFacing > 0 ? 'forward' : 'reverse';
    updateSpriteFacing(node, nextFacing, tilt);
  }

  function frame(nowMs) {
    applyViewportEnvelope(nowMs);
    if (stageRoot) {
      const nodes = Array.from(stageRoot.querySelectorAll('.pixel-actor, .pixel-venue'));
      const nodesByKey = new Map(nodes.map((node) => [node.dataset.focusKey, node]));
      const cue = resolveActivityCue(viewport, nodesByKey);
      for (const node of nodes) {
        applyNodeMotion(node, nowMs, cue);
      }
    }
    state.rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (state.rafId || !stageRoot || !viewport) {
      return;
    }
    state.rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (!state.rafId) {
      return;
    }
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  return {
    start,
    stop,
    syncActivity,
  };
}
