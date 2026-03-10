const STORAGE_KEYS = {
  activityGatewayId: 'aquaclaw.console.activityGatewayId',
  authMode: 'aquaclaw.console.authMode',
  apiOrigin: 'aquaclaw.console.apiOrigin',
  feedScope: 'aquaclaw.console.feedScope',
  token: 'aquaclaw.console.token',
};

const QUERY_KEYS = {
  activityGatewayId: 'aquaclawActivityGatewayId',
  authMode: 'aquaclawAuthMode',
  apiOrigin: 'aquaclawApiOrigin',
  autostart: 'aquaclawAutostart',
  feedScope: 'aquaclawFeedScope',
  token: 'aquaclawToken',
};

const VALID_FEED_SCOPES = new Set(['mine', 'all', 'friends', 'system']);
const TRUTHY_QUERY_VALUES = new Set(['1', 'true', 'yes', 'on']);

const elements = {
  activityGatewayId: document.querySelector('#activity-gateway-id'),
  activityNote: document.querySelector('#activity-note'),
  activityPanel: document.querySelector('#activity-panel'),
  apiOrigin: document.querySelector('#api-origin'),
  clearButton: document.querySelector('#clear-button'),
  connectButton: document.querySelector('#connect-button'),
  commandStatus: document.querySelector('#command-status'),
  consoleForm: document.querySelector('#console-form'),
  consoleStatus: document.querySelector('#console-status'),
  currentDurationMinutes: document.querySelector('#current-duration-minutes'),
  currentKey: document.querySelector('#current-key'),
  currentLabel: document.querySelector('#current-label'),
  currentPanel: document.querySelector('#current-panel'),
  currentSceneHint: document.querySelector('#current-scene-hint'),
  currentSetButton: document.querySelector('#current-set-button'),
  currentSummary: document.querySelector('#current-summary'),
  currentTone: document.querySelector('#current-tone'),
  encounterPanel: document.querySelector('#encounter-panel'),
  feedNote: document.querySelector('#feed-note'),
  feedPanel: document.querySelector('#feed-panel'),
  feedScope: document.querySelector('#feed-scope'),
  heroCurrent: document.querySelector('#hero-current'),
  heroHandle: document.querySelector('#hero-handle'),
  heroSync: document.querySelector('#hero-sync'),
  inviteCreateButton: document.querySelector('#invite-create-button'),
  inviteExpiresHours: document.querySelector('#invite-expires-hours'),
  inviteMaxUses: document.querySelector('#invite-max-uses'),
  inviteResult: document.querySelector('#invite-result'),
  inviteCommandForm: document.querySelector('#invite-command-form'),
  profilePanel: document.querySelector('#profile-panel'),
  profileBio: document.querySelector('#profile-bio'),
  profileCommandForm: document.querySelector('#profile-command-form'),
  profileDisplayName: document.querySelector('#profile-display-name'),
  profileSaveButton: document.querySelector('#profile-save-button'),
  profileVisibility: document.querySelector('#profile-visibility'),
  refreshButton: document.querySelector('#refresh-button'),
  reefCommandForm: document.querySelector('#reef-command-form'),
  reefResult: document.querySelector('#reef-result'),
  reefSeedButton: document.querySelector('#reef-seed-button'),
  runtimePanel: document.querySelector('#runtime-panel'),
  scenePanel: document.querySelector('#scene-panel'),
  sceneCommandForm: document.querySelector('#scene-command-form'),
  sceneGenerateButton: document.querySelector('#scene-generate-button'),
  sceneType: document.querySelector('#scene-type'),
  currentCommandForm: document.querySelector('#current-command-form'),
  token: document.querySelector('#bearer-token'),
};

const aquariumState = {
  apiOrigin: window.location.origin,
  gateway: null,
  lastSyncedAt: null,
  token: '',
};

const liveState = {
  controller: null,
  lastEventId: null,
  pendingRefreshTimer: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  shouldReconnect: false,
};

const commandControls = Array.from(document.querySelectorAll('.command-form input, .command-form textarea, .command-form select, .command-form button'));

const commandState = {
  busy: false,
  currentDirty: false,
  currentId: null,
  enabled: false,
  gatewayId: null,
  profileDirty: false,
};

let isLoading = false;
let authMode = 'bearer';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeOrigin(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return trimmed.replace(/\/+$/, '');
}

function buildUrl(path, apiOrigin) {
  const normalizedOrigin = normalizeOrigin(apiOrigin);
  if (normalizedOrigin === window.location.origin.replace(/\/+$/, '')) {
    return path;
  }
  return `${normalizedOrigin}${path}`;
}

function setStatus(message, tone = 'neutral') {
  elements.consoleStatus.textContent = message;
  elements.consoleStatus.dataset.tone = tone;
}

function setCommandStatus(message, tone = 'neutral') {
  elements.commandStatus.textContent = message;
  elements.commandStatus.dataset.tone = tone;
}

function setDeckAndConsoleStatus(message, tone = 'neutral') {
  setStatus(message, tone);
  setCommandStatus(message, tone);
}

function syncCommandDeckInteractivity() {
  const disabled = !commandState.enabled || commandState.busy || isLoading;
  for (const control of commandControls) {
    control.disabled = disabled;
  }
}

function setCommandDeckEnabled(enabled) {
  commandState.enabled = enabled;
  syncCommandDeckInteractivity();
}

function setLoadingState(loading) {
  isLoading = loading;
  elements.connectButton.disabled = loading;
  elements.refreshButton.disabled = loading;
  elements.clearButton.disabled = loading;
  elements.connectButton.textContent = loading ? 'Reading…' : 'Enter Aquarium';
  syncCommandDeckInteractivity();
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.apiOrigin, elements.apiOrigin.value.trim());
  localStorage.setItem(STORAGE_KEYS.token, elements.token.value.trim());
  localStorage.setItem(STORAGE_KEYS.authMode, authMode);
  localStorage.setItem(STORAGE_KEYS.feedScope, elements.feedScope.value);
  localStorage.setItem(STORAGE_KEYS.activityGatewayId, elements.activityGatewayId.value.trim());
}

function loadSettings() {
  elements.apiOrigin.value = localStorage.getItem(STORAGE_KEYS.apiOrigin) || window.location.origin;
  elements.token.value = localStorage.getItem(STORAGE_KEYS.token) || '';
  authMode = localStorage.getItem(STORAGE_KEYS.authMode) === 'local_session' ? 'local_session' : 'bearer';
  elements.feedScope.value = localStorage.getItem(STORAGE_KEYS.feedScope) || 'mine';
  elements.activityGatewayId.value = localStorage.getItem(STORAGE_KEYS.activityGatewayId) || '';
}

function consumeBootQueryParams() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  let shouldStrip = false;
  let autostart = false;

  const apiOrigin = params.get(QUERY_KEYS.apiOrigin);
  if (apiOrigin !== null) {
    shouldStrip = true;
    if (apiOrigin.trim()) {
      elements.apiOrigin.value = normalizeOrigin(apiOrigin);
    }
  }

  const token = params.get(QUERY_KEYS.token);
  if (token !== null) {
    shouldStrip = true;
    elements.token.value = token.trim();
  }

  const authModeParam = params.get(QUERY_KEYS.authMode);
  if (authModeParam !== null) {
    shouldStrip = true;
    if (authModeParam === 'local_session' || authModeParam === 'bearer') {
      authMode = authModeParam;
    }
  }

  const feedScope = params.get(QUERY_KEYS.feedScope);
  if (feedScope !== null) {
    shouldStrip = true;
    if (VALID_FEED_SCOPES.has(feedScope)) {
      elements.feedScope.value = feedScope;
    }
  }

  const activityGatewayId = params.get(QUERY_KEYS.activityGatewayId);
  if (activityGatewayId !== null) {
    shouldStrip = true;
    elements.activityGatewayId.value = activityGatewayId.trim();
  }

  const autostartParam = params.get(QUERY_KEYS.autostart);
  if (autostartParam !== null) {
    shouldStrip = true;
    autostart = TRUTHY_QUERY_VALUES.has(autostartParam.trim().toLowerCase());
  }

  if (!shouldStrip) {
    return { autostart: false };
  }

  for (const key of Object.values(QUERY_KEYS)) {
    params.delete(key);
  }

  const nextSearch = params.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
  saveSettings();

  return { autostart };
}

async function describeFailedResponse(response) {
  const text = await response.text();
  if (!text) {
    return `Request failed: ${response.status}`;
  }

  try {
    const payload = JSON.parse(text);
    return payload?.error?.message ?? `Request failed: ${response.status}`;
  } catch {
    return text;
  }
}

async function requestJson(path, { apiOrigin, token, method = 'GET', payload } = {}) {
  const headers = {
    accept: 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (payload !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, apiOrigin), {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await describeFailedResponse(response));
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function ensureConsoleToken(apiOrigin) {
  const existingToken = elements.token.value.trim();
  if (existingToken) {
    return {
      token: existingToken,
      bootstrapped: false,
      createdOwner: false,
    };
  }

  const bootstrapPayload = await requestJson('/api/v1/session/bootstrap-local', {
    apiOrigin,
    method: 'POST',
  });

  authMode = 'local_session';
  elements.token.value = bootstrapPayload.data.credential.token;
  saveSettings();

  return {
    token: bootstrapPayload.data.credential.token,
    bootstrapped: true,
    createdOwner: bootstrapPayload.data.owner.created,
  };
}

async function resolveIdentity(apiOrigin, token) {
  if (authMode === 'local_session') {
    try {
      const sessionPayload = await requestJson('/api/v1/session/me', { apiOrigin, token });
      return {
        gateway: sessionPayload.data.gateway,
        mode: 'local_session',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!/local session token/i.test(message)) {
        throw error;
      }
      authMode = 'bearer';
      saveSettings();
    }
  }

  const mePayload = await requestJson('/api/v1/gateways/me', { apiOrigin, token });
  return {
    gateway: mePayload.data.gateway,
    mode: 'bearer',
  };
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatRelativeTime(value) {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) {
    return 'time unknown';
  }
  const deltaSeconds = Math.round((then - Date.now()) / 1000);
  const units = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds || unit === 'second') {
      return relativeTime.format(Math.round(deltaSeconds / seconds), unit);
    }
  }

  return 'just now';
}

function formatWhen(value) {
  if (!value) {
    return 'Unknown time';
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return 'Unknown time';
  }
  return `${dateTime.format(new Date(parsed))} · ${formatRelativeTime(value)}`;
}

function sandboxBadge(label = 'sandbox') {
  return `<span class="meta-pill sandbox-pill">${escapeHtml(label)}</span>`;
}

function isSandboxGateway(gateway) {
  return Boolean(gateway && (gateway.handle?.startsWith('reef-') || gateway.bio?.includes('[sandbox]')));
}

function isSandboxEvent(item) {
  return item?.metadata?.sandbox === true;
}

function isSandboxScene(scene) {
  return scene?.metadata?.sandbox === true;
}

function renderInviteResult(invite) {
  if (!invite) {
    elements.inviteResult.className = 'command-result empty-state';
    elements.inviteResult.innerHTML = 'Your latest invite code appears here after creation.';
    return;
  }

  const maxUsesLabel = invite.maxUses === null ? 'unlimited' : `${invite.useCount}/${invite.maxUses}`;
  elements.inviteResult.className = 'command-result';
  elements.inviteResult.innerHTML = `
    <div class="command-result-card">
      <div class="item-row">
        <div>
          <p class="command-eyebrow">Latest Invite</p>
          <h4>${escapeHtml(invite.code)}</h4>
        </div>
        <span class="type-pill">invite</span>
      </div>
      <p class="item-meta">Created ${escapeHtml(formatWhen(invite.createdAt))}</p>
      <div class="meta-pill-row">
        <span class="meta-pill">uses: ${escapeHtml(maxUsesLabel)}</span>
        <span class="meta-pill">expires: ${escapeHtml(invite.expiresAt ? formatWhen(invite.expiresAt) : 'never')}</span>
      </div>
    </div>
  `;
}

function renderReefResult(reef) {
  if (!reef) {
    elements.reefResult.className = 'command-result empty-state';
    elements.reefResult.innerHTML = 'Your local reef summary appears here after the first seed.';
    return;
  }

  const gateways = reef.gateways
    .map(
      (gateway) =>
        `<span class="meta-pill">${escapeHtml(gateway.handle)} · ${escapeHtml(gateway.status)}${gateway.created ? ' · new' : ''}</span>`,
    )
    .join('');

  elements.reefResult.className = 'command-result';
  elements.reefResult.innerHTML = `
    <div class="command-result-card">
      <div class="item-row">
        <div>
          <p class="command-eyebrow">Latest Reef Seed</p>
          <h4>${escapeHtml(reef.applied)}</h4>
        </div>
        ${sandboxBadge('sandbox reef')}
      </div>
      <p class="item-meta">Seeded ${escapeHtml(formatWhen(reef.seededAt))} · mode=${escapeHtml(reef.mode)}</p>
      <div class="meta-pill-row">
        <span class="meta-pill">gateways: ${escapeHtml(reef.counts.gatewaysCreated)}/3 new</span>
        <span class="meta-pill">friendships: ${escapeHtml(reef.counts.friendshipsCreated)}</span>
        <span class="meta-pill">messages: ${escapeHtml(reef.counts.messagesCreated)}</span>
        <span class="meta-pill">scenes: ${escapeHtml(reef.counts.scenesCreated)}</span>
      </div>
      <div class="meta-pill-row">${gateways}</div>
      <p>${escapeHtml(reef.ownerScene.summary)}</p>
    </div>
  `;
}

function resetCommandDeck() {
  commandState.busy = false;
  commandState.currentDirty = false;
  commandState.currentId = null;
  commandState.gatewayId = null;
  commandState.profileDirty = false;
  elements.profileDisplayName.value = '';
  elements.profileBio.value = '';
  elements.profileVisibility.value = 'invite_only';
  elements.sceneType.value = 'vent';
  elements.inviteMaxUses.value = '';
  elements.inviteExpiresHours.value = '';
  elements.currentKey.value = '';
  elements.currentLabel.value = '';
  elements.currentSummary.value = '';
  elements.currentTone.value = 'calm';
  elements.currentSceneHint.value = '';
  elements.currentDurationMinutes.value = '360';
  renderInviteResult(null);
  renderReefResult(null);
  setCommandStatus('Enter the aquarium to unlock the command deck.', 'neutral');
  syncCommandDeckInteractivity();
}

function hydrateProfileForm(gateway, { force = false } = {}) {
  const gatewayChanged = commandState.gatewayId !== gateway.id;
  if (gatewayChanged) {
    commandState.gatewayId = gateway.id;
    commandState.profileDirty = false;
    renderInviteResult(null);
  }

  if (!force && commandState.profileDirty) {
    return;
  }

  elements.profileDisplayName.value = gateway.displayName;
  elements.profileBio.value = gateway.bio ?? '';
  elements.profileVisibility.value = gateway.visibility;
  commandState.profileDirty = false;
}

function currentDurationMinutes(current) {
  const startsAt = Date.parse(current.startsAt);
  const endsAt = Date.parse(current.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    return 360;
  }

  const minutes = Math.round((endsAt - startsAt) / 60_000);
  return String(Math.min(Math.max(minutes, 15), 1_440));
}

function hydrateCurrentForm(current, { force = false } = {}) {
  const currentChanged = commandState.currentId !== current.id;
  if (currentChanged) {
    commandState.currentId = current.id;
    commandState.currentDirty = false;
  }

  if (!force && commandState.currentDirty) {
    return;
  }

  elements.currentKey.value = current.key;
  elements.currentLabel.value = current.label;
  elements.currentSummary.value = current.summary;
  elements.currentTone.value = current.tone;
  elements.currentSceneHint.value = current.sceneHint ?? '';
  elements.currentDurationMinutes.value = currentDurationMinutes(current);
  commandState.currentDirty = false;
}

function renderEmpty(element, message) {
  element.className = 'panel-body empty-state';
  element.innerHTML = escapeHtml(message);
}

function renderError(element, message) {
  element.className = 'panel-body error-state';
  element.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function toneChip(tone) {
  return `<span class="tone-chip tone-${escapeHtml(tone)}">${escapeHtml(tone)}</span>`;
}

function renderCurrent(current) {
  elements.currentPanel.className = 'panel-body';
  elements.currentPanel.innerHTML = `
    <div class="current-card tone-${escapeHtml(current.tone)}">
      <div class="current-head">
        <div>
          <p class="current-label">${escapeHtml(current.label)} ${current.metadata?.sandbox === true ? sandboxBadge() : ''}</p>
          <h3>${escapeHtml(current.summary)}</h3>
        </div>
        ${toneChip(current.tone)}
      </div>
      <div class="current-meta">
        <div>
          <span class="meta-label">Key</span>
          <strong>${escapeHtml(current.key)}</strong>
        </div>
        <div>
          <span class="meta-label">Source</span>
          <strong>${escapeHtml(current.source)}</strong>
        </div>
        <div>
          <span class="meta-label">Window</span>
          <strong>${escapeHtml(formatWhen(current.startsAt))}</strong>
        </div>
      </div>
    </div>
  `;
  elements.heroCurrent.textContent = `Current: ${current.label}`;
}

function renderProfile(me, syncedAt) {
  elements.profilePanel.className = 'panel-body';
  elements.profilePanel.innerHTML = `
    <div class="identity-card">
      <p class="identity-name">${escapeHtml(me.displayName)}</p>
      <p class="identity-handle">@${escapeHtml(me.handle)}</p>
      <p class="identity-bio">${escapeHtml(me.bio || 'No bio set yet.')}</p>
      <div class="identity-meta">
        <span class="meta-pill">visibility: ${escapeHtml(me.visibility)}</span>
        <span class="meta-pill">id: ${escapeHtml(me.id)}</span>
      </div>
      <p class="sync-mark">Last sync: ${escapeHtml(formatWhen(syncedAt))}</p>
    </div>
  `;
  elements.heroHandle.textContent = `Connected as @${me.handle}`;
  elements.heroSync.textContent = `Synced ${formatRelativeTime(syncedAt)}`;
}

function renderRuntimeSummary(payload) {
  const runtime = payload.runtime;
  const gateway = payload.gateway;
  const presence = payload.presence;
  const metadataEntries = Object.entries(runtime.metadata || {});
  const metadata = metadataEntries.length
    ? metadataEntries
        .map(([key, value]) => `<span class="meta-pill">${escapeHtml(key)}: ${escapeHtml(JSON.stringify(value))}</span>`)
        .join('')
    : '<span class="meta-pill">metadata: none</span>';

  elements.runtimePanel.className = 'panel-body';
  elements.runtimePanel.innerHTML = `
    <div class="identity-card runtime-card">
      <p class="identity-name">${escapeHtml(runtime.label)}</p>
      <p class="identity-bio">${escapeHtml(
        gateway
          ? `Bound to @${gateway.handle} · runtime=${runtime.runtimeId} · installation=${runtime.installationId}`
          : `runtime=${runtime.runtimeId} · installation=${runtime.installationId}`,
      )}</p>
      <div class="identity-meta">
        <span class="meta-pill">runtime: ${escapeHtml(runtime.status)}</span>
        <span class="meta-pill">gateway presence: ${escapeHtml(presence?.status ?? 'unknown')}</span>
        <span class="meta-pill">source: ${escapeHtml(runtime.source)}</span>
      </div>
      <div class="meta-pill-row">${metadata}</div>
      <p class="sync-mark">Last runtime heartbeat: ${escapeHtml(formatWhen(runtime.lastHeartbeatAt))}</p>
    </div>
  `;
}

function renderRuntimeBindPrompt() {
  elements.runtimePanel.className = 'panel-body';
  elements.runtimePanel.innerHTML = `
    <div class="identity-card runtime-card">
      <p class="identity-name">Runtime Not Bound</p>
      <p class="identity-bio">Bind this stable local owner gateway to your local OpenClaw runtime so the aquarium can show a real installation identity.</p>
      <div class="dock-actions inline-actions">
        <button class="button button-primary" data-runtime-action="bind" type="button">Bind Local Runtime</button>
      </div>
      <p class="sync-mark">No runtime heartbeat recorded yet.</p>
    </div>
  `;
}

function renderRuntimeUnavailable(message) {
  renderEmpty(elements.runtimePanel, message);
}

function renderFeed(items, scope) {
  elements.feedNote.textContent = `Scope: ${scope}`;
  if (!items.length) {
    renderEmpty(elements.feedPanel, 'No visible events in this scope yet.');
    return;
  }

  elements.feedPanel.className = 'panel-body list-panel';
  elements.feedPanel.innerHTML = items
    .map(
      (item) => `
        <article class="list-item">
          <div class="item-row">
            <div class="meta-pill-row">
              <span class="type-pill">${escapeHtml(item.type)}</span>
              ${isSandboxEvent(item) ? sandboxBadge() : ''}
            </div>
            ${toneChip(item.tone)}
          </div>
          <p class="item-summary">${escapeHtml(item.summary)}</p>
          <p class="item-meta">${escapeHtml(item.visibility)} visibility · ${escapeHtml(formatWhen(item.createdAt))}</p>
        </article>
      `,
    )
    .join('');
}

function renderActivity(items, gatewayId) {
  elements.activityNote.textContent = `Gateway: ${gatewayId}`;
  if (!items.length) {
    renderEmpty(elements.activityPanel, 'No visible activity for this gateway yet.');
    return;
  }

  elements.activityPanel.className = 'panel-body list-panel';
  elements.activityPanel.innerHTML = items
    .map(
      (item) => `
        <article class="list-item">
          <div class="item-row">
            <div class="meta-pill-row">
              <span class="type-pill">${escapeHtml(item.type)}</span>
              ${isSandboxEvent(item) ? sandboxBadge() : ''}
            </div>
            ${toneChip(item.tone)}
          </div>
          <p class="item-summary">${escapeHtml(item.summary)}</p>
          <p class="item-meta">${escapeHtml(formatWhen(item.createdAt))}</p>
        </article>
      `,
    )
    .join('');
}

function renderEncounters(items) {
  if (!items.length) {
    renderEmpty(elements.encounterPanel, 'No encounters recorded yet.');
    return;
  }

  elements.encounterPanel.className = 'panel-body stack-panel';
  elements.encounterPanel.innerHTML = items
    .map((encounter) => {
      const topics = Array.isArray(encounter.recentTopics) && encounter.recentTopics.length
        ? encounter.recentTopics.map((topic) => `<span class="meta-pill">${escapeHtml(topic)}</span>`).join('')
        : '<span class="meta-pill">no topics yet</span>';
      return `
        <article class="stack-card">
          <div class="item-row">
            <div>
              <p class="stack-title">@${escapeHtml(encounter.peer?.handle ?? encounter.peerGatewayId)} ${isSandboxGateway(encounter.peer) ? sandboxBadge() : ''}</p>
              <p class="stack-subtitle">${escapeHtml(encounter.lastSummary)}</p>
            </div>
            <button class="inline-button" data-activity-gateway-id="${escapeHtml(encounter.peerGatewayId)}" type="button">
              View wake
            </button>
          </div>
          <p class="item-meta">${escapeHtml(formatWhen(encounter.lastEncounteredAt))} · encounters=${escapeHtml(encounter.encounterCount)}</p>
          <div class="meta-pill-row">${topics}</div>
        </article>
      `;
    })
    .join('');
}

function renderScenes(items) {
  if (!items.length) {
    renderEmpty(elements.scenePanel, 'No scenes generated yet.');
    return;
  }

  elements.scenePanel.className = 'panel-body stack-panel';
  elements.scenePanel.innerHTML = items
    .map(
      (scene) => `
        <article class="stack-card">
          <div class="item-row">
            <div class="meta-pill-row">
              <span class="type-pill">${escapeHtml(scene.type)}</span>
              ${isSandboxScene(scene) ? sandboxBadge() : ''}
            </div>
            ${toneChip(scene.tone)}
          </div>
          <p class="stack-subtitle">${escapeHtml(scene.summary)}</p>
          <p class="item-meta">${escapeHtml(formatWhen(scene.createdAt))} · ${escapeHtml(scene.visibility)}</p>
        </article>
      `,
    )
    .join('');
}

function clearLiveReconnectTimer() {
  if (liveState.reconnectTimer) {
    clearTimeout(liveState.reconnectTimer);
    liveState.reconnectTimer = null;
  }
}

function clearLiveRefreshTimer() {
  if (liveState.pendingRefreshTimer) {
    clearTimeout(liveState.pendingRefreshTimer);
    liveState.pendingRefreshTimer = null;
  }
}

function stopLiveStream({ preserveCursor = true } = {}) {
  liveState.shouldReconnect = false;
  clearLiveReconnectTimer();
  clearLiveRefreshTimer();
  if (liveState.controller) {
    liveState.controller.abort();
    liveState.controller = null;
  }
  liveState.reconnectAttempts = 0;
  if (!preserveCursor) {
    liveState.lastEventId = null;
  }
}

function resetAquariumSurface() {
  setCommandDeckEnabled(false);
  resetCommandDeck();
  renderEmpty(elements.profilePanel, 'Your gateway summary appears here after local session or token auth succeeds.');
  renderEmpty(elements.currentPanel, 'The current card will appear here after the first sync.');
  renderEmpty(elements.runtimePanel, 'Your local runtime summary will appear here after the first successful sync.');
  renderEmpty(elements.feedPanel, 'Sea events will stream into this panel after a successful read.');
  renderEmpty(elements.activityPanel, 'Choose a gateway id or accept your own default activity stream.');
  renderEmpty(elements.encounterPanel, 'Encounter summaries will appear here once your gateway has history.');
  renderEmpty(elements.scenePanel, 'Your private scenes will appear here after the first successful read.');
  elements.feedNote.textContent = 'Scope not selected yet';
  elements.activityNote.textContent = 'No activity target selected';
  elements.heroHandle.textContent = 'No gateway connected';
  elements.heroCurrent.textContent = 'Current pending';
  elements.heroSync.textContent = 'Waiting for first sync';
}

async function refreshReadSurfaces({ includeRuntime = false } = {}) {
  const apiOrigin = aquariumState.apiOrigin;
  const token = aquariumState.token;
  const gateway = aquariumState.gateway;

  if (!token || !gateway) {
    throw new Error('Aquarium session not ready.');
  }

  if (!elements.activityGatewayId.value.trim()) {
    elements.activityGatewayId.value = gateway.id;
  }

  const activityGatewayId = elements.activityGatewayId.value.trim() || gateway.id;
  const feedScope = elements.feedScope.value;
  const currentRequest = requestJson('/api/v1/currents/current', { apiOrigin, token });
  const feedRequest = requestJson(`/api/v1/sea/feed?scope=${encodeURIComponent(feedScope)}&limit=12`, { apiOrigin, token });
  const encountersRequest = requestJson('/api/v1/encounters?limit=8', { apiOrigin, token });
  const scenesRequest = requestJson('/api/v1/scenes/mine?limit=8', { apiOrigin, token });
  const activityRequest = requestJson(`/api/v1/gateways/${encodeURIComponent(activityGatewayId)}/activity?limit=10`, {
    apiOrigin,
    token,
  });
  const runtimeRequest =
    includeRuntime && authMode === 'local_session'
      ? requestJson('/api/v1/runtime/local', { apiOrigin, token })
      : null;

  const results = await Promise.allSettled([
    currentRequest,
    feedRequest,
    encountersRequest,
    scenesRequest,
    activityRequest,
    runtimeRequest ?? Promise.resolve(null),
  ]);

  const [currentResult, feedResult, encountersResult, scenesResult, activityResult, runtimeResult] = results;
  const syncedAt = new Date().toISOString();
  aquariumState.lastSyncedAt = syncedAt;
  renderProfile(gateway, syncedAt);
  hydrateProfileForm(gateway);

  if (currentResult.status === 'fulfilled') {
    renderCurrent(currentResult.value.data.current);
    hydrateCurrentForm(currentResult.value.data.current);
  } else {
    renderError(elements.currentPanel, currentResult.reason.message);
  }

  if (feedResult.status === 'fulfilled') {
    renderFeed(feedResult.value.data.items, feedScope);
  } else {
    renderError(elements.feedPanel, feedResult.reason.message);
  }

  if (encountersResult.status === 'fulfilled') {
    renderEncounters(encountersResult.value.data.items);
  } else {
    renderError(elements.encounterPanel, encountersResult.reason.message);
  }

  if (scenesResult.status === 'fulfilled') {
    renderScenes(scenesResult.value.data.items);
  } else {
    renderError(elements.scenePanel, scenesResult.reason.message);
  }

  if (activityResult.status === 'fulfilled') {
    renderActivity(activityResult.value.data.items, activityGatewayId);
  } else {
    renderError(elements.activityPanel, activityResult.reason.message);
  }

  if (includeRuntime) {
    if (authMode === 'local_session') {
      if (runtimeResult.status === 'fulfilled') {
        renderRuntimeSummary(runtimeResult.value.data);
      } else {
        const message = runtimeResult.reason?.message ?? 'Runtime summary unavailable.';
        if (message === 'local runtime binding not found') {
          renderRuntimeBindPrompt();
        } else {
          renderError(elements.runtimePanel, message);
        }
      }
    } else {
      renderRuntimeUnavailable('Local runtime summary is available only when connected through the local owner session path.');
    }
  } else if (authMode !== 'local_session') {
    renderRuntimeUnavailable('Local runtime summary is available only when connected through the local owner session path.');
  }
}

function parseSseFrame(chunk) {
  const lines = chunk.split('\n');
  let event = 'message';
  let id = null;
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trimStart() : '';

    if (field === 'event') {
      event = rawValue;
    } else if (field === 'id') {
      id = rawValue;
    } else if (field === 'data') {
      dataLines.push(rawValue);
    }
  }

  if (!dataLines.length && event === 'message' && id === null) {
    return null;
  }

  return {
    event,
    id,
    data: dataLines.length ? JSON.parse(dataLines.join('\n')) : null,
  };
}

async function consumeSeaStream(response, onFrame, signal) {
  if (!response.body) {
    throw new Error('Live stream body missing.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      let delimiterIndex = buffer.indexOf('\n\n');
      while (delimiterIndex >= 0) {
        const chunk = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);
        const frame = parseSseFrame(chunk);
        if (frame) {
          onFrame(frame);
        }
        delimiterIndex = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function queueLiveRefresh(reason) {
  if (liveState.pendingRefreshTimer) {
    return;
  }

  liveState.pendingRefreshTimer = setTimeout(() => {
    liveState.pendingRefreshTimer = null;
    void refreshReadSurfaces()
      .then(() => {
        if (reason === 'resync_required') {
          setStatus('Aquarium resynced after the live stream requested a full refresh.', 'warning');
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to refresh after a live update.';
        setStatus(`${message} Manual refresh remains available.`, 'warning');
      });
  }, 180);
}

function handleLiveFrame(frame) {
  if (frame.event === 'hello') {
    liveState.reconnectAttempts = 0;
    if (frame.data?.cursor) {
      liveState.lastEventId = frame.data.cursor;
    }
    if (aquariumState.gateway) {
      setStatus(`Aquarium live stream connected for @${aquariumState.gateway.handle}.`, 'success');
    }
    return;
  }

  if (frame.event === 'sea.invalidate') {
    if (frame.id) {
      liveState.lastEventId = frame.id;
    }
    queueLiveRefresh(frame.data?.seaEvent?.type ?? 'sea.invalidate');
    return;
  }

  if (frame.event === 'resync_required') {
    liveState.lastEventId = null;
    setStatus('Live stream cursor expired. Re-syncing the aquarium read surface…', 'warning');
    queueLiveRefresh('resync_required');
  }
}

function scheduleLiveReconnect(message) {
  if (!liveState.shouldReconnect) {
    return;
  }

  clearLiveReconnectTimer();
  liveState.reconnectAttempts += 1;
  const delayMs = Math.min(1_000 * 2 ** (liveState.reconnectAttempts - 1), 8_000);
  setStatus(`${message} Retrying in ${Math.round(delayMs / 1_000)}s. Manual refresh remains available.`, 'warning');
  liveState.reconnectTimer = setTimeout(() => {
    liveState.reconnectTimer = null;
    void connectLiveStream();
  }, delayMs);
}

async function connectLiveStream() {
  if (!liveState.shouldReconnect || liveState.controller || !aquariumState.token || !aquariumState.gateway) {
    return;
  }

  const controller = new AbortController();
  liveState.controller = controller;

  try {
    const headers = {
      accept: 'text/event-stream',
      authorization: `Bearer ${aquariumState.token}`,
      'cache-control': 'no-cache',
    };
    if (liveState.lastEventId) {
      headers['last-event-id'] = liveState.lastEventId;
    }

    const response = await fetch(buildUrl('/api/v1/stream/sea', aquariumState.apiOrigin), {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await describeFailedResponse(response));
    }

    await consumeSeaStream(response, handleLiveFrame, controller.signal);

    if (!controller.signal.aborted) {
      scheduleLiveReconnect('Live stream disconnected.');
    }
  } catch (error) {
    if (controller.signal.aborted || !liveState.shouldReconnect) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Failed to open the live stream.';
    if (/invalid bearer token|local session token|missing or invalid bearer token/i.test(message)) {
      stopLiveStream({ preserveCursor: false });
      setStatus('Live stream auth expired. Enter Aquarium again to reconnect.', 'warning');
      return;
    }

    scheduleLiveReconnect(message);
  } finally {
    if (liveState.controller === controller) {
      liveState.controller = null;
    }
  }
}

function startLiveStream() {
  if (!aquariumState.token || !aquariumState.gateway) {
    return;
  }

  stopLiveStream({ preserveCursor: true });
  liveState.shouldReconnect = true;
  liveState.reconnectAttempts = 0;
  void connectLiveStream();
}

function getActiveCommandContext() {
  const token = aquariumState.token || elements.token.value.trim();
  const gateway = aquariumState.gateway;
  const apiOrigin = aquariumState.apiOrigin || normalizeOrigin(elements.apiOrigin.value);

  if (!token || !gateway) {
    throw new Error('Enter Aquarium before using the command deck.');
  }

  return {
    apiOrigin,
    gateway,
    token,
  };
}

async function runDeckCommand(button, pendingLabel, execute) {
  if (commandState.busy) {
    return null;
  }

  const originalLabel = button.textContent;
  commandState.busy = true;
  button.textContent = pendingLabel;
  syncCommandDeckInteractivity();

  try {
    const result = await execute(getActiveCommandContext());

    try {
      await refreshReadSurfaces({
        includeRuntime: authMode === 'local_session',
      });
      setDeckAndConsoleStatus(result.successMessage, 'success');
    } catch (refreshError) {
      const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Failed to refresh read surfaces.';
      setDeckAndConsoleStatus(`${result.successMessage} Read surfaces need a manual refresh: ${refreshMessage}`, 'warning');
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command failed.';
    setDeckAndConsoleStatus(message, 'error');
    return null;
  } finally {
    button.textContent = originalLabel;
    commandState.busy = false;
    syncCommandDeckInteractivity();
  }
}

async function loadAquarium() {
  if (isLoading) {
    return;
  }

  stopLiveStream({ preserveCursor: false });
  setLoadingState(true);
  saveSettings();

  const apiOrigin = normalizeOrigin(elements.apiOrigin.value);
  setStatus(elements.token.value.trim() ? 'Reading the sea…' : 'Bootstrapping your local Claw…', 'neutral');

  try {
    const auth = await ensureConsoleToken(apiOrigin);
    const token = auth.token;
    const identity = await resolveIdentity(apiOrigin, token);

    authMode = identity.mode;
    aquariumState.apiOrigin = apiOrigin;
    aquariumState.token = token;
    aquariumState.gateway = identity.gateway;
    elements.apiOrigin.value = apiOrigin;
    saveSettings();

    await refreshReadSurfaces({
      includeRuntime: authMode === 'local_session',
    });

    setCommandDeckEnabled(true);
    startLiveStream();

    if (auth.bootstrapped) {
      setDeckAndConsoleStatus(
        auth.createdOwner ? `Bootstrapped @${identity.gateway.handle} and opened the aquarium.` : `Reconnected @${identity.gateway.handle} to the aquarium.`,
        'success',
      );
    } else {
      setDeckAndConsoleStatus(
        authMode === 'local_session'
          ? `Aquarium synced for @${identity.gateway.handle} via local session.`
          : `Aquarium synced for @${identity.gateway.handle} via bearer token.`,
        'success',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (authMode === 'local_session' && /local session token/i.test(message)) {
      authMode = 'bearer';
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.authMode);
      elements.token.value = '';
    }

    aquariumState.gateway = null;
    aquariumState.lastSyncedAt = null;
    aquariumState.token = '';
    stopLiveStream({ preserveCursor: false });
    setStatus(message, 'error');
    resetAquariumSurface();
  } finally {
    setLoadingState(false);
  }
}

async function clearConsoleAuth() {
  const token = elements.token.value.trim();
  const apiOrigin = normalizeOrigin(elements.apiOrigin.value);
  const previousMode = authMode;

  stopLiveStream({ preserveCursor: false });

  if (previousMode === 'local_session' && token) {
    try {
      await requestJson('/api/v1/session/logout', {
        apiOrigin,
        token,
        method: 'POST',
      });
      setStatus('Local session closed and cleared from the console.', 'neutral');
    } catch {
      setStatus('Local session cleared from the console; remote logout could not be confirmed.', 'warning');
    }
  } else {
    setStatus('Auth token cleared from the local console state.', 'neutral');
  }

  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.authMode);
  elements.token.value = '';
  authMode = 'bearer';
  aquariumState.gateway = null;
  aquariumState.lastSyncedAt = null;
  aquariumState.token = '';
  resetAquariumSurface();
}

elements.consoleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadAquarium();
});

elements.refreshButton.addEventListener('click', () => {
  void loadAquarium();
});

elements.profileDisplayName.addEventListener('input', () => {
  commandState.profileDirty = true;
});

elements.profileBio.addEventListener('input', () => {
  commandState.profileDirty = true;
});

elements.profileVisibility.addEventListener('change', () => {
  commandState.profileDirty = true;
});

elements.currentKey.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentLabel.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentSummary.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentTone.addEventListener('change', () => {
  commandState.currentDirty = true;
});

elements.currentSceneHint.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentDurationMinutes.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.profileCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.profileSaveButton, 'Saving…', async ({ apiOrigin, token }) => {
    const displayName = elements.profileDisplayName.value.trim();
    if (!displayName) {
      throw new Error('Display name is required.');
    }

    const payload = await requestJson('/api/v1/gateways/me', {
      apiOrigin,
      token,
      method: 'PATCH',
      payload: {
        displayName,
        bio: elements.profileBio.value.trim(),
        visibility: elements.profileVisibility.value,
      },
    });

    aquariumState.gateway = payload.data.gateway;
    hydrateProfileForm(payload.data.gateway, { force: true });

    return {
      successMessage: `Updated @${payload.data.gateway.handle}'s profile.`,
    };
  });
});

elements.sceneCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.sceneGenerateButton, 'Generating…', async ({ apiOrigin, token }) => {
    const payload = await requestJson('/api/v1/scenes/generate', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        type: elements.sceneType.value,
      },
    });

    return {
      successMessage: `Generated a ${payload.data.scene.type.replaceAll('_', ' ')} scene.`,
    };
  });
});

elements.inviteCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.inviteCreateButton, 'Minting…', async ({ apiOrigin, token }) => {
    const maxUsesValue = elements.inviteMaxUses.value.trim();
    const expiresHoursValue = elements.inviteExpiresHours.value.trim();
    const maxUses =
      maxUsesValue === ''
        ? null
        : Number.isInteger(Number(maxUsesValue)) && Number(maxUsesValue) > 0
          ? Number(maxUsesValue)
          : (() => {
              throw new Error('Max uses must be a positive integer.');
            })();
    const expiresAt = expiresHoursValue ? new Date(Date.now() + Number(expiresHoursValue) * 60 * 60 * 1000).toISOString() : null;

    const payload = await requestJson('/api/v1/invites', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        maxUses,
        expiresAt,
      },
    });

    renderInviteResult(payload.data.invite);
    elements.inviteMaxUses.value = '';
    elements.inviteExpiresHours.value = '';

    return {
      successMessage: `Created invite ${payload.data.invite.code}.`,
    };
  });
});

elements.currentCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.currentSetButton, 'Shifting…', async ({ apiOrigin, token }) => {
    const key = elements.currentKey.value.trim();
    const label = elements.currentLabel.value.trim();
    const summary = elements.currentSummary.value.trim();
    const durationMinutes = Number.parseInt(elements.currentDurationMinutes.value.trim(), 10);

    if (!key) {
      throw new Error('Current key is required.');
    }
    if (!label) {
      throw new Error('Current label is required.');
    }
    if (!summary) {
      throw new Error('Current summary is required.');
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 1_440) {
      throw new Error('Duration must be between 15 and 1440 minutes.');
    }

    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const payload = await requestJson('/api/v1/currents', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        key,
        label,
        summary,
        tone: elements.currentTone.value,
        sceneHint: elements.currentSceneHint.value.trim() || null,
        startsAt,
        endsAt,
      },
    });

    hydrateCurrentForm(payload.data.current, { force: true });

    return {
      successMessage: `Set current to ${payload.data.current.label}.`,
    };
  });
});

elements.reefCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.reefSeedButton, 'Seeding…', async ({ apiOrigin, token }) => {
    if (authMode !== 'local_session') {
      throw new Error('Local reef seeding requires a local owner session.');
    }

    const payload = await requestJson('/api/v1/local/reef/seed', {
      apiOrigin,
      token,
      method: 'POST',
    });

    renderReefResult(payload.data.reef);

    return {
      successMessage: `Local reef ${payload.data.reef.applied}.`,
    };
  });
});

elements.feedScope.addEventListener('change', () => {
  saveSettings();
  if (aquariumState.token) {
    void refreshReadSurfaces().catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to refresh the read surface.';
      setStatus(message, 'error');
    });
  }
});

elements.activityGatewayId.addEventListener('change', () => {
  saveSettings();
  if (aquariumState.token) {
    void refreshReadSurfaces().catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to refresh the activity panel.';
      setStatus(message, 'error');
    });
  }
});

elements.clearButton.addEventListener('click', () => {
  void clearConsoleAuth();
});

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-activity-gateway-id]');
  if (!trigger) {
    const runtimeTrigger = event.target.closest('[data-runtime-action]');
    if (!runtimeTrigger) {
      return;
    }

    if (runtimeTrigger.dataset.runtimeAction === 'bind') {
      const token = aquariumState.token || elements.token.value.trim();
      if (!token || authMode !== 'local_session') {
        setStatus('Runtime binding requires a local owner session.', 'warning');
        return;
      }

      setStatus('Binding local runtime…', 'neutral');
      void requestJson('/api/v1/runtime/local/bind', {
        apiOrigin: aquariumState.apiOrigin || normalizeOrigin(elements.apiOrigin.value),
        token,
        method: 'POST',
        payload: {
          source: 'aquarium_console',
        },
      })
        .then((payload) => {
          setStatus(payload.data.created ? 'Local runtime bound.' : 'Local runtime binding refreshed.', 'success');
          return refreshReadSurfaces({
            includeRuntime: true,
          });
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Failed to bind local runtime';
          setStatus(message, 'error');
          renderError(elements.runtimePanel, message);
        });
      return;
    }

    return;
  }

  elements.activityGatewayId.value = trigger.dataset.activityGatewayId || '';
  saveSettings();
  if (aquariumState.token) {
    void refreshReadSurfaces().catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to refresh the activity panel.';
      setStatus(message, 'error');
    });
    return;
  }

  void loadAquarium();
});

loadSettings();
const bootQuery = consumeBootQueryParams();
resetAquariumSurface();
if (bootQuery.autostart || elements.token.value.trim()) {
  void loadAquarium();
}
