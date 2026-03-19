import { json } from "@sveltejs/kit";

export function GET() {
  return json({
    configured: !!(
      process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    ),
  });
}
