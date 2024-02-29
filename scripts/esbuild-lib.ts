import {
  PromiseWithChild,
  exec as NodeChildProcessExec,
} from "node:child_process";
import { promisify } from "node:util";
// import Path from "node:path";
import { performance as perf } from "node:perf_hooks";
// import FS from "node:fs/promises";
// import type { Plugin } from "esbuild";
import { build } from "esbuild";
import { glob } from "glob";
import { replaceTscAliasPaths } from "tsc-alias";

const exec = promisify(NodeChildProcessExec);

/** Performance timestamp */
let started = 0;

// NOTE: All paths should be relative to package being compiled...

const ignoreFiles: string[] = [
  // Files to ignore
  // "src/types.ts",
  // "src/internal.ts",
];

// Get all ts files
let entryPoints = await glob("src/**/*.ts");
// console.log("entryPoints", entryPoints);
entryPoints = entryPoints.filter((p) => !ignoreFiles.includes(p));

run("Running esbuild...");
await build({
  entryPoints,
  logLevel: "info",
  outdir: "lib",
  bundle: false,
  minify: false,
  platform: "node",
  format: "esm",
  sourcemap: "external",
  target: "node16",
  tsconfig: "tsconfig.json",
  // plugins: [
  // //   copyStaticFiles(),
  // ],
});
// done(); // Not needed since esbuild prints it's own time....

run("\nReplacing import paths for ESM...\n");
// See https://github.com/evanw/esbuild/issues/394#issuecomment-1537247216
await replaceTscAliasPaths({
  // Usage https://github.com/justkey007/tsc-alias?tab=readme-ov-file#usage
  configFile: "tsconfig.json",
  watch: false,
  outDir: "lib",
  declarationDir: "lib",
  // resolveFullPaths: true,
  // NOTE: The following option wasn't released! So we use a custom replacer.
  // resolveFullExtension: ".js",
  replacers: [
    // NOTE: Paths relative to package being compiled...
    "../../scripts/extensionReplacer.cjs",
  ],
});
done();

run("\nWriting declarations...\n");
// execSync("../../node_modules/.bin/tsc", { stdio: "inherit" });
await exec("../../node_modules/.bin/tsc --declaration --emitDeclarationOnly", {
  encoding: "utf-8",
  shell: "/bin/bash",
})
  .catch((err) => ({ err }))
  .then(
    ({
      err,
      stderr,
      stdout,
    }: Partial<Record<"err" | "stderr" | "stdout", any>>) => {
      done();
      if (err) console.error("" + err, { err });
      if (stderr) console.error(stderr);
      if (stdout) console.log(stdout);
    },
  );

// /** Example plugin to copy static files */
// function copyStaticFiles(): Plugin {
//   return {
//     name: "copyStaticFiles",
//     setup(build) {
//       const { outdir = "lib" } = build.initialOptions;
//       const source = Path.join(__dirname, "../static");
//       const dest = Path.join(outdir, "static");
//       build.onEnd(async () => FS.cp(source, dest, { recursive: true }));
//     },
//   };
// }

function run(message: string, ...args: any[]) {
  console.log(message, ...args);
  started = perf.now();
}

function done() {
  const time = perf.now() - started;
  console.log(
    `⚡ \x1b[32mDone in ${Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(time)}ms\x1b[0m`,
  );
}