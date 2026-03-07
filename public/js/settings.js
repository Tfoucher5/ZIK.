'use strict';

// shared.js provides: dicebear, getCachedProfile, showNavUser, showNavAuth,
// bindNavDropdown, ZIK_SB

const sb = ZIK_SB;

document.addEventListener('DOMContentLoaded', async () => {
  // ── Preferences ─────────────────────────────────────────────────────────────
  const animToggle = document.getElementById('pref-animations');
  animToggle.checked = localStorage.getItem('zik_animations') !== 'off';

  animToggle.addEventListener('change', () => {
    const on = animToggle.checked;
    localStorage.setItem('zik_animations', on ? 'on' : 'off');
    document.documentElement.classList.toggle('no-animations', !on);
  });

  const volSlider = document.getElementById('pref-volume');
  const volVal    = document.getElementById('pref-volume-val');
  const v0 = parseInt(localStorage.getItem('zik_vol') ?? '50');
  volSlider.value = v0;
  volVal.textContent = v0 + '%';
  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value);
    volVal.textContent = v + '%';
    localStorage.setItem('zik_vol', v);
  });

  // ── Nav auth state ───────────────────────────────────────────────────────────
  bindNavDropdown();

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await sb?.auth.signOut();
    window.location.href = '/';
  });

  document.getElementById('openLoginBtn')?.addEventListener('click', () => {
    window.location.href = '/';
  });

  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await applyNavUser(session.user);
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN'  && session?.user) await applyNavUser(session.user);
      if (event === 'SIGNED_OUT') showNavAuth();
    });
  } catch { /* nav stays hidden */ }
});

async function applyNavUser(user) {
  try {
    let profile = getCachedProfile(user.id);
    if (!profile) {
      const { data } = await sb.from('profiles').select('username, avatar_url').eq('id', user.id).single();
      profile = data;
    }
    const name   = profile?.username || user.email?.split('@')[0] || 'Joueur';
    const avatar = profile?.avatar_url || dicebear(name);
    showNavUser(name, avatar);
  } catch { /* best effort */ }
}
