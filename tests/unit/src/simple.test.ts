// import Path from "node:path";
// import * as FSP from "node:fs/promises";
// Packages
// import { Database } from "@jdex/server";
// Local
// import { dirname } from "./common/paths";
import { openDb } from "./common/projects";

// const _dirname = dirname(import.meta);

test("Open database, print directory, close database.", async () => {
  let err: any = undefined;
  await openDb("simple-project/.proj/project_db.json", async (db) => {
    await db.printDirectory();
    // throw new Error("Testing");
  }).catch((ex) => {
    err = ex;
  });
  expect(err).toBeUndefined();
});
