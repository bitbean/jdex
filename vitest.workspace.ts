/** @file Vitest Workspace. See https://vitest.dev/guide/workspace.html */
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/jdex",
  "packages/server",
  "packages/client",
]);
