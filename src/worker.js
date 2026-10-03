const SITE_ORIGIN = "https://fantasy-novels.lmomo9497.workers.dev";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const SITEMAP_SOURCE =
  "https://ozjeaeernyvtodhhwsay.supabase.co/functions/v1/public-sitemap";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/indexnow" && request.method === "POST") {
      try {
        const body = await request.json();
        const urls = Array.isArray(body?.urls) ? body.urls : [];
        const validUrls = urls
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => {
            try {
              const target = new URL(value);
              return target.origin === SITE_ORIGIN && target.protocol === "https:";
            } catch {
              return false;
            }
          })
          .filter((value, index, list) => list.indexOf(value) === index)
          .slice(0, 10);

        if (validUrls.length === 0) {
          return new Response(JSON.stringify({ ok: false, error: "No valid URLs" }), {
            status: 400,
            headers: { "Content-Type": "application/json; charset=UTF-8" },
          });
        }

        const keyResponse = await env.ASSETS.fetch(
          new Request(new URL("/indexnow-7f3c9a1d5e6b4c28.txt", request.url))
        );
        if (!keyResponse.ok) {
          return new Response(JSON.stringify({ ok: false, error: "IndexNow key file unavailable" }), {
            status: 500,
            headers: { "Content-Type": "application/json; charset=UTF-8" },
          });
        }

        const key = (await keyResponse.text()).trim();
        const response = await fetch(INDEXNOW_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({
            host: new URL(request.url).host,
            key,
            keyLocation: SITE_ORIGIN + "/indexnow-7f3c9a1d5e6b4c28.txt",
            urlList: validUrls,
          }),
        });

        return new Response(JSON.stringify({ ok: response.ok, status: response.status }), {
          status: response.ok ? 200 : response.status,
          headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "IndexNow request failed" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=UTF-8" },
        });
      }
    }

    if (url.pathname !== "/sitemap.xml") {
      return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=UTF-8",
          "Cache-Control": "no-store",
          "Retry-After": "300",
        },
      }
    );
    }

    // Use a versioned internal cache key so an old fallback sitemap can never be reused.
    const cacheUrl = new URL(url.toString());
    cacheUrl.searchParams.set("__sitemap_cache", "v2");
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
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
        headers.set("Cache-Control", "public, max-age=300, s-maxage=600");

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
