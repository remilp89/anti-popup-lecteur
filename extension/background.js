// Service worker : config par site, fermeture des onglets indésirables, badge.

const DEFAULTS = { enabledHosts: [], fullscreen: true, maxRetries: 6 };
const CLICK_WINDOW_MS = 6000;

const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
};

async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

// Statistiques : nombre de popups/redirections bloqués par site protégé.
let statsQueue = Promise.resolve();
function bumpStat(url) {
  statsQueue = statsQueue
    .then(async () => {
      const { enabledHosts } = await getSettings();
      const h = hostOf(url);
      const entry = enabledHosts.find((x) => h === x || h.endsWith('.' + x));
      if (!entry) return;
      const { stats = {} } = await chrome.storage.local.get('stats');
      stats[entry] = (stats[entry] || 0) + 1;
      await chrome.storage.local.set({ stats });
    })
    .catch(() => {});
}

async function isEnabledFor(url) {
  const { enabledHosts } = await getSettings();
  const h = hostOf(url);
  return !!h && enabledHosts.some((x) => h === x || h.endsWith('.' + x));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  (async () => {
    if (msg.type === 'getConfig') {
      const s = await getSettings();
      sendResponse({
        // Frame principale : sender.url est fiable ; sender.tab.url peut encore être l'ancienne
        // adresse de l'onglet au tout début du chargement (course) => faux « désactivé ».
        enabled: await isEnabledFor(sender.frameId === 0 ? sender.url : sender.tab?.url || sender.url),
        fullscreen: s.fullscreen,
        maxRetries: s.maxRetries,
      });
    } else if (msg.type === 'click' && tabId != null) {
      await chrome.storage.session.set({ ['click:' + tabId]: Date.now() });
      sendResponse({});
    } else if (msg.type === 'stat') {
      bumpStat(sender.tab?.url);
      sendResponse({});
    } else if (msg.type === 'recentClick' && tabId != null) {
      const k = 'click:' + tabId;
      const st = await chrome.storage.session.get(k);
      sendResponse({ recent: !!st[k] && Date.now() - st[k] < 8000 });
    } else if (msg.type === 'intent' && tabId != null) {
      await chrome.storage.session.set({ ['intent:' + tabId]: Date.now() });
      sendResponse({});
    } else if (msg.type === 'playing' && tabId != null) {
      // Prévient toutes les frames de l'onglet d'arrêter de recliquer.
      chrome.tabs.sendMessage(tabId, { type: 'playing' }).catch(() => {});
      sendResponse({});
    } else {
      sendResponse({});
    }
  })();
  return true; // réponse asynchrone
});

// Un nouvel onglet/fenêtre s'ouvre juste après un clic dans un onglet actif => pub, on ferme.
// Le message « clic » du content script peut arriver APRÈS la création de l'onglet (course entre
// processus) : on attend donc un court instant avant de décider.
const closed = new Set(); // onglets publicitaires déjà fermés (leurs enfants le seront aussi)

async function maybeClose(newTabId, openerId) {
  if (openerId == null || newTabId == null || closed.has(newTabId)) return;

  // Un onglet publicitaire en ouvre souvent d'autres : on les ferme directement.
  if (closed.has(openerId)) {
    closed.add(newTabId);
    chrome.tabs.remove(newTabId).catch(() => {});
    return;
  }

  const opener = await chrome.tabs.get(openerId).catch(() => null);
  if (!opener || !(await isEnabledFor(opener.url))) return;

  await new Promise((r) => setTimeout(r, 350));
  if (closed.has(newTabId)) return; // déjà traité via l'autre événement (onCreated / navigation)

  const ck = 'click:' + openerId;
  const ik = 'intent:' + openerId;
  const st = await chrome.storage.session.get([ck, ik]);
  const now = Date.now();
  if (st[ik] && now - st[ik] < CLICK_WINDOW_MS) return; // ouverture voulue (Ctrl/Cmd/clic molette)
  if (!st[ck] || now - st[ck] > CLICK_WINDOW_MS) return; // pas lié à un clic récent

  closed.add(newTabId);
  setTimeout(() => closed.delete(newTabId), 60000);
  await chrome.tabs.remove(newTabId).catch(() => {});
  chrome.tabs.sendMessage(openerId, { type: 'popup-blocked' }).catch(() => {});
  bumpBadge(openerId);
  bumpStat(opener.url);
}

chrome.tabs.onCreated.addListener((tab) => maybeClose(tab.id, tab.openerTabId));
// Couvre aussi les popups ouverts en noopener (pas d'openerTabId).
chrome.webNavigation.onCreatedNavigationTarget.addListener((d) => maybeClose(d.tabId, d.sourceTabId));

async function bumpBadge(tabId) {
  const key = 'count:' + tabId;
  const stored = await chrome.storage.session.get(key);
  const n = (stored[key] || 0) + 1;
  await chrome.storage.session.set({ [key]: n });
  chrome.action.setBadgeBackgroundColor({ color: '#d33', tabId });
  chrome.action.setBadgeText({ text: String(n), tabId });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(['click:' + tabId, 'intent:' + tabId, 'count:' + tabId]);
});
