import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { PAGE } from "./page";

// Serves the whole app from Convex — no separate host. The client URL is
// injected so the page works from the .site domain.
const serve = httpAction(async () => {
  const cloudUrl = process.env.CONVEX_CLOUD_URL ?? "";
  const html = PAGE.replace(
    "<script type=\"module\">",
    `<script>window.__CONVEX_URL__=${JSON.stringify(cloudUrl)}</script>\n<script type="module">`,
  );
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
});

const http = httpRouter();
http.route({ path: "/", method: "GET", handler: serve });
// Hash routing means every card link is still just "/", but keep this for
// anyone who types a path.
http.route({ pathPrefix: "/card/", method: "GET", handler: serve });

export default http;
