'use strict';

const SUPABASE_URL      = window.ZIK_SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = window.ZIK_SUPABASE_ANON_KEY || '';
const SB_OK = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
const sb = SB_OK ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) applyNavUser(session.user);
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN'  && session?.user) applyNavUser(session.user);
      if (event === 'SIGNED_OUT') clearNavUser();
    });
  } catch { /* nav stays hidden */ }

  document.getElementById('nav-profile-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('nav-dropdown')?.classList.toggle('open');
  });
  document.addEventListener('click', () => document.getElementById('nav-dropdown')?.classList.remove('open'));

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = '/';
  });

  document.getElementById('openLoginBtn')?.addEventListener('click', () => {
    window.location.href = '/';
  });
});

async function applyNavUser(user) {
  try {
    const { data: profile } = await sb.from('profiles').select('username, avatar_url').eq('id', user.id).single();
    const name   = profile?.username || user.email?.split('@')[0] || 'Joueur';
    const avatar = profile?.avatar_url ||
      `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
    document.getElementById('nav-username').textContent = name;
    const img = document.getElementById('nav-avatar');
    if (img) { img.src = avatar; img.style.display = 'block'; }
  } catch { /* best effort */ }
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
}

function clearNavUser() {
  document.getElementById('nav-auth').style.display = '';
  document.getElementById('nav-user').style.display = 'none';
}
