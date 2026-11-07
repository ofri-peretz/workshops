import type { NextConfig } from "next";

const config: NextConfig = {
  // The console reads Relay's pages and rehearsal from the sibling folder.
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  // The e2e run builds into its own folder, so it never fights the presenter's running console for the lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default config;
