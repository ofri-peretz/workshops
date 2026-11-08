// Unit tests for the relay's rules (relay/core.test.mjs), and the lines oxmutate grades them on.
// npx vitest run · npx oxmutate run
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["relay/**/*.test.mjs"], environment: "node" },
});
