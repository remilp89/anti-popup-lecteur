const $ = (id) => document.getElementById(id);

let items = [];
const view = { status: 'todo', kind: 'all', q: '' };
let undo = null;
let snackTimer = null;

const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
};

// --- Filtrage et tri ---------------------------------------------------------
function visible() {
  const q = PS.norm(view.q);
  const list = items.filter((it) => {
    if (view.status === 'todo' && it.v) return false;
    if (view.status === 'seen' && !it.v) return false;
    if (view.kind !== 'all' && it.k !== view.kind) return false;
    if (q && !PS.norm(`${it.t} ${it.y || ''}`).includes(q)) return false;
    return true;
  });
  const byTodo = (a, b) => b.a - a.a; // ajoutés récemment en premier
  const bySeen = (a, b) => b.v - a.v; // vus récemment en premier
  if (view.status === 'todo') return list.sort(byTodo);
  if (view.status === 'seen') return list.sort(bySeen);
  return [...list.filter((i) => !i.v).sort(byTodo), ...list.filter((i) => i.v).sort(bySeen)];
}

// --- Affichage ---------------------------------------------------------------
function row(it) {
  const li = document.createElement('li');
  li.className = 'watch' + (it.v ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!it.v;
  cb.setAttribute('aria-label', (it.v ? 'Remettre à voir : ' : 'Marquer comme vu : ') + it.t);
  cb.onchange = async () => {
    try {
      await PS.watch.setSeen(it.id, cb.checked);
    } catch (e) {
      flash(PS.errorMessage(e));
    }
  };

  const info = document.createElement('div');
  info.className = 'grow';
  const title = document.createElement('div');
  title.className = 'wtitle';
  title.append(document.createTextNode(it.t));
  if (it.y) {
    const y = document.createElement('span');
    y.className = 'year';
    y.textContent = ` (${it.y})`;
    title.append(y);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  const bits = [`ajouté le ${PS.fmtDate(it.a)}`];
  if (it.u) bits.push(hostOf(it.u));
  if (it.v) bits.push(`vu le ${PS.fmtDate(it.v)}`);
  meta.textContent = bits.join(' · ');
  info.append(title, meta);

  const badge = document.createElement('span');
  badge.className = 'badge' + (it.k === 's' ? ' serie' : '');
  badge.textContent = it.k === 's' ? 'Série' : 'Film';

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  if (it.u) {
    const open = document.createElement('a');
    open.className = 'btn';
    open.href = it.u;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Ouvrir';
    actions.append(open);
  }
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'remove';
  rm.textContent = 'Retirer';
  rm.onclick = async () => {
    const { id, ...value } = it;
    await PS.watch.remove(id);
    showUndo(`« ${it.t} » retiré`, () => PS.watch.restore(id, value));
  };
  actions.append(rm);

  li.append(cb, info, badge, actions);
  return li;
}

function render() {
  const list = $('list');
  list.textContent = '';
  const shown = visible();
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.style.display = 'block';
    li.textContent = items.length
      ? 'Aucun titre ne correspond à ce filtre.'
      : 'Ta liste est vide. Ouvre la page d\'un film ou d\'une série, clique sur l\'icône de l\'extension puis sur « Ajouter à ma liste ».';
    list.append(li);
  }
  for (const it of shown) list.append(row(it));

  $('nTodo').textContent = String(items.filter((i) => !i.v).length);
  $('nSeen').textContent = String(items.filter((i) => i.v).length);
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === view.status)));
}

async function renderUsage() {
  const { bytes, quota } = await PS.watch.usage();
  const pct = Math.round((bytes / quota) * 100);
  const usage = $('usage');
  usage.textContent = `${items.length} titre${items.length > 1 ? 's' : ''} · ${(bytes / 1024).toFixed(1)} Ko sur ${Math.round(quota / 1024)} Ko de synchronisation (${pct} %)`;
  const bar = document.createElement('progress');
  bar.max = quota;
  bar.value = bytes;
  usage.append(bar);
  if (pct >= 80) {
    usage.append(document.createTextNode(' : presque plein, pense à retirer des titres déjà vus.'));
  }
}

async function load() {
  items = await PS.watch.list();
  render();
  renderUsage();
}

// --- Messages ----------------------------------------------------------------
function flash(text) {
  $('err').textContent = text;
}

function showUndo(text, fn) {
  undo = fn;
  $('snackText').textContent = text;
  $('snack').hidden = false;
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => {
    $('snack').hidden = true;
    undo = null;
  }, 7000);
}
$('snackUndo').onclick = async () => {
  const fn = undo;
  undo = null;
  $('snack').hidden = true;
  clearTimeout(snackTimer);
  if (fn) await fn();
};

// --- Ajout manuel ------------------------------------------------------------
$('add').onsubmit = async (e) => {
  e.preventDefault();
  flash('');
  try {
    const res = await PS.watch.add({ t: $('wTitle').value, y: $('wYear').value, k: $('wKind').value });
    if (res.status === 'exists') {
      flash('Ce titre est déjà dans ta liste.');
      return;
    }
    $('wTitle').value = '';
    $('wYear').value = '';
    $('wTitle').focus();
  } catch (err) {
    flash(PS.errorMessage(err));
  }
};

for (const id of ['wTitle', 'wYear', 'wKind']) $(id).addEventListener('input', () => flash(''));

// --- Filtres -----------------------------------------------------------------
document.querySelectorAll('.seg button').forEach((b) => {
  b.onclick = () => {
    view.status = b.dataset.status;
    render();
  };
});
$('fKind').onchange = () => {
  view.kind = $('fKind').value;
  render();
};
$('fQuery').oninput = () => {
  view.q = $('fQuery').value;
  render();
};

// --- Export / import ---------------------------------------------------------
$('export').onclick = () => {
  const data = {
    format: 'anti-popup-lecteur/a-regarder',
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map(({ id, ...v }) => v),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `a-regarder-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('toolMsg').textContent = `${items.length} titre${items.length > 1 ? 's' : ''} exporté${items.length > 1 ? 's' : ''}.`;
};

$('import').onclick = () => $('file').click();
$('file').onchange = async () => {
  const file = $('file').files[0];
  $('file').value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(arr)) throw new Error('format');
    const r = await PS.watch.importItems(arr);
    $('toolMsg').textContent = `Import terminé : ${r.added} ajouté${r.added > 1 ? 's' : ''}, ${r.updated} mis à jour, ${r.skipped} déjà présent${r.skipped > 1 ? 's' : ''}${r.invalid ? `, ${r.invalid} ignoré${r.invalid > 1 ? 's' : ''}` : ''}.`;
  } catch (e) {
    $('toolMsg').textContent = /format|JSON/i.test(String(e.message)) ? 'Fichier non reconnu.' : PS.errorMessage(e);
  }
};

$('version').textContent = 'Version ' + chrome.runtime.getManifest().version;

// Mise à jour en direct : ajouts depuis la fenêtre de l'extension, ou depuis un autre ordinateur (synchro).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && Object.keys(changes).some((k) => k.startsWith('w:'))) load();
});
load();
