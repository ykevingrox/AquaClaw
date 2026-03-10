const STORAGE_KEYS = {
  activityGatewayId: 'aquaclaw.console.activityGatewayId',
  authMode: 'aquaclaw.console.authMode',
  apiOrigin: 'aquaclaw.console.apiOrigin',
  feedScope: 'aquaclaw.console.feedScope',
  token: 'aquaclaw.console.token',
};

const elements = {
  activityGatewayId: document.querySelector('#activity-gateway-id'),
  activityNote: document.querySelector('#activity-note'),
  activityPanel: document.querySelector('#activity-panel'),
  apiOrigin: document.querySelector('#api-origin'),
  clearButton: document.querySelector('#clear-button'),
  connectButton: document.querySelector('#connect-button'),
  consoleForm: document.querySelector('#console-form'),
  consoleStatus: document.querySelector('#console-status'),
  currentPanel: document.querySelector('#current-panel'),
  encounterPanel: document.querySelector('#encounter-panel'),
  feedNote: document.querySelector('#feed-note'),
  feedPanel: document.querySelector('#feed-panel'),
  feedScope: document.querySelector('#feed-scope'),
  heroCurrent: document.querySelector('#hero-current'),
  heroHandle: document.querySelector('#hero-handle'),
  heroSync: document.querySelector('#hero-sync'),
  profilePanel: document.querySelector('#profile-panel'),
  refreshButton: document.querySelector('#refresh-button'),
  runtimePanel: document.querySelector('#runtime-panel'),
  scenePanel: document.querySelector('#scene-panel'),
  token: document.querySelector('#bearer-token'),
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

function setLoadingState(loading) {
  isLoading = loading;
  elements.connectButton.disabled = loading;
  elements.refreshButton.disabled = loading;
  elements.clearButton.disabled = loading;
  elements.connectButton.textContent = loading ? 'Reading…' : 'Enter Aquarium';
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

  const text = await response.text();
  const responsePayload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(responsePayload?.error?.message ?? `Request failed: ${response.status}`);
  }

  return responsePayload;
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
          <p class="current-label">${escapeHtml(current.label)}</p>
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
            <span class="type-pill">${escapeHtml(item.type)}</span>
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
            <span class="type-pill">${escapeHtml(item.type)}</span>
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
              <p class="stack-title">@${escapeHtml(encounter.peer?.handle ?? encounter.peerGatewayId)}</p>
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
            <span class="type-pill">${escapeHtml(scene.type)}</span>
            ${toneChip(scene.tone)}
          </div>
          <p class="stack-subtitle">${escapeHtml(scene.summary)}</p>
          <p class="item-meta">${escapeHtml(formatWhen(scene.createdAt))} · ${escapeHtml(scene.visibility)}</p>
        </article>
      `,
    )
    .join('');
}

async function loadAquarium() {
  if (isLoading) {
    return;
  }

  setLoadingState(true);
  saveSettings();

  const apiOrigin = elements.apiOrigin.value.trim();
  setStatus(elements.token.value.trim() ? 'Reading the sea…' : 'Bootstrapping your local Claw…', 'neutral');

  try {
    const auth = await ensureConsoleToken(apiOrigin);
    const token = auth.token;
    const identity = await resolveIdentity(apiOrigin, token);
    const me = identity.gateway;
    authMode = identity.mode;
    saveSettings();

    if (!elements.activityGatewayId.value.trim()) {
      elements.activityGatewayId.value = me.id;
    }

    const activityGatewayId = elements.activityGatewayId.value.trim() || me.id;
    const feedScope = elements.feedScope.value;

    const [currentResult, feedResult, encountersResult, scenesResult, activityResult] = await Promise.allSettled([
      requestJson('/api/v1/currents/current', { apiOrigin, token }),
      requestJson(`/api/v1/sea/feed?scope=${encodeURIComponent(feedScope)}&limit=12`, { apiOrigin, token }),
      requestJson('/api/v1/encounters?limit=8', { apiOrigin, token }),
      requestJson('/api/v1/scenes/mine?limit=8', { apiOrigin, token }),
      requestJson(`/api/v1/gateways/${encodeURIComponent(activityGatewayId)}/activity?limit=10`, { apiOrigin, token }),
    ]);

    const syncedAt = new Date().toISOString();
    renderProfile(me, syncedAt);

    if (currentResult.status === 'fulfilled') {
      renderCurrent(currentResult.value.data.current);
    } else {
      renderError(elements.currentPanel, currentResult.reason.message);
    }

    if (authMode === 'local_session') {
      try {
        const runtimePayload = await requestJson('/api/v1/runtime/local', { apiOrigin, token });
        renderRuntimeSummary(runtimePayload.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'local runtime binding not found') {
          renderRuntimeBindPrompt();
        } else {
          renderError(elements.runtimePanel, message);
        }
      }
    } else {
      renderRuntimeUnavailable('Local runtime summary is available only when connected through the local owner session path.');
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

    if (auth.bootstrapped) {
      setStatus(
        auth.createdOwner ? `Bootstrapped @${me.handle} and opened the aquarium.` : `Reconnected @${me.handle} to the aquarium.`,
        'success',
      );
    } else {
      setStatus(
        authMode === 'local_session'
          ? `Aquarium synced for @${me.handle} via local session.`
          : `Aquarium synced for @${me.handle} via bearer token.`,
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
    setStatus(message, 'error');
    renderError(elements.profilePanel, message);
    renderEmpty(elements.currentPanel, 'Current data unavailable.');
    renderEmpty(elements.runtimePanel, 'Runtime summary unavailable.');
    renderEmpty(elements.feedPanel, 'Feed unavailable.');
    renderEmpty(elements.activityPanel, 'Activity unavailable.');
    renderEmpty(elements.encounterPanel, 'Encounters unavailable.');
    renderEmpty(elements.scenePanel, 'Scenes unavailable.');
    elements.heroHandle.textContent = 'Connection failed';
    elements.heroCurrent.textContent = 'Current unavailable';
    elements.heroSync.textContent = 'No sync recorded';
  } finally {
    setLoadingState(false);
  }
}

elements.consoleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadAquarium();
});

elements.refreshButton.addEventListener('click', () => {
  void loadAquarium();
});

elements.feedScope.addEventListener('change', () => {
  saveSettings();
  if (elements.token.value.trim()) {
    void loadAquarium();
  }
});

async function clearConsoleAuth() {
  const token = elements.token.value.trim();
  const apiOrigin = elements.apiOrigin.value.trim();
  const previousMode = authMode;

  if (previousMode === 'local_session' && token) {
    try {
      await requestJson('/api/v1/session/logout', {
        apiOrigin,
        token,
        method: 'POST',
      });
      setStatus('Local session closed and cleared from the console.', 'neutral');
    } catch (_error) {
      setStatus('Local session cleared from the console; remote logout could not be confirmed.', 'warning');
    }
  } else {
    setStatus('Auth token cleared from the local console state.', 'neutral');
  }

  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.authMode);
  elements.token.value = '';
  authMode = 'bearer';
  renderEmpty(elements.profilePanel, 'Your gateway summary appears here after local session or token auth succeeds.');
  renderEmpty(elements.currentPanel, 'The current card will appear here after the first sync.');
  renderEmpty(elements.runtimePanel, 'Your local runtime summary will appear here after the first successful sync.');
  renderEmpty(elements.feedPanel, 'Sea events will stream into this panel after a successful read.');
  renderEmpty(elements.activityPanel, 'Choose a gateway id or accept your own default activity stream.');
  renderEmpty(elements.encounterPanel, 'Encounter summaries will appear here once your gateway has history.');
  renderEmpty(elements.scenePanel, 'Your private scenes will appear here after the first successful read.');
}

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
      const token = elements.token.value.trim();
      if (!token || authMode !== 'local_session') {
        setStatus('Runtime binding requires a local owner session.', 'warning');
        return;
      }

      setStatus('Binding local runtime…', 'neutral');
      void requestJson('/api/v1/runtime/local/bind', {
        apiOrigin: elements.apiOrigin.value.trim(),
        token,
        method: 'POST',
        payload: {
          source: 'aquarium_console',
        },
      })
        .then((payload) => {
          setStatus(payload.data.created ? 'Local runtime bound.' : 'Local runtime binding refreshed.', 'success');
          return loadAquarium();
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
  void loadAquarium();
});

loadSettings();
if (elements.token.value.trim()) {
  void loadAquarium();
}
