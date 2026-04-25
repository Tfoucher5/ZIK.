export function load({ setHeaders }) {
  setHeaders({
    "Permissions-Policy": "mediasession=(self)",
  });
  return {};
}
