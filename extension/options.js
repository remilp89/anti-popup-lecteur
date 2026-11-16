const $ = (id) => document.getElementById(id);

// Lien vers le site (nouvel onglet, sans transmettre l'onglet d'origine).
function siteLink(host, text, cls) {
  const a = document.createElement('a');
  a.href = 'https://' + host + '/';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = cls;
  a.textContent = text;
  a.title = 'Ouvrir ' + host;
  return a;
}

let hosts = [];
let stats = {};

function normalize(input) {
  let v = String(input || '').trim().toLowerCase();
  if (!v) return '';
  try {
    v = new URL(/^[a-z]+:\/\//.test(v) ? v : 'https://' + v).hostname;
  } catch (_) {
    return '';
  }
  v = v.replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : '';
}

function render() {
  const list = $('list');
  list.textContent = '';

  if (!hosts.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Aucun site protégé pour le moment.';
    list.appendChild(li);
  }

  for (const h of hosts) {
    const li = document.createElement('li');

    const info = document.createElement('div');
    info.className = 'grow';
    const name = document.createElement('div');
    name.append(siteLink(h, h, 'name'));
    info.append(name);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Protégé';

    const count = document.createElement('div');
    count.className = 'count';
    const b = document.createElement('b');
    b.textContent = String(stats[h] || 0);
    const lbl = document.createElement('span');
    lbl.textContent = 'blocages';
    count.append(b, lbl);

    const rm = document.createElement('button');
    rm.className = 'remove';
    rm.textContent = 'Retirer';
    rm.onclick = async () => {
      hosts = hosts.filter((x) => x !== h);
      await chrome.storage.sync.set({ enabledHosts: hosts });
      render();
    };

    li.append(info, badge, count, rm);
    list.appendChild(li);
  }

  $('nSites').textContent = String(hosts.length);
  $('nBlocked').textContent = String(hosts.reduce((n, h) => n + (stats[h] || 0), 0));
}

async function load() {
  const s = await chrome.storage.sync.get({ enabledHosts: [] });
  const l = await chrome.storage.local.get({ stats: {} });
  hosts = s.enabledHosts;
  stats = l.stats;
  render();
}

$('add').onsubmit = async (e) => {
  e.preventDefault();
  // Plusieurs domaines possibles, séparés par des espaces, virgules ou retours à la ligne.
  const raw = $('host').value.split(/[\s,;]+/).filter(Boolean);
  const valid = [];
  const invalid = [];
  for (const r of raw) {
    const h = normalize(r);
    if (h) valid.push(h);
    else invalid.push(r);
  }
  if (!raw.length || invalid.length) {
    $('err').textContent = 'Domaine invalide' + (invalid.length ? ' : ' + invalid.join(', ') : '') + '. Exemple : exemple.com';
    return;
  }
  const fresh = valid.filter((h, i) => !hosts.includes(h) && valid.indexOf(h) === i);
  if (!fresh.length) {
    $('err').textContent = 'Ce site est déjà protégé.';
    return;
  }
  $('err').textContent = '';
  hosts = [...hosts, ...fresh];
  await chrome.storage.sync.set({ enabledHosts: hosts });
  $('host').value = '';
  render();
};

$('version').textContent = 'Version ' + chrome.runtime.getManifest().version;

// Mise à jour en direct (compteurs, ajouts depuis la popup)
chrome.storage.onChanged.addListener(load);
load();
