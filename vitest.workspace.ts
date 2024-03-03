/** @file Vitest Workspace. See https://vitest.dev/guide/workspace.html */
import { defineWorkspace } from "vitest/config";
import tsconfigPathsPlugin from "vite-tsconfig-paths";

const tsconfigPaths = tsconfigPathsPlugin({
  // ...
});

export default defineWorkspace([
  {
    test: {
      name: "jdex",
      environment: "node",
      include: ["packages/jdex/src/**/*.test.{ts,js}"],
    },
    plugins: [tsconfigPaths],
  },
  {
    test: {
      name: "server",
      environment: "node",
      include: ["packages/server/src/**/*.test.{ts,js}"],
    },
    plugins: [tsconfigPaths],
  },
  {
    test: {
      name: "client",
      environment: "node",
      include: ["packages/client/src/**/*.test.{ts,js}"],
    },
    plugins: [tsconfigPaths],
  },
]);
