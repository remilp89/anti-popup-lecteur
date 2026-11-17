// Fonctions partagées (script de contenu, fenêtre de l'extension, pages) :
// détection du titre / de l'année / du type d'une page, et liste « À regarder plus tard ».
(() => {
  'use strict';
  if (self.PS) return;

  const PS = {};

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  PS.norm = norm;

  // Empreinte courte et stable (cyrb53) : identifiant d'un titre.
  const hash = (str) => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };

  // Même titre + même année + même type = même entrée, quel que soit le site.
  PS.makeId = ({ t, y, k }) => hash(`${k}|${norm(t)}|${y || ''}`);

  PS.fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('fr-FR') : '');

  // Adresse sans ancre ni paramètres de suivi (mais en gardant ceux qui identifient la page).
  PS.normalizeUrl = (u) => {
    try {
      const url = new URL(u);
      if (!/^https?:$/.test(url.protocol)) return '';
      url.hash = '';
      for (const k of [...url.searchParams.keys()]) {
        if (/^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i.test(k)) url.searchParams.delete(k);
      }
      return url.href.slice(0, 250);
    } catch (_) {
      return '';
    }
  };

  // ---------------------------------------------------------------------------
  // Nettoyage du titre
  // ---------------------------------------------------------------------------
  const BOILERPLATE_TAIL = /\s+(?:en\s+)?(?:streaming|t[ée]l[ée]charger|download)\b.*$/i;
  const TAGS_TAIL = /(?:\s+(?:vf|vostfr|vo|hd|complet|gratuit))+\s*$/i;
  const VERB_PREFIX = /^\s*(?:regarder|voir|watch)\s+(?:(?:le|la|les)\s+)?(?:film|s[ée]rie|anime|[ée]pisode)\s*[:\-–]?\s*/i;
  const SITE_WORDS = /streaming|vostfr|\bvf\b|gratuit|t[ée]l[ée]charg|\.(?:com|net|org|lol|run|vc|to|tv|cc|me|io|fr)\b/i;

  const letters = (s) => norm(s).replace(/ /g, '');

  // Retire le nom du site collé au titre (« Titre » Site », « Titre | Site », « Titre - Site »).
  // `names` : noms possibles du site (domaine, og:site_name…).
  function stripSite(s, names) {
    s = s.split(/\s+[»|•·]\s+/)[0];
    const parts = s.split(/\s+[-–—]\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      const l = letters(last);
      const isName = names.some((n) => {
        const ln = letters(n);
        return ln.length >= 4 && l.length >= 3 && (l.includes(ln) || ln === l);
      });
      const isSeason = /^(?:saison|season|s\d{1,2}\b|[ée]pisode|ep\b)/i.test(last);
      if ((SITE_WORDS.test(last) || isName) && !isSeason) parts.pop();
    }
    return parts.join(' - ');
  }

  // Extrait l'année si elle est entre parenthèses ou en fin de titre (évite « 2001 : L'Odyssée… »).
  function splitYear(s) {
    let year = 0;
    let m = s.match(/\(\s*((?:19|20)\d{2})\s*\)/);
    if (m) {
      year = Number(m[1]);
      s = s.replace(m[0], ' ');
    } else if ((m = s.match(/\s[-–—]\s*((?:19|20)\d{2})\s*$/))) {
      year = Number(m[1]);
      s = s.replace(m[0], '');
    }
    return { title: s, year };
  }

  PS.cleanTitle = (raw, host, siteName) => {
    const names = [String(host || '').replace(/^www\./, '').split('.')[0], siteName].filter(Boolean);
    let s = String(raw || '').replace(/\s+/g, ' ').trim();
    s = stripSite(s, names);
    s = s.replace(VERB_PREFIX, '');
    s = s.replace(BOILERPLATE_TAIL, '');
    // Le nom du site peut rester après retrait de l'année : « Titre (2023) - Site ».
    const split = splitYear(s);
    s = stripSite(split.title.trim(), names);
    const title = s;
    const year = split.year;
    s = title.replace(TAGS_TAIL, '').replace(/\s+/g, ' ').replace(/[\s\-–—:|»•·]+$/, '').trim();
    return { title: s.slice(0, 120), year };
  };

  // ---------------------------------------------------------------------------
  // Type : film ('f') ou série ('s')
  // ---------------------------------------------------------------------------
  const SERIES_URL = /(?:^|\/)(?:tv|series?|serie-en-streaming|tv-?shows?|saisons?)(?:\/|-|$)|[-/_]saison[-_]?\d+|[-/_]season[-_]?\d+|[-/_]s\d{1,2}e\d{1,2}/i;
  const FILM_URL = /(?:^|\/)(?:movies?|films?|film-en-streaming)(?:\/|-|$)/i;
  const SERIES_TEXT = /\b(?:saison|season)\s*\d+|\bs\d{1,2}\s?e\d{1,2}\b|[ée]pisode\s*\d+/i;

  // Ordre : balisage structuré > adresse > texte du titre > og:type > film par défaut.
  // L'adresse passe avant og:type : certains sites déclarent « video.movie » même pour les séries.
  PS.detectKind = ({ ldType = '', path = '', text = '', ogType = '' }) => {
    if (/TV(?:Series|Season|Episode)/i.test(ldType)) return 's';
    if (/Movie|Film/i.test(ldType)) return 'f';
    if (SERIES_URL.test(path)) return 's';
    if (FILM_URL.test(path)) return 'f';
    if (SERIES_TEXT.test(text)) return 's';
    if (/tv_show|tv_episode/i.test(ogType)) return 's';
    return 'f';
  };

  // Année repérée dans le texte de la page (« Année : 2017 », « Date de sortie : 2017 »…).
  PS.yearFromText = (text) => {
    const m = String(text || '').match(
      /(?:ann[ée]e(?:\s+de\s+(?:production|sortie))?|date\s+de\s+sortie|sortie|release(?:d)?(?:\s+date)?|year)\s*[:：\-]?\s*(?:[^\d\n]{0,20})?((?:19|20)\d{2})/i
    );
    return m ? Number(m[1]) : 0;
  };

  // ---------------------------------------------------------------------------
  // Lecture d'une page (script de contenu)
  // ---------------------------------------------------------------------------
  function ldInfo(doc) {
    let type = '';
    let name = '';
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try {
        data = JSON.parse(s.textContent);
      } catch (_) {
        continue;
      }
      const nodes = [].concat(data && data['@graph'] ? data['@graph'] : data || []);
      for (const n of nodes) {
        const t = [].concat((n && n['@type']) || []).join(',');
        if (/Movie|TVSeries|TVSeason|TVEpisode|Film/i.test(t)) {
          type = type || t;
          if (!name && n.name && !/TVEpisode/i.test(t)) name = String(n.name);
        }
      }
    }
    return { type, name };
  }

  PS.readPage = (doc = document, loc = location) => {
    const meta = (p) => {
      const el = doc.querySelector(`meta[property="${p}"]`) || doc.querySelector(`meta[name="${p}"]`);
      return (el && el.content) || '';
    };
    const ld = ldInfo(doc);
    const h1 = (doc.querySelector('h1') || {}).innerText || '';
    let raw = ld.name || meta('og:title') || h1 || doc.title || '';
    const h = h1.replace(/\s+/g, ' ').trim();
    // Le <h1> est souvent déjà le titre propre : on le préfère quand le titre long le contient en tête.
    if (h.length >= 2 && norm(raw) !== norm(h) && norm(raw).startsWith(norm(h))) raw = h;
    const host = loc.hostname.replace(/^www\./, '');
    const { title, year } = PS.cleanTitle(raw, host, meta('og:site_name') || meta('application-name'));
    const text = (doc.body && doc.body.innerText ? doc.body.innerText : '').slice(0, 4000);
    const kind = PS.detectKind({
      ldType: ld.type,
      path: loc.pathname,
      text: `${raw} ${doc.title}`,
      ogType: meta('og:type'),
    });
    return {
      title,
      year: year || PS.yearFromText(text),
      kind,
      url: PS.normalizeUrl(loc.href),
      host,
      structured: !!ld.type || /video\./i.test(meta('og:type')),
    };
  };

  // Repli quand le script de contenu n'est pas disponible (page ouverte avant l'installation, etc.).
  PS.infoFromTab = (tab) => {
    let host = '';
    let path = '';
    try {
      const u = new URL(tab.url);
      host = u.hostname.replace(/^www\./, '');
      path = u.pathname;
    } catch (_) {}
    const { title, year } = PS.cleanTitle(tab.title || '', host);
    return {
      title,
      year,
      kind: PS.detectKind({ path, text: tab.title || '' }),
      url: PS.normalizeUrl(tab.url || ''),
      host,
      structured: false,
    };
  };

  // ---------------------------------------------------------------------------
  // Liste « À regarder plus tard » : chrome.storage.sync, UNE clé par titre
  // (deux ordinateurs qui ajoutent des titres différents ne s'écrasent donc jamais).
  // Valeur : { t: titre, y: année, k: 'f'|'s', u: adresse, a: ajouté le, v: vu le (0 = pas vu) }
  // ---------------------------------------------------------------------------
  const PREFIX = 'w:';
  const area = () => chrome.storage.sync;
  const watch = {};
  PS.watch = watch;

  const clean = (r) => ({
    t: String(r.t || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    y: Number(r.y) >= 1900 && Number(r.y) <= 2100 ? Math.trunc(Number(r.y)) : 0,
    k: r.k === 's' ? 's' : 'f',
    u: r.u ? String(r.u).slice(0, 250) : '',
    a: Number(r.a) > 0 ? Number(r.a) : Date.now(),
    v: Number(r.v) > 0 ? Number(r.v) : 0,
  });
  watch.clean = clean;

  watch.get = async (id) => {
    const key = PREFIX + id;
    return (await area().get(key))[key] || null;
  };

  watch.list = async () => {
    const all = await area().get(null);
    return Object.entries(all)
      .filter(([k, v]) => k.startsWith(PREFIX) && v && typeof v === 'object')
      .map(([k, v]) => ({ id: k.slice(PREFIX.length), ...v }));
  };

  watch.add = async (rec) => {
    const item = clean({ ...rec, a: Date.now(), v: 0 });
    if (!item.t) throw new Error('empty-title');
    const id = PS.makeId(item);
    if (await watch.get(id)) return { status: 'exists', id };
    await area().set({ [PREFIX + id]: item });
    return { status: 'added', id };
  };

  watch.setSeen = async (id, seen) => {
    const cur = await watch.get(id);
    if (!cur) return;
    await area().set({ [PREFIX + id]: { ...cur, v: seen ? Date.now() : 0 } });
  };

  watch.remove = (id) => area().remove(PREFIX + id);

  // Remet une entrée telle quelle (annulation d'une suppression).
  watch.restore = (id, item) => area().set({ [PREFIX + id]: clean(item) });

  // Fusion d'un export : n'écrase jamais l'existant, mais récupère un « vu » manquant.
  watch.importItems = async (rawItems) => {
    const existing = await area().get(null);
    const toSet = {};
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let invalid = 0;
    for (const raw of rawItems) {
      if (!raw || typeof raw.t !== 'string' || !raw.t.trim()) {
        invalid++;
        continue;
      }
      const item = clean(raw);
      const key = PREFIX + PS.makeId(item);
      const cur = toSet[key] || existing[key];
      if (!cur) {
        toSet[key] = item;
        added++;
      } else if (!cur.v && item.v) {
        toSet[key] = { ...cur, v: item.v };
        updated++;
      } else {
        skipped++;
      }
    }
    if (Object.keys(toSet).length) await area().set(toSet);
    return { added, updated, skipped, invalid };
  };

  watch.usage = async () => ({
    bytes: await area().getBytesInUse(null),
    quota: area().QUOTA_BYTES || 102400,
  });

  PS.errorMessage = (e) => {
    const m = String((e && e.message) || e || '');
    if (/QUOTA|MAX_ITEMS/i.test(m)) {
      return 'Espace de synchronisation plein : retire des titres déjà vus pour continuer.';
    }
    if (/empty-title/.test(m)) return 'Saisis un titre.';
    return 'Erreur : ' + m;
  };

  self.PS = PS;
})();
