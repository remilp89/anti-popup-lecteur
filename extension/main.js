// Tourne dans le contexte de la page (world MAIN) : neutralise les ouvertures de popups.
(() => {
  if (window.__psInstalled) return;
  window.__psInstalled = true;

  // Protection active dès le premier octet si le site l'était à la visite précédente
  // (la config officielle arrive ensuite, de façon asynchrone, via content.js).
  let enabled = false;
  try {
    enabled = localStorage.getItem('__ps_on') === '1';
  } catch (_) {}

  window.addEventListener('ps:cfg', (e) => {
    try {
      enabled = !!JSON.parse(e.detail).enabled;
    } catch (_) {}
  });

  // Actif si la config nous l'a dit, ou si la page parente (même origine) est active :
  // un iframe about:blank créé par une régie n'a pas encore reçu sa config au moment d'agir.
  const on = () => {
    if (enabled) return true;
    try {
      return window.parent !== window && !!window.parent.__psEnabled;
    } catch (_) {
      return false;
    }
  };
  try {
    Object.defineProperty(window, '__psEnabled', { get: on, configurable: true });
  } catch (_) {}

  const report = (kind) => {
    try {
      window.dispatchEvent(new CustomEvent('ps:blocked', { detail: JSON.stringify({ kind }) }));
    } catch (_) {}
  };

  const noop = () => {};
  // Faux objet fenêtre pour que le script de la page ne détecte pas le blocage.
  const fakeWindow = () => ({
    closed: false,
    focus: noop,
    blur: noop,
    close: noop,
    postMessage: noop,
    document: { write: noop, writeln: noop, open: noop, close: noop },
    location: { href: '', assign: noop, replace: noop },
  });

  const isNewTabTarget = (t) => /^_(blank|new)$/i.test(t || '');
  const isCrossOrigin = (a) => {
    try {
      return new URL(a.href, a.ownerDocument.location.href).origin !== a.ownerDocument.location.origin;
    } catch (_) {
      return false;
    }
  };

  // Applique les blocages à une fenêtre (la nôtre, ou celle d'un iframe same-origin).
  // Les régies créent un iframe vide et appellent SON window.open pour contourner le nôtre.
  function patchWindow(win) {
    try {
      if (!win || win.__psPatched) return;
      win.__psPatched = true;

      const realOpen = win.open;
      win.open = function (...args) {
        if (!on()) return realOpen.apply(this, args);
        report('window.open');
        return fakeWindow();
      };

      // <a target="_blank"> créé à la volée puis cliqué par script
      const A = win.HTMLAnchorElement && win.HTMLAnchorElement.prototype;
      if (A) {
        const realClick = A.click;
        A.click = function (...args) {
          if (on() && (isNewTabTarget(this.target) || isCrossOrigin(this))) {
            report('anchor.click');
            return;
          }
          return realClick.apply(this, args);
        };
      }

      // dispatchEvent(new MouseEvent('click')) sur un <a> (souvent détaché du DOM, donc invisible
      // pour un écouteur posé sur window) => ouverture d'onglet ou redirection publicitaire.
      const ET = win.EventTarget && win.EventTarget.prototype;
      if (ET) {
        const realDispatch = ET.dispatchEvent;
        ET.dispatchEvent = function (ev) {
          try {
            if (on() && ev && ev.type === 'click' && !ev.isTrusted && this instanceof win.HTMLAnchorElement) {
              const newTab = isNewTabTarget(this.target) || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1;
              if (newTab || isCrossOrigin(this)) {
                report('anchor.dispatch');
                return false;
              }
            }
          } catch (_) {}
          return realDispatch.apply(this, arguments);
        };
      }

      // <form target="_blank"> soumis par script
      const F = win.HTMLFormElement && win.HTMLFormElement.prototype;
      if (F) {
        const realSubmit = F.submit;
        F.submit = function (...args) {
          if (on() && /^_(blank|new)$/i.test(this.target || '')) {
            report('form.submit');
            return;
          }
          return realSubmit.apply(this, args);
        };
      }

      // Clics simulés (dispatchEvent) sur un lien : nouvel onglet (target=_blank, Ctrl/Cmd/Maj)
      // ou redirection vers un autre domaine = publicité.
      win.addEventListener(
        'click',
        (e) => {
          if (!on() || e.isTrusted) return;
          const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (!a) return;
          const newTab = isNewTabTarget(a.target) || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;
          if (newTab || isCrossOrigin(a)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            report('synthetic.click');
          }
        },
        true
      );
    } catch (_) {}
  }

  patchWindow(window);

  // Redirection de la page entière vers un autre domaine par script (location.href / assign),
  // sans vrai clic sur un lien : c'est le piège « popunder inversé ». location.assign ne peut pas
  // être remplacé, mais l'API Navigation permet d'annuler la navigation.
  try {
    if (window.navigation && window === window.top) {
      window.navigation.addEventListener('navigate', (e) => {
        if (!on() || e.userInitiated || !e.cancelable) return;
        if (e.navigationType === 'traverse' || e.navigationType === 'reload') return;
        try {
          if (new URL(e.destination.url).origin !== location.origin) {
            e.preventDefault();
            report('navigate');
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  // Dès que la page accède à la fenêtre d'un iframe, on la patche avant qu'elle ne s'en serve.
  try {
    const proto = HTMLIFrameElement.prototype;
    const cw = Object.getOwnPropertyDescriptor(proto, 'contentWindow');
    if (cw && cw.get) {
      Object.defineProperty(proto, 'contentWindow', {
        configurable: true,
        enumerable: cw.enumerable,
        get() {
          const w = cw.get.call(this);
          patchWindow(w);
          return w;
        },
      });
    }
    const cd = Object.getOwnPropertyDescriptor(proto, 'contentDocument');
    if (cd && cd.get) {
      Object.defineProperty(proto, 'contentDocument', {
        configurable: true,
        enumerable: cd.enumerable,
        get() {
          const d = cd.get.call(this);
          if (d) patchWindow(d.defaultView);
          return d;
        },
      });
    }
  } catch (_) {}

  // Demande la config à l'écouteur isolé (au cas où il ait chargé avant nous).
  window.dispatchEvent(new CustomEvent('ps:hello'));
})();
