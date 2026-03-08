// Shared client/server utilities

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function dicebear(name) {
  return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
}
