export async function handle({ event, resolve }) {
  const response = await resolve(event);
  // Empêche les iframes (YouTube) d'accéder à l'API Media Session
  // → le titre de la chanson ne peut plus apparaître dans les contrôles système iOS/Android
  response.headers.set('Permissions-Policy', 'mediasession=(self)');
  return response;
}
