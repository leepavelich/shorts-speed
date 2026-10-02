(() => {
  'use strict';

  const MIN = 0.25;
  const MAX = 4;
  const STEP = 0.25;
  const PRESETS = [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  let speed = 1;
  let pill = null;
  let label = null;
  let menu = null;
  let rafId = 0;
  let mouseX = -1;
  let mouseY = -1;

  const isShorts = () => location.pathname.startsWith('/shorts');
  const clamp = (v) => Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100));
  const fmt = (v) => `${+v.toFixed(2)}×`;

  // The Shorts feed reuses a single <video>; fall back to whichever video is playing.
  function activeVideo() {
    return (
      document.querySelector('#shorts-player video') ||
      [...document.querySelectorAll('video')].find((v) => !v.paused) ||
      null
    );
  }

  function applySpeed() {
    if (!isShorts()) return;
    const v = activeVideo();
    if (v && v.playbackRate !== speed) v.playbackRate = speed;
  }

  function setSpeed(next, { persist = true } = {}) {
    speed = clamp(next);
    applySpeed();
    render();
    if (persist) {
      try { chrome.storage.sync.set({ speed }); } catch {}
    }
  }

  // YouTube resets playbackRate when it swaps in the next short. Media events don't
  // bubble, but they do pass through the capture phase, so one listener catches them all.
  // On ratechange, only undo resets to 1× so YouTube's own hold-for-2× still works.
  for (const type of ['loadedmetadata', 'loadeddata', 'play', 'playing', 'ratechange']) {
    document.addEventListener(type, (e) => {
      const v = e.target;
      if (!(v instanceof HTMLMediaElement) || !isShorts() || v.playbackRate === speed) return;
      if (type === 'ratechange' && v.playbackRate !== 1) return;
      v.playbackRate = speed;
    }, true);
  }

  // Track the pointer so the pill can show/hide with YouTube's own overlay buttons.
  document.addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true, capture: true });
  document.documentElement.addEventListener('pointerleave', () => { mouseX = mouseY = -1; });

  // Shift+> / Shift+< like the regular player; Shift+? resets to 1×.
  window.addEventListener('keydown', (e) => {
    if (!isShorts() || e.ctrlKey || e.metaKey || e.altKey || !e.shiftKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    let next;
    if (e.code === 'Period') next = speed + STEP;
    else if (e.code === 'Comma') next = speed - STEP;
    else if (e.code === 'Slash') next = 1;
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
    setSpeed(next);
    flash();
  }, true);

  // YouTube enforces Trusted Types, so build nodes directly instead of using innerHTML.
  function el(tag, { dataset = {}, ...props } = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    Object.assign(node.dataset, dataset);
    node.append(...children);
    return node;
  }

  function build() {
    label = el('button', { className: 'ss-label', title: 'Speed presets (scroll to adjust)', ariaLabel: 'Playback speed' });
    menu = el('div', { className: 'ss-menu', role: 'menu', hidden: true },
      PRESETS.map((p) => el('button', { role: 'menuitem', textContent: fmt(p), dataset: { speed: p } })));
    pill = el('div', { id: 'ss-pill' }, [
      el('button', { className: 'ss-btn', textContent: '−', title: 'Slower (Shift+<)', ariaLabel: 'Slower', dataset: { act: 'down' } }),
      label,
      el('button', { className: 'ss-btn', textContent: '+', title: 'Faster (Shift+>)', ariaLabel: 'Faster', dataset: { act: 'up' } }),
      menu,
    ]);

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'up') setSpeed(speed + STEP);
      else if (b.dataset.act === 'down') setSpeed(speed - STEP);
      else if (b.dataset.speed) { setSpeed(+b.dataset.speed); menu.hidden = true; }
      else if (b === label) menu.hidden = !menu.hidden;
    });
    // Keep clicks on the pill from pausing the short underneath.
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick']) {
      pill.addEventListener(type, (e) => e.stopPropagation());
    }
    pill.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSpeed(speed + (e.deltaY < 0 ? STEP : -STEP));
    }, { passive: false });
    document.addEventListener('click', (e) => {
      if (menu && !menu.hidden && !pill.contains(e.target)) menu.hidden = true;
    });

    document.documentElement.appendChild(pill);
    render();
  }

  function render() {
    if (!pill) return;
    label.textContent = fmt(speed);
    pill.classList.toggle('ss-changed', speed !== 1);
    for (const b of menu.children) b.classList.toggle('ss-on', +b.dataset.speed === speed);
  }

  let flashTimer = 0;
  function flash() {
    if (!pill) return;
    pill.classList.add('ss-flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => pill.classList.remove('ss-flash'), 1200);
  }

  // Pin the pill to the visible short, just right of YouTube's own pause/mute buttons
  // (48px each, 16px inset, 8px gap) and vertically centred on them.
  function position() {
    rafId = 0;
    if (!pill) return;
    const v = isShorts() && activeVideo();
    const r = v && v.getBoundingClientRect();
    if (!r || r.width < 50 || r.bottom < 0 || r.top > innerHeight) {
      pill.hidden = true;
    } else {
      pill.hidden = false;
      const hover = mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom;
      pill.classList.toggle('ss-hover', hover);
      pill.style.transform = `translate(${Math.round(r.left + 128)}px, ${Math.round(r.top + 20)}px)`;
    }
    if (isShorts()) rafId = requestAnimationFrame(position);
  }

  function onRoute() {
    if (isShorts()) {
      if (!pill) build();
      applySpeed();
      if (!rafId) rafId = requestAnimationFrame(position);
    } else if (pill) {
      pill.hidden = true;
      menu.hidden = true;
    }
  }

  try {
    chrome.storage.sync.get({ speed: 1 }, (res) => setSpeed(res.speed, { persist: false }));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.speed && changes.speed.newValue !== speed) {
        setSpeed(changes.speed.newValue, { persist: false });
      }
    });
  } catch {}

  // YouTube is a SPA: watch its own navigation event, history changes, and a slow poll as backup.
  document.addEventListener('yt-navigate-finish', onRoute);
  window.addEventListener('popstate', onRoute);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onRoute, { once: true });
  } else {
    onRoute();
  }
  setInterval(onRoute, 1000);
})();
