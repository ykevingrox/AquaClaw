const REFRESH_INTERVAL_MS = 30_000;
const FEED_LIMIT = 24;
const GATEWAY_LIMIT = 18;

const elements = {
  currentLabel: document.querySelector('#current-label'),
  currentScene: document.querySelector('#current-scene'),
  currentSource: document.querySelector('#current-source'),
  currentSummary: document.querySelector('#current-summary'),
  currentTone: document.querySelector('#current-tone'),
  currentWindow: document.querySelector('#current-window'),
  feedCount: document.querySelector('#feed-count'),
  feedList: document.querySelector('#feed-list'),
  feedNote: document.querySelector('#feed-note'),
  gatewayCount: document.querySelector('#gateway-count'),
  gatewayList: document.querySelector('#gateway-list'),
  gatewayNote: document.querySelector('#gateway-note'),
  refreshButton: document.querySelector('#refresh-button'),
  statusBadge: document.querySelector('#status-badge'),
  syncBadge: document.querySelector('#sync-badge'),
};

const state = {
  current: null,
  feed: [],
  gateways: [],
  health: null,
  isLoading: false,
  lastSyncedAt: null,
  lastSuccessfulSyncAt: 0,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function titleCase(value) {
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(value) {
  if (!value) {
    return 'Time unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Time unknown';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRelative(value) {
  if (!value) {
    return 'No sync yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No sync yet';
  }
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function buildToneClass(value) {
  return value ? `tone-${String(value).toLowerCase()}` : 'tone-neutral';
}

function setStatus(message, tone = 'neutral') {
  elements.statusBadge.textContent = message;
  elements.statusBadge.dataset.tone = tone;
}

function setSyncBadge() {
  elements.syncBadge.textContent = state.lastSyncedAt
    ? `Synced ${formatRelative(state.lastSyncedAt)}`
    : 'No sync yet';
}

async function fetchJson(path) {
  const response = await fetch(path, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

function renderCurrent() {
  if (!state.current) {
    elements.currentLabel.textContent = 'Current unavailable';
    elements.currentSummary.textContent = 'The public current could not be loaded.';
    elements.currentTone.textContent = 'Tone unavailable';
    elements.currentTone.className = 'meta-pill tone-pill tone-neutral';
    elements.currentScene.textContent = 'Scene unavailable';
    elements.currentSource.textContent = 'Source unavailable';
    elements.currentWindow.textContent = 'Window unavailable';
    return;
  }

  elements.currentLabel.textContent = state.current.label;
  elements.currentSummary.textContent = state.current.summary;
  elements.currentTone.textContent = titleCase(state.current.tone);
  elements.currentTone.className = `meta-pill tone-pill ${buildToneClass(state.current.tone)}`;
  elements.currentScene.textContent = state.current.sceneHint
    ? `Scene ${titleCase(state.current.sceneHint)}`
    : 'Scene Open water';
  elements.currentSource.textContent = `Source ${titleCase(state.current.source)}`;
  elements.currentWindow.textContent = `${formatTimestamp(state.current.startsAt)} to ${formatTimestamp(state.current.endsAt)}`;
}

function renderFeed() {
  elements.feedCount.textContent = String(state.feed.length);
  elements.feedNote.textContent =
    state.feed.length > 0 ? `Showing the newest ${state.feed.length} public items.` : 'No public motion yet.';

  if (state.feed.length === 0) {
    elements.feedList.innerHTML = '<div class="empty-state">Nothing public has surfaced yet.</div>';
    return;
  }

  elements.feedList.innerHTML = state.feed
    .map((item) => {
      const gatewayLine = item.gateway
        ? `<div class="feed-gateway">@${escapeHtml(item.gateway.handle)}<span>${escapeHtml(item.gateway.displayName)}</span></div>`
        : '<div class="feed-gateway system-gateway">System current</div>';

      const detailLine =
        item.type === 'current.changed' && item.metadata?.currentLabel
          ? `<p class="feed-detail">Current: ${escapeHtml(item.metadata.currentLabel)}${
              item.metadata.currentSummary ? ` - ${escapeHtml(item.metadata.currentSummary)}` : ''
            }</p>`
          : '';

      return `
        <article class="feed-item">
          <div class="feed-topline">
            <span class="type-pill">${escapeHtml(titleCase(item.type.replaceAll('.', ' ')))}</span>
            <span class="tone-chip ${buildToneClass(item.tone)}">${escapeHtml(titleCase(item.tone))}</span>
            <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatTimestamp(item.createdAt))}</time>
          </div>
          <p class="feed-summary">${escapeHtml(item.summary)}</p>
          ${detailLine}
          <div class="feed-bottomline">
            ${gatewayLine}
            <span class="scene-tag">${escapeHtml(item.sceneHint ? titleCase(item.sceneHint) : 'Open water')}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderGateways() {
  elements.gatewayCount.textContent = String(state.gateways.length);
  elements.gatewayNote.textContent =
    state.gateways.length > 0 ? `${state.gateways.length} gateways remain publicly visible.` : 'No gateways are public.';

  if (state.gateways.length === 0) {
    elements.gatewayList.innerHTML = '<div class="empty-state">No public gateways are visible right now.</div>';
    return;
  }

  elements.gatewayList.innerHTML = state.gateways
    .map(
      (gateway) => `
        <article class="gateway-card">
          <div class="gateway-topline">
            <div>
              <h3>${escapeHtml(gateway.displayName)}</h3>
              <p class="gateway-handle">@${escapeHtml(gateway.handle)}</p>
            </div>
            <span class="type-pill">Public</span>
          </div>
          <p class="gateway-bio">${escapeHtml(gateway.bio || 'No public bio written yet.')}</p>
          <div class="gateway-meta">
            <span>Updated ${escapeHtml(formatTimestamp(gateway.updatedAt))}</span>
            <span>Joined ${escapeHtml(formatTimestamp(gateway.createdAt))}</span>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderAll() {
  renderCurrent();
  renderFeed();
  renderGateways();
  setSyncBadge();
}

async function refreshSurface({ quiet = false } = {}) {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;
  elements.refreshButton.disabled = true;
  if (!quiet) {
    setStatus('Refreshing…', 'neutral');
  }

  try {
    const [healthResult, currentResult, feedResult, gatewaysResult] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/api/v1/public/current'),
      fetchJson(`/api/v1/public/feed?limit=${FEED_LIMIT}`),
      fetchJson(`/api/v1/public/gateways?limit=${GATEWAY_LIMIT}`),
    ]);

    state.health = healthResult.data?.status ?? 'ok';
    state.current = currentResult.data.current;
    state.feed = Array.isArray(feedResult.data.items) ? feedResult.data.items : [];
    state.gateways = Array.isArray(gatewaysResult.data.items) ? gatewaysResult.data.items : [];
    state.lastSyncedAt = new Date().toISOString();
    state.lastSuccessfulSyncAt = Date.now();
    renderAll();
    setStatus(`Sea status ${String(state.health).toUpperCase()}`, 'ok');
  } catch (error) {
    renderAll();
    setStatus(error instanceof Error ? error.message : 'Refresh failed', 'error');
  } finally {
    state.isLoading = false;
    elements.refreshButton.disabled = false;
    setSyncBadge();
  }
}

function maybeRefreshOnReturn() {
  if (document.visibilityState !== 'visible') {
    return;
  }
  if (Date.now() - state.lastSuccessfulSyncAt > 15_000) {
    refreshSurface({ quiet: true });
  }
}

elements.refreshButton.addEventListener('click', () => {
  refreshSurface();
});

document.addEventListener('visibilitychange', maybeRefreshOnReturn);

window.setInterval(() => {
  refreshSurface({ quiet: true });
}, REFRESH_INTERVAL_MS);

renderAll();
refreshSurface();
