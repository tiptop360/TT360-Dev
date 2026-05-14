/**
 * TipTop360 — Performance JS
 * Handles: lazy images, deferred video, INP optimisation, cart badge, back-to-top
 * Load order: defer (after HTML parsed, before DOMContentLoaded fires)
 */
(function () {
  'use strict';

  /* ─── 1. LAZY IMAGE OBSERVER ─────────────────────────────────────────── */
  if ('IntersectionObserver' in window) {
    var imgObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
            delete img.dataset.srcset;
          }
          img.removeAttribute('data-lazy-pending');
          img.setAttribute('data-lazy-loaded', '');
          imgObserver.unobserve(img);
        });
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    );

    function observeLazyImages() {
      document.querySelectorAll('img[data-lazy-pending]').forEach(function (img) {
        imgObserver.observe(img);
      });
    }
    observeLazyImages();

    /* Re-observe after dynamic content (cart drawer, quick-view, etc.) */
    var mutationObserver = new MutationObserver(function () {
      observeLazyImages();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    /* Fallback: eagerly load all lazy images */
    document.querySelectorAll('img[data-lazy-pending]').forEach(function (img) {
      if (img.dataset.src) img.src = img.dataset.src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    });
  }

  /* ─── 2. DEFERRED IFRAME / VIDEO EMBEDS ──────────────────────────────── */
  if ('IntersectionObserver' in window) {
    var iframeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (el.dataset.src) {
            el.src = el.dataset.src;
            delete el.dataset.src;
          }
          iframeObserver.unobserve(el);
        });
      },
      { rootMargin: '400px 0px' }
    );
    document.querySelectorAll('iframe[data-src]').forEach(function (el) {
      iframeObserver.observe(el);
    });
  }

  /* ─── 3. FONT DISPLAY SWAP POLYFILL (web font load event) ────────────── */
  if ('fonts' in document) {
    document.fonts.ready.then(function () {
      document.documentElement.classList.add('fonts-loaded');
    });
  }

  /* ─── 4. INTERACTION-TO-NEXT-PAINT (INP) HELPERS ────────────────────── */
  /* Yield to main thread before heavy handlers so click feels instant */
  function yieldToMain() {
    return new Promise(function (resolve) {
      if ('scheduler' in window && 'yield' in scheduler) {
        scheduler.yield().then(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /* Wrap add-to-cart buttons to show immediate feedback */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-cart], .product-form__submit');
    if (!btn || btn.dataset.ttHandled) return;
    btn.dataset.ttHandled = '1';
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Adding…';
    yieldToMain().then(function () {
      /* Restore state after Shopify's AJAX cart handler has had time to run */
      setTimeout(function () {
        btn.disabled = false;
        btn.textContent = originalText;
        delete btn.dataset.ttHandled;
      }, 2000);
    });
  }, { passive: true });

  /* ─── 5. CART ITEM COUNT BADGE ───────────────────────────────────────── */
  function refreshCartCount() {
    fetch('/cart.js')
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        document.querySelectorAll('[data-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count;
          el.setAttribute('aria-label', cart.item_count + ' items in cart');
          el.style.display = cart.item_count > 0 ? '' : 'none';
        });
      })
      .catch(function () {});
  }
  document.addEventListener('cart:updated', refreshCartCount);
  refreshCartCount();

  /* ─── 6. BACK-TO-TOP BUTTON ──────────────────────────────────────────── */
  var btt = document.getElementById('back-to-top');
  if (btt) {
    var bttVisible = false;
    window.addEventListener('scroll', function () {
      var shouldShow = window.scrollY > 400;
      if (shouldShow !== bttVisible) {
        bttVisible = shouldShow;
        btt.style.opacity = shouldShow ? '1' : '0';
        btt.style.pointerEvents = shouldShow ? 'auto' : 'none';
        btt.setAttribute('aria-hidden', String(!shouldShow));
      }
    }, { passive: true });
    btt.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ─── 7. PREFETCH ON HOVER ───────────────────────────────────────────── */
  var prefetched = new Set();
  function prefetchURL(href) {
    if (!href || prefetched.has(href)) return;
    if (!href.startsWith(location.origin)) return;
    prefetched.add(href);
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = 'document';
    document.head.appendChild(link);
  }

  var prefetchTimer;
  document.addEventListener('mouseover', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || a.href.includes('#') || a.target === '_blank') return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(function () { prefetchURL(a.href); }, 100);
  }, { passive: true });

  document.addEventListener('touchstart', function (e) {
    var a = e.target.closest('a[href]');
    if (a) prefetchURL(a.href);
  }, { passive: true });

  /* ─── 8. SEARCH DEBOUNCE ─────────────────────────────────────────────── */
  var searchInput = document.querySelector('[data-predictive-search-input]');
  if (searchInput) {
    var searchTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var val = searchInput.value.trim();
      if (val.length < 2) return;
      searchTimer = setTimeout(function () {
        searchInput.dispatchEvent(new CustomEvent('tt360:search', { detail: val, bubbles: true }));
      }, 250);
    });
  }

  /* ─── 9. SCROLL-BASED ANIMATION (lightweight alternative to AOS) ──────── */
  if ('IntersectionObserver' in window) {
    var animObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('tt360-anim--in');
            animObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('[data-tt360-anim]').forEach(function (el) {
      animObserver.observe(el);
    });
  }

  /* ─── 10. CLS PREVENTION: RESERVE SPACE FOR LATE-LOADING IMAGES ──────── */
  document.querySelectorAll('img[width][height]').forEach(function (img) {
    if (!img.style.aspectRatio) {
      img.style.aspectRatio = img.width + ' / ' + img.height;
    }
  });

})();
