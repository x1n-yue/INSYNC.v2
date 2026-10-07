import { defineConfig } from "vitest/config";

// Independent of the application config: no dev host, React render, env file,
// Supabase connection, or Tailwind compilation is needed for pure/transport tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,jsx}"],
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ["./tests/setup.js"],
  },
});
