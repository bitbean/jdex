/** @file Vitest Root config. See https://vitest.dev/guide/config.html */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Rerun ALL tests when any file changes. See:
    // https://github.com/vitest-dev/vitest/issues/4997#issuecomment-1975394663
    forceRerunTriggers: ["**/*"],
  },
});
