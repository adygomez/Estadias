/**
 * Carga parciales /partials/header.html y /partials/footer.html en #site-header y #site-footer.
 * Emite el evento document "site:shell-ready" cuando ambos fragmentos (si existen) están insertados.
 */
(function () {
  function initMobileNav() {
    window.toggleMobileMenu = function () {
      var mobileMenu = document.getElementById('mobile-menu');
      var btn = document.getElementById('nav-burger');
      if (!mobileMenu) return;
      mobileMenu.classList.toggle('hidden');
      var open = !mobileMenu.classList.contains('hidden');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    var panel = document.getElementById('mobile-menu');
    if (!panel) return;
    panel.querySelectorAll('a[href]').forEach(function (a) {
      a.addEventListener('click', function () {
        panel.classList.add('hidden');
        var btn = document.getElementById('nav-burger');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function loadInto(el, url) {
    if (!el) return Promise.resolve();
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return r.text();
      })
      .then(function (html) {
        el.innerHTML = html;
      });
  }

  function run() {
    var headerMount = document.getElementById('site-header');
    var footerMount = document.getElementById('site-footer');
    if (!headerMount && !footerMount) {
      document.dispatchEvent(new CustomEvent('site:shell-ready'));
      return;
    }

    var tasks = [];
    if (headerMount) tasks.push(loadInto(headerMount, '/partials/header.html'));
    if (footerMount) tasks.push(loadInto(footerMount, '/partials/footer.html'));

    Promise.all(tasks)
      .then(function () {
        initMobileNav();
        document.dispatchEvent(new CustomEvent('site:shell-ready'));
      })
      .catch(function (err) {
        console.error('site-shell:', err);
        document.dispatchEvent(new CustomEvent('site:shell-ready'));
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
