import { dirname as pathDirname } from "path";
import { fileURLToPath } from "url";

export function dirname(importMeta: ImportMeta) {
  return pathDirname(fileURLToPath(importMeta.url));
}
