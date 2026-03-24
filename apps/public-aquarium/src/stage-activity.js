const COMMUNITY_CAST_ALIASES = {
  xiaowo: ['xiaowo', 'xiao-wo', 'xiao_wo', '小蜗'],
  beibei: ['beibei', 'bei-bei', 'bei_bei', '贝贝'],
  qiaoqiao: ['qiaoqiao', 'qiao-qiao', 'qiao_qiao', '壳壳'],
};

const VENUE_ALIASES = {
  'krusty-krab': ['krusty', 'krab', 'krustykrab', '蟹堡王'],
  shellbucks: ['shellbucks', 'shellbuks', '蟹巴克'],
};

function normalizeLookupToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '');
}

function matchesAlias(tokens, aliases) {
  return tokens.some((token) => aliases.some((alias) => token === alias || token.includes(alias) || alias.includes(token)));
}

function sortedByTime(items, numericTimestamp, limit) {
  return [...items]
    .sort((left, right) => numericTimestamp(right?.createdAt) - numericTimestamp(left?.createdAt))
    .slice(0, limit);
}

function activityKindForItem(item) {
  switch (item?.type) {
    case 'public_expression.created':
    case 'public_expression.replied':
      return 'speech';
    case 'recharge.selected':
      return 'recharge';
    case 'current.changed':
      return 'current';
    case 'environment.changed':
      return 'water';
    case 'gateway.registered':
      return 'arrival';
    case 'gateway.profile_updated':
      return 'profile';
    default:
      return item?.gateway ? 'motion' : 'idle';
  }
}

function activityEnergyForKind(kind) {
  switch (kind) {
    case 'speech':
    case 'recharge':
      return 'high';
    case 'current':
    case 'water':
      return 'medium';
    case 'arrival':
    case 'profile':
    case 'motion':
      return 'low';
    default:
      return 'steady';
  }
}

export function buildGatewayFocusKey(gateway, gatewayPrimaryLabel) {
  const key = gateway?.id || gateway?.handle || gatewayPrimaryLabel(gateway) || 'unknown';
  return `gateway:${key}`;
}

export function recentFeedItems(feed, numericTimestamp, limit = 10) {
  return sortedByTime(feed, numericTimestamp, limit);
}

export function gatewayRecentFeedItems(feed, gatewayId, numericTimestamp, limit = 3) {
  if (!gatewayId) {
    return [];
  }
  return sortedByTime(feed, numericTimestamp, feed.length)
    .filter((item) => item?.gateway?.id === gatewayId)
    .slice(0, limit);
}

export function recentGatewayIds({ feed, publicExpressions = [], numericTimestamp }) {
  const ids = new Set();

  for (const item of recentFeedItems(feed, numericTimestamp, 10)) {
    if (item?.gateway?.id) {
      ids.add(item.gateway.id);
    }
  }

  for (const expression of sortedByTime(publicExpressions, numericTimestamp, 8)) {
    if (expression?.gateway?.id) {
      ids.add(expression.gateway.id);
    }
  }

  return ids;
}

export function detectCommunityCastId(gateway, { gatewayPrimaryLabel, gatewaySecondaryLabel }) {
  if (!gateway) {
    return null;
  }

  const tokens = [
    gateway.id,
    gateway.handle,
    gateway.displayName,
    gatewayPrimaryLabel(gateway),
    gatewaySecondaryLabel(gateway),
  ]
    .map(normalizeLookupToken)
    .filter(Boolean);

  for (const [castId, aliases] of Object.entries(COMMUNITY_CAST_ALIASES)) {
    if (matchesAlias(tokens, aliases.map(normalizeLookupToken))) {
      return castId;
    }
  }

  return null;
}

export function resolveVenueIdFromName(value) {
  const token = normalizeLookupToken(value);
  if (!token) {
    return null;
  }

  for (const [venueId, aliases] of Object.entries(VENUE_ALIASES)) {
    if (aliases.map(normalizeLookupToken).some((alias) => token === alias || token.includes(alias) || alias.includes(token))) {
      return venueId;
    }
  }

  return null;
}

export function resolveFocusKeyForFeedItem(item, { gateways, gatewayPrimaryLabel, gatewaySecondaryLabel }) {
  if (!item) {
    return null;
  }

  const castId = detectCommunityCastId(item.gateway, { gatewayPrimaryLabel, gatewaySecondaryLabel });
  if (castId) {
    return `cast:${castId}`;
  }

  const knownGateway = item?.gateway?.id ? gateways.find((gateway) => gateway.id === item.gateway.id) : null;
  if (knownGateway) {
    return buildGatewayFocusKey(knownGateway, gatewayPrimaryLabel);
  }

  if (item?.gateway) {
    return buildGatewayFocusKey(item.gateway, gatewayPrimaryLabel);
  }

  const venueId = item?.type === 'recharge.selected' ? resolveVenueIdFromName(item?.metadata?.venueName ?? item?.summary) : null;
  return venueId ? `venue:${venueId}` : null;
}

export function buildStageActivity({
  bubbleMaxLength = 40,
  expressionPreview,
  feed,
  gateways,
  gatewayPrimaryLabel,
  gatewaySecondaryLabel,
  localizeFeedSummary,
  numericTimestamp,
}) {
  const recentItems = recentFeedItems(feed, numericTimestamp, 6);
  const spotlightKeys = new Set();
  const leadItem = recentItems[0] ?? null;

  for (const item of recentItems.slice(0, 3)) {
    const focusKey = resolveFocusKeyForFeedItem(item, { gateways, gatewayPrimaryLabel, gatewaySecondaryLabel });
    if (focusKey) {
      spotlightKeys.add(focusKey);
    }

    const venueId = resolveVenueIdFromName(item?.metadata?.venueName);
    if (venueId) {
      spotlightKeys.add(`venue:${venueId}`);
    }
  }

  if (!leadItem) {
    return {
      autoFocusKey: null,
      bubbleFocusKey: null,
      bubbleText: '',
      energy: 'steady',
      eventToken: '',
      kind: 'idle',
      sourceFocusKey: null,
      spotlightKeys,
      venueGlowKey: null,
    };
  }

  const kind = activityKindForItem(leadItem);
  const energy = activityEnergyForKind(kind);
  const leadFocusKey = resolveFocusKeyForFeedItem(leadItem, { gateways, gatewayPrimaryLabel, gatewaySecondaryLabel });
  const venueId = resolveVenueIdFromName(leadItem?.metadata?.venueName ?? (kind === 'recharge' ? leadItem?.summary : null));
  const venueGlowKey = venueId ? `venue:${venueId}` : null;

  if (venueGlowKey) {
    spotlightKeys.add(venueGlowKey);
  }

  let autoFocusKey = leadFocusKey;
  let sourceFocusKey = leadFocusKey ?? venueGlowKey;
  let bubbleFocusKey = sourceFocusKey;

  if ((kind === 'current' || kind === 'water') && !bubbleFocusKey) {
    bubbleFocusKey = 'cast:xiaowo';
    sourceFocusKey = 'cast:xiaowo';
    autoFocusKey = autoFocusKey ?? 'cast:xiaowo';
    spotlightKeys.add('cast:xiaowo');
  }

  if (bubbleFocusKey) {
    spotlightKeys.add(bubbleFocusKey);
  }

  const summary = bubbleFocusKey ? String(localizeFeedSummary(leadItem) ?? '').trim() : '';
  const bubbleText = summary ? expressionPreview(summary, bubbleMaxLength) : '';

  return {
    autoFocusKey,
    bubbleFocusKey: bubbleText ? bubbleFocusKey : null,
    bubbleText,
    energy,
    eventToken: `${leadItem?.type ?? 'idle'}:${leadItem?.createdAt ?? ''}:${leadItem?.gateway?.id ?? ''}`,
    kind,
    sourceFocusKey,
    spotlightKeys,
    venueGlowKey,
  };
}
