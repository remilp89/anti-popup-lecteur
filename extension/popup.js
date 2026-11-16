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

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
})();
