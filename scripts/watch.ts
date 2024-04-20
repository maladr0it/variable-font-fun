import { build } from "./build.ts";

const WATCH_DIR = "src";
const BUILD_THROTTLE_MS = 500; // watchFS fires several times per file-change, this prevents it building multiple times per change
const watcher = Deno.watchFs(WATCH_DIR, { recursive: true });

let ready = true;

console.log("building...", new Date());
await build();
console.log("done.");

for await (const _event of watcher) {
  if (ready) {
    console.log("building...", new Date());
    await build();
    console.log("done.");
  }

  ready = false;
  setTimeout(() => {
    ready = true;
  }, BUILD_THROTTLE_MS);
}
