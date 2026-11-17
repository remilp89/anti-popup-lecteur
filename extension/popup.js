const $ = (id) => document.getElementById(id);
const DEFAULTS = { enabledHosts: [], fullscreen: true, maxRetries: 6 };

const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
};
const matches = (host, entry) => host === entry || host.endsWith('.' + entry);

$('manage').onclick = (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
};
$('openList').onclick = (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('watchlist.html') });
};

(async () => {
  // `?tab=<id>` permet d'ouvrir cette fenêtre dans un onglet pour une page donnée (utile pour tester).
  const q = new URLSearchParams(location.search).get('tab');
  const tab = q
    ? await chrome.tabs.get(Number(q)).catch(() => null)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  protection(tab);
  watchlist(tab);
})();

// --- Protection du site ------------------------------------------------------
async function protection(tab) {
  const host = hostOf(tab?.url || '');
  const s = await chrome.storage.sync.get(DEFAULTS);

  $('host').textContent = host || '(page non supportée)';
  $('fs').checked = s.fullscreen;
  $('retries').value = s.maxRetries;

  const render = () => {
    const on = s.enabledHosts.some((e) => matches(host, e));
    $('toggle').textContent = on ? 'Désactiver sur ce site' : 'Activer sur ce site';
    $('toggle').classList.toggle('on', on);
    $('toggle').disabled = !host;
  };
  render();

  const save = async (reload) => {
    await chrome.storage.sync.set(s);
    render();
    if (reload && tab?.id != null) chrome.tabs.reload(tab.id);
  };

  $('toggle').onclick = () => {
    const on = s.enabledHosts.some((e) => matches(host, e));
    s.enabledHosts = on ? s.enabledHosts.filter((e) => !matches(host, e)) : [...s.enabledHosts, host];
    save(true);
  };
  $('fs').onchange = () => {
    s.fullscreen = $('fs').checked;
    save(true);
  };
  $('retries').onchange = () => {
    s.maxRetries = Math.min(20, Math.max(1, Number($('retries').value) || 6));
    save(true);
  };
}

// --- À regarder plus tard ----------------------------------------------------
async function watchlist(tab) {
  const updateCount = async () => {
    try {
      $('count').textContent = String((await PS.watch.list()).filter((i) => !i.v).length);
    } catch (_) {}
  };
  updateCount();

  if (!/^https?:/.test(tab?.url || '')) return; // pas une page web : on n'affiche pas le bloc

  $('watch').hidden = false;

  // Infos de la page : lues par le script de contenu, sinon déduites du titre de l'onglet.
  let info = null;
  try {
    info = await chrome.tabs.sendMessage(tab.id, { type: 'pageInfo' }, { frameId: 0 });
  } catch (_) {}
  if (!info) info = PS.infoFromTab(tab);

  $('wTitle').value = info.title || '';
  $('wYear').value = info.year || '';
  $('wKind').value = info.kind === 's' ? 's' : 'f';
  const url = info.url || PS.normalizeUrl(tab.url);

  const form = () => ({ t: $('wTitle').value, y: $('wYear').value, k: $('wKind').value, u: url });
  let state = { mode: 'none' };
  let ticket = 0;

  async function refresh(message) {
    const mine = ++ticket;
    const rec = form();
    const btn = $('wAction');
    let next;
    if (!rec.t.trim()) {
      next = { mode: 'none', label: 'Ajouter à ma liste', text: '' };
    } else {
      const id = PS.makeId(PS.watch.clean(rec));
      const ex = await PS.watch.get(id).catch(() => null);
      if (!ex) next = { mode: 'add', rec, label: 'Ajouter à ma liste', text: '' };
      else if (!ex.v) next = { mode: 'seen', id, label: 'Marquer comme vu', text: 'Déjà dans ta liste (à voir).' };
      else next = { mode: 'unseen', id, label: 'Remettre à voir', text: `Vu le ${PS.fmtDate(ex.v)}.` };
    }
    if (mine !== ticket) return; // une saisie plus récente a pris le relais
    state = next;
    btn.textContent = next.label;
    btn.disabled = next.mode === 'none';
    $('wMsg').textContent = message || next.text;
  }

  $('wAction').onclick = async () => {
    $('wAction').disabled = true;
    try {
      let msg = '';
      if (state.mode === 'add') {
        await PS.watch.add(state.rec);
        msg = '✓ Ajouté à ta liste.';
      } else if (state.mode === 'seen') {
        await PS.watch.setSeen(state.id, true);
        msg = '✓ Marqué comme vu.';
      } else if (state.mode === 'unseen') {
        await PS.watch.setSeen(state.id, false);
        msg = '✓ Remis dans les titres à voir.';
      }
      await refresh(msg);
      updateCount();
    } catch (e) {
      $('wMsg').textContent = PS.errorMessage(e);
      $('wAction').disabled = false;
    }
  };

  let t = null;
  for (const id of ['wTitle', 'wYear', 'wKind']) {
    $(id).addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => refresh(), 150);
    });
  }
  refresh();
}
