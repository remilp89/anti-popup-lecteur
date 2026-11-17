// Contexte isolé, injecté dans toutes les frames : reclic automatique + plein écran.
(() => {
  let cfg = { enabled: false, fullscreen: true, maxRetries: 6 };
  const last = { t: 0, x: 0, y: 0 };
  let retries = 0;
  let timer = null;
  let sessionPlaying = false;
  let pendingFs = null;

  const send = (msg) => {
    try {
      return chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (_) {
      return Promise.resolve();
    }
  };

  const pushCfg = () =>
    window.dispatchEvent(new CustomEvent('ps:cfg', { detail: JSON.stringify({ enabled: cfg.enabled }) }));

  // Le service worker peut dormir : la 1re requête échoue parfois. Sans config la protection
  // restait éteinte pour toute la page, donc on réessaie avec un délai croissant.
  (async () => {
    for (let i = 0; i < 8; i++) {
      const c = await send({ type: 'getConfig' });
      if (c && typeof c.enabled === 'boolean') {
        cfg = c;
        try {
          // Cache lu de façon synchrone par main.js dès le prochain chargement (avant tout script de la page).
          localStorage.setItem('__ps_on', c.enabled ? '1' : '0');
        } catch (_) {}
        pushCfg();
        if (cfg.enabled) startOverlayCleaner();
        return;
      }
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  })();

  // --- Suppression des « click-traps » : couches transparentes plein écran posées par les régies
  // par-dessus le lecteur (position fixe, z-index énorme, aucun texte/image). Chaque clic tombait
  // dessus au lieu du lecteur, ce qui obligeait à cliquer plusieurs fois.
  function isClickTrap(el) {
    if (el.id === '__ps' || el.tagName === 'VIDEO' || el.tagName === 'HTML' || el.tagName === 'BODY') return false;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    if ((parseInt(cs.zIndex, 10) || 0) < 1000000) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 100 || r.height < 80) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const transparent =
      parseFloat(cs.opacity) < 0.05 ||
      ((/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(cs.backgroundColor) || !cs.backgroundColor) &&
        cs.backgroundImage === 'none');
    if (!transparent) return false;
    if ((el.innerText || '').trim()) return false; // vrai contenu (bandeau cookies, modale…)
    if (el.querySelector('img, video, canvas, svg, button, input, a[href]:not([href^="#"])')) return false;
    return true;
  }

  function sweepOverlays() {
    if (!document.body) return;
    for (const el of document.querySelectorAll('[style*="z-index"]')) {
      try {
        if (isClickTrap(el)) el.remove();
      } catch (_) {}
    }
  }

  let cleaning = false;
  function startOverlayCleaner() {
    if (cleaning) return;
    cleaning = true;

    const check = (el) => {
      try {
        if (isClickTrap(el)) el.remove();
      } catch (_) {}
    };
    const checkTree = (n) => {
      if (n.nodeType !== 1) return;
      check(n);
      if (n.querySelectorAll) n.querySelectorAll('[style*="z-index"]').forEach(check);
    };

    // Sans délai : la régie recrée la couche dès que la souris bouge, juste avant le clic.
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') checkTree(r.target);
        else r.addedNodes.forEach(checkTree);
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Filet de sécurité : balayage complet périodique + au moindre mouvement de souris.
    sweepOverlays();
    setInterval(sweepOverlays, 500);
    let lastMove = 0;
    window.addEventListener(
      'pointermove',
      () => {
        const n = Date.now();
        if (n - lastMove > 100) {
          lastMove = n;
          sweepOverlays();
        }
      },
      true
    );
  }

  const anyVideoPlaying = () =>
    [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended && v.currentTime > 0);

  // Vrai appui/clic utilisateur. Les régies ouvrent souvent le popup dès le `mousedown`,
  // AVANT l'événement `click` : on écoute donc aussi `pointerdown`/`mousedown`.
  function onUserPress(e) {
    if (!cfg.enabled || !e.isTrusted) return;

    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      send({ type: 'intent' }); // l'utilisateur veut vraiment ouvrir un onglet
      return;
    }
    last.t = Date.now();
    last.x = e.clientX;
    last.y = e.clientY;
    if (e.type !== 'click') {
      retries = 0;
      if (!anyVideoPlaying()) sessionPlaying = false;
    }
    send({ type: 'click' });
  }
  for (const type of ['pointerdown', 'mousedown', 'click']) {
    window.addEventListener(type, onUserPress, true);
  }

  // Plein écran en attente (la lecture a démarré sans geste utilisateur valide)
  window.addEventListener(
    'click',
    (e) => {
      if (!cfg.enabled || !e.isTrusted || !pendingFs) return;
      const v = pendingFs;
      pendingFs = null;
      enterFullscreen(v, true);
    },
    true
  );

  window.addEventListener(
    'auxclick',
    (e) => {
      if (cfg.enabled && e.isTrusted) send({ type: 'intent' });
    },
    true
  );

  function onBlocked() {
    if (!cfg.enabled || sessionPlaying) return;
    if (Date.now() - last.t > 3000) return; // ce n'est pas notre frame qui a cliqué
    if (timer || retries >= cfg.maxRetries) return;
    timer = setTimeout(() => {
      timer = null;
      reclick();
    }, 350);
  }

  function reclick() {
    if (sessionPlaying || anyVideoPlaying() || retries >= cfg.maxRetries) return;
    retries++;
    last.t = Date.now();
    send({ type: 'click' }); // garde la fenêtre « clic récent » ouverte côté background

    const el = document.elementFromPoint(last.x, last.y);
    if (!el) return;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: last.x,
      clientY: last.y,
      button: 0,
    };
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ctor(type, base));
    }
  }

  window.addEventListener('ps:blocked', () => {
    send({ type: 'stat' });
    onBlocked();
  });

  // La fenêtre de l'extension demande le titre / l'année / le type de la page ouverte.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'pageInfo' || window !== window.top) return;
    try {
      sendResponse(PS.readPage(document, location));
    } catch (_) {
      sendResponse(null);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'popup-blocked') onBlocked();
    else if (msg.type === 'playing') {
      sessionPlaying = true;
      clearTimeout(timer);
      timer = null;
    }
  });

  // La vidéo démarre : on arrête de recliquer et on passe en plein écran.
  window.addEventListener(
    'playing',
    async (e) => {
      const v = e.target;
      if (!cfg.enabled || !(v instanceof HTMLVideoElement)) return;
      const r = v.getBoundingClientRect();
      if (r.width < 200 || r.height < 120) return; // ignore les mini-vidéos décoratives
      // Ignore les lectures automatiques (bande-annonce muette…) : il faut un vrai clic récent.
      const recent =
        navigator.userActivation?.isActive ||
        Date.now() - last.t < 8000 ||
        (await send({ type: 'recentClick' }))?.recent;
      if (!recent) return;
      sessionPlaying = true;
      clearTimeout(timer);
      timer = null;
      send({ type: 'playing' });
      if (cfg.fullscreen) enterFullscreen(v, false);
    },
    true
  );

  // Choisit le conteneur du lecteur (pour garder ses contrôles) plutôt que la balise <video> nue.
  function playerContainer(video) {
    const vr = video.getBoundingClientRect();
    let el = video;
    while (el.parentElement && el.parentElement !== document.body) {
      const pr = el.parentElement.getBoundingClientRect();
      if (pr.width * pr.height > vr.width * vr.height * 1.3) break;
      el = el.parentElement;
    }
    return el;
  }

  async function enterFullscreen(video, isRetry) {
    if (document.fullscreenElement) return;
    try {
      await playerContainer(video).requestFullscreen();
    } catch (_) {
      if (!isRetry) pendingFs = video; // réessaie au prochain vrai clic
    }
  }
})();
