import { supabase } from "$lib/server/config.js";

const BASE = "https://www.zik-music.fr";

// Static high-value pages
const STATIC_URLS = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/docs", changefreq: "weekly", priority: "0.9" },
  { loc: "/rooms", changefreq: "daily", priority: "0.8" },
  { loc: "/portfolio", changefreq: "yearly", priority: "0.7" },
  { loc: "/cgu", changefreq: "yearly", priority: "0.2" },
  { loc: "/confidentialite", changefreq: "yearly", priority: "0.2" },
  { loc: "/mentions-legales", changefreq: "yearly", priority: "0.2" },
];

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Fetch all public rooms dynamically
  const { data: rooms } = await supabase
    .from("rooms")
    .select("code, last_active_at, is_official")
    .eq("is_public", true)
    .order("last_active_at", { ascending: false })
    .limit(500);

  const staticPart = STATIC_URLS.map(
    (u) => `  <url>
    <loc>${BASE}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  ).join("\n");

  const roomsPart = (rooms || [])
    .map((r) => {
      const lastmod = r.last_active_at ? r.last_active_at.split("T")[0] : today;
      // Official rooms get slightly higher priority
      const priority = r.is_official ? "0.75" : "0.55";
      return `  <url>
    <loc>${BASE}/room/${r.code}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPart}
${roomsPart}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
