const SITEMAP_SOURCE =
  "https://ozjeaeernyvtodhhwsay.supabase.co/functions/v1/public-sitemap";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/sitemap.xml") {
      return env.ASSETS.fetch(request);
    }

    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(SITEMAP_SOURCE, {
        method: "GET",
        headers: { Accept: "application/xml" },
      });

      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set("Content-Type", "application/xml; charset=UTF-8");
        headers.set("Cache-Control", "public, max-age=3600, s-maxage=21600");

        const result = new Response(response.body, {
          status: 200,
          headers,
        });

        ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
        return result;
      }
    } catch {
      // استخدم النسخة الثابتة كخطة احتياطية حتى لا يتعطل الـSitemap.
    }

    return env.ASSETS.fetch(request);
  },
};
