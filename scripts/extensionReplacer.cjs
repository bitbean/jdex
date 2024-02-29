/** @file A tsc-alias "replacer" to add file extensions to import statements. */
const Path = require("path"); // eslint-disable-line
const FS = require("fs"); // eslint-disable-line

const EXT = ".js";
const INDEX = `index${EXT}`;
const QUOTE = `"`;

// See https://github.com/justkey007/tsc-alias/discussions/73
// and https://github.com/evanw/esbuild/issues/394

/** @type {import("tsc-alias").AliasReplacer} */
exports.default = ({ orig, file, config }) => {
  // console.log(file, orig);
  if (
    // match: `import "./my_file"` or "../my_file" etc.
    (orig.startsWith(`import ".`) ||
      // match: `from "./my_file"` or "../my_file" etc.
      orig.startsWith(`from ".`)) &&
    !orig.endsWith(`.js"`)
  ) {
    // Remove ending quote. There is no semi-colon.
    const unquoted = orig.substring(0, orig.length - 1);
    const dir = Path.dirname(file);
    // Extract path from import statement code
    const importedPath = unquoted.substring(unquoted.indexOf('"') + 1);
    const path = Path.join(dir, importedPath);
    const isDir = FS.existsSync(path) && FS.statSync(path).isDirectory();
    // console.log(file, {
    //   orig,
    //   unquoted,
    //   dir,
    //   importedPath,
    //   path,
    //   isDir,
    // });

    // Add a file extension to the original import statement.
    if (isDir) {
      orig =
        unquoted +
        (unquoted.endsWith("/")
          ? // e.g. `index.js"`
            `${INDEX}${QUOTE}`
          : // e.g. `/index.js"`
            `/${INDEX}${QUOTE}`);
    } else {
      orig = unquoted + `${EXT}${QUOTE}`; // e.g. `.js"`
    }
  }
  return orig;
};
