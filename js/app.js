/* =========================================================
   Putri Permata Sari — Notebook SPA engine
   - Flip pages with swipe / drag, buttons, keyboard, tabs, TOC
   - Hash routing (#/profil, #/kerja, ...)
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const book = $('#book');
  const sheets = [...book.querySelectorAll('.sheet')];
  const N = sheets.length;
  const slugs = sheets.map(s => s.dataset.slug);
  const titles = sheets.map(s => s.dataset.title.replace(/&amp;/g, '&'));
  const tabColors = ['#a9bfe0', '#f5e19a', '#f3cdc6', '#cfe6d6', '#d9c8f0', '#f6c9a0', '#bfe0e0'];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FLIP_MS = reduceMotion ? 20 : 850;
  const STAGGER = reduceMotion ? 0 : 110;

  const pad = n => String(n).padStart(2, '0');

  let cur = 0;
  let settleTimer = null;
  let animating = new Set();

  /* ---------- Build back faces (the left page once flipped) ---------- */
  sheets.forEach(s => {
    const front = s.querySelector('.face.front');
    const back = document.createElement('div');
    back.className = 'face back ' + (front.classList.contains('folder') ? 'folder' : 'paper');
    back.setAttribute('aria-hidden', 'true');
    if (s.classList.contains('cover')) {
      back.innerHTML = '<div class="inside"><span>Putri Permata Sari</span><small>Resume &amp; Portfolio</small></div>';
    } else {
      const clone = front.querySelector('.scroller').cloneNode(true);
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.querySelectorAll('a, button').forEach(el => { el.removeAttribute('href'); el.tabIndex = -1; });
      back.appendChild(clone);
    }
    s.appendChild(back);
  });

  /* ---------- Build tabs & TOC ---------- */
  const tabsEl = $('#tabs');
  const tocList = $('#tocList');
  const tabBtns = [];
  const tocItems = [];
  titles.forEach((t, i) => {
    if (i > 0) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.type = 'button';
      b.textContent = t.length > 14 ? t.split(' ')[0] : t;
      b.style.setProperty('--t', tabColors[i % tabColors.length]);
      b.setAttribute('aria-label', `Buka halaman ${t}`);
      b.addEventListener('click', () => goTo(i));
      tabsEl.appendChild(b);
      tabBtns[i] = b;
    }
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><span></span><b>${pad(i + 1)}</b></button>`;
    li.querySelector('span').textContent = t;
    li.querySelector('button').addEventListener('click', () => { closeToc(); goTo(i); });
    tocList.appendChild(li);
    tocItems[i] = li;
  });

  /* ---------- Render state ---------- */
  function zFor(i) {
    const base = i < cur ? i : 2 * N - i; // unflipped pages always sit above flipped ones
    return animating.has(i) ? 100 + base : base;
  }

  function render() {
    sheets.forEach((s, i) => {
      s.classList.toggle('flipped', i < cur);
      const active = i === cur;
      s.classList.toggle('active', active);
      if (active) s.classList.add('anim');
      s.style.zIndex = zFor(i);
      s.style.transform = '';
      s.style.removeProperty('--shade');
      s.inert = false;
      s.querySelector('.face.front').inert = !active;
    });
    document.body.classList.toggle('is-open', cur > 0);
    updateUi();
  }

  function updateUi() {
    $('#pageNo').textContent = pad(cur + 1);
    $('#pageTotal').textContent = pad(N);
    $('#pageName').textContent = titles[cur];
    $('#prev').disabled = cur === 0;
    $('#next').disabled = cur === N - 1;
    tabBtns.forEach((b, i) => b && b.setAttribute('aria-current', i === cur ? 'true' : 'false'));
    tocItems.forEach((li, i) => li.setAttribute('aria-current', i === cur ? 'true' : 'false'));
    document.title = cur === 0
      ? 'Putri Permata Sari — Resume & Portfolio Barista | Customer Service'
      : `${titles[cur]} — Putri Permata Sari`;
    const hint = $('.hint');
    if (hint && cur > 0) hint.style.visibility = 'hidden';
  }

  /* ---------- Navigation ---------- */
  function goTo(target, { push = true, instant = false } = {}) {
    target = Math.max(0, Math.min(N - 1, target));
    if (target === cur) return;
    const from = cur;
    const forward = target > from;
    const touched = [];

    if (forward) for (let i = from; i < target; i++) touched.push(i);
    else for (let i = from - 1; i >= target; i--) touched.push(i);

    cur = target;
    clearTimeout(settleTimer);

    touched.forEach((i, k) => {
      animating.add(i);
      sheets[i].style.setProperty('--delay', instant ? '0s' : `${k * STAGGER}ms`);
    });
    render();

    const total = FLIP_MS + touched.length * STAGGER + 60;
    settleTimer = setTimeout(() => {
      touched.forEach(i => { sheets[i].style.removeProperty('--delay'); });
      animating.clear();
      sheets.forEach((s, i) => { s.style.zIndex = zFor(i); });
    }, total);

    if (push) syncHash(true);
  }

  const next = () => goTo(cur + 1);
  const prev = () => goTo(cur - 1);

  function syncHash(push) {
    const h = '#/' + slugs[cur];
    if (location.hash === h) return;
    try { push ? history.pushState(null, '', h) : history.replaceState(null, '', h); }
    catch (e) { location.hash = h; }
  }

  function fromHash() {
    const m = location.hash.match(/^#\/?([\w-]+)/);
    const i = m ? slugs.indexOf(m[1]) : 0;
    return i < 0 ? 0 : i;
  }

  window.addEventListener('popstate', () => goTo(fromHash(), { push: false }));
  window.addEventListener('hashchange', () => goTo(fromHash(), { push: false }));

  /* ---------- Controls ---------- */
  $('#next').addEventListener('click', next);
  $('#prev').addEventListener('click', prev);
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) goTo(slugs.indexOf(g.dataset.go));
  });

  document.addEventListener('keydown', e => {
    if (!$('#toc').hidden) { if (e.key === 'Escape') closeToc(); return; }
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(N - 1); }
  });

  /* ---------- TOC ---------- */
  const toc = $('#toc');
  const tocBtn = $('#tocBtn');
  function openToc() {
    toc.hidden = false;
    const c = tocItems[cur].querySelector('button');
    c && c.focus();
  }
  function closeToc() { toc.hidden = true; tocBtn.focus({ preventScroll: true }); }
  tocBtn.addEventListener('click', openToc);
  toc.addEventListener('click', e => { if (e.target === toc) closeToc(); });

  /* ---------- Drag / swipe to flip ---------- */
  let drag = null;
  let suppressClick = false;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  book.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.tab')) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), active: false, id: e.pointerId, w: book.clientWidth };
  });

  book.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (!drag.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const dir = dx < 0 ? 1 : -1;
      if ((dir === 1 && cur >= N - 1) || (dir === -1 && cur <= 0)) { drag = null; return; }
      drag.active = true;
      drag.dir = dir;
      drag.sheet = dir === 1 ? sheets[cur] : sheets[cur - 1];
      drag.under = dir === 1 ? sheets[cur + 1] : sheets[cur];
      drag.sheet.classList.add('dragging');
      drag.sheet.style.zIndex = 100;
      document.body.classList.add('is-dragging');
      try { book.setPointerCapture(e.pointerId); } catch (_) {}
      drag.x0 = e.clientX; // start measuring from where the drag really began
    }

    const dist = (e.clientX - drag.x0) * -drag.dir; // positive when moving in flip direction
    const p = clamp(dist / (drag.w * 0.85), 0, 1);
    drag.p = p;
    const angle = drag.dir === 1 ? -p * 180 : -180 + p * 180;
    drag.sheet.style.transform = `rotateY(${angle}deg)`;
    const shade = Math.abs(angle) < 90 ? (Math.abs(angle) / 90) * 0.45 : 0;
    drag.sheet.style.setProperty('--shade', shade.toFixed(3));
    if (drag.under) drag.under.style.setProperty('--shade', (0.32 * (drag.dir === 1 ? 1 - p : p)).toFixed(3));
    drag.lastX = e.clientX;
    drag.lastT = performance.now();
    e.preventDefault();
  });

  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    if (!d.active) return;

    document.body.classList.remove('is-dragging');
    try { book.releasePointerCapture(d.id); } catch (_) {}
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);

    const dt = Math.max(1, performance.now() - d.t);
    const velocity = ((d.lastX ?? d.x0) - d.x) / dt * -d.dir; // px/ms in flip direction
    const commit = !cancelled && (d.p > 0.28 || velocity > 0.45);

    d.sheet.classList.remove('dragging');
    void d.sheet.offsetWidth; // re-enable transition before changing target state
    d.sheet.style.removeProperty('--shade');
    if (d.under) d.under.style.removeProperty('--shade');

    animating.add(sheets.indexOf(d.sheet));
    if (commit) cur += d.dir;
    render();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      animating.clear();
      sheets.forEach((s, i) => { s.style.zIndex = zFor(i); });
    }, FLIP_MS + 60);
    if (commit) syncHash(true);
  }

  book.addEventListener('pointerup', e => endDrag(e, false));
  book.addEventListener('pointercancel', e => endDrag(e, true));
  book.addEventListener('click', e => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // keep native image/link dragging from hijacking the gesture
  book.addEventListener('dragstart', e => e.preventDefault());

  /* ---------- Init ---------- */
  const start = fromHash();
  cur = start;
  book.classList.add('boot');
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => book.classList.remove('boot')));
  if (start === 0) syncHash(false);
})();
