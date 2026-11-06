import type { NextConfig } from "next";

const config: NextConfig = {
  // The console reads Relay's pages and rehearsal from the sibling folder.
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
};
export default config;
