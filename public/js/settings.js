'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // ── Animations ──────────────────────────────────────────────────────────────
  const animToggle = document.getElementById('pref-animations');
  const saved = localStorage.getItem('zik_animations');
  const animOn = saved !== 'off';
  animToggle.checked = animOn;
  applyAnimations(animOn);

  animToggle.addEventListener('change', () => {
    const on = animToggle.checked;
    localStorage.setItem('zik_animations', on ? 'on' : 'off');
    applyAnimations(on);
  });

  // ── Volume ───────────────────────────────────────────────────────────────────
  const volSlider = document.getElementById('pref-volume');
  const volVal    = document.getElementById('pref-volume-val');
  const savedVol  = parseInt(localStorage.getItem('zik_vol') ?? '50');
  volSlider.value = savedVol;
  volVal.textContent = savedVol + '%';

  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value);
    volVal.textContent = v + '%';
    localStorage.setItem('zik_vol', v);
  });
});

function applyAnimations(on) {
  document.documentElement.classList.toggle('no-animations', !on);
}
