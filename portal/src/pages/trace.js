import { setMain, consumePrerendered } from "../shell.js";
import { modHref } from "../lib/dom.js";
import { scanIslands, hydrateNow } from "../lib/islands.js";
import { tracePlayPageHtml, traceIndexHtml } from "./traceMarkup.js";

const FLOW_FOR = { play: "play-media" };

/** /trace/ (index) and /trace/play/ (Trace the Audio Path). */
export async function pageTrace(arg = "") {
  const slug = (arg || "").split("/")[0];
  const key = slug ? `trace/${slug}` : "trace";
  if (!consumePrerendered(key) || !document.querySelector("#app-main .trace-page")) {
    if (!slug) {
      const index = (await import("../content/generated/index.json")).default;
      setMain(traceIndexHtml(index.flows));
      document.title = "Trace the Audio Path · Android Audio Engineering";
    } else {
      const id = FLOW_FOR[slug];
      if (!id) {
        setMain(`<div class="wrap trace-page"><h1>Trace not found</h1><p><a href="#/trace">All traces</a></p></div>`);
        return;
      }
      const flow = (await import(`../content/generated/flows/${id}.json`)).default;
      setMain(tracePlayPageHtml(flow, { modHref }));
      document.title = `${flow.title} · Trace the Audio Path`;
    }
  }
  const player = document.querySelector("#app-main [data-island='flow']");
  if (player) hydrateNow(player); // above the fold: hydrate right away
  scanIslands(document.getElementById("app-main"));
}
