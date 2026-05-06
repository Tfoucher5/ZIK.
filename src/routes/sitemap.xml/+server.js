import { supabase } from "$lib/server/config.js";

const SITE = "https://www.zik-music.fr";

const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/rooms", changefreq: "hourly", priority: "0.9" },
  { loc: "/playlists", changefreq: "weekly", priority: "0.7" },
  { loc: "/salon", changefreq: "monthly", priority: "0.7" },
  { loc: "/docs", changefreq: "monthly", priority: "0.6" },
  { loc: "/vs/kahoot", changefreq: "monthly", priority: "0.6" },
  { loc: "/vs/blinest", changefreq: "monthly", priority: "0.6" },
  { loc: "/vs/blindtest-io", changefreq: "monthly", priority: "0.6" },
  { loc: "/cgu", changefreq: "yearly", priority: "0.2" },
  { loc: "/confidentialite", changefreq: "yearly", priority: "0.2" },
  { loc: "/mentions-legales", changefreq: "yearly", priority: "0.2" },
];

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const urls = [...STATIC_PAGES];

  const { data: rooms } = await supabase
    .from("rooms")
    .select("code, updated_at")
    .eq("is_public", true)
    .order("last_active_at", { ascending: false })
    .limit(200);

  if (rooms) {
    for (const room of rooms) {
      urls.push({
        loc: `/room/${room.code}`,
        changefreq: "daily",
        priority: "0.5",
        lastmod: room.updated_at ? room.updated_at.slice(0, 10) : undefined,
      });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(SITE + u.loc)}</loc>
    <lastmod>${u.lastmod ?? today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
