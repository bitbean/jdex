// import Path from "node:path";
// import * as FSP from "node:fs/promises";
import { expect, test } from "vitest";
// Packages
import type { Database } from "@/index";
// Local
import { openDb } from "@/tests/common/projects";

export function DatabaseUnitTests<DB = any>(dbOrPath: string | Database<DB>) {
  test("Open database, print directory, close database.", async () => {
    let err: any = undefined;
    await openDb(dbOrPath, async (db) => {
      await db.printDirectory();
      // throw new Error("Testing");
    }).catch((ex) => {
      err = ex;
    });
    expect(err).toBeUndefined();
  });
  test("Add directory, remove directory.", async () => {
    let err: any = undefined;
    await openDb(dbOrPath, async (db) => {
      let newId = "";
      await db.transaction(async (trx) => {
        newId = await trx.addDirectory("yada");
      });
      const removed = await db.transaction(async (trx) => {
        return trx.remove(newId);
      });
      if (!removed) {
        throw new Error(`New directory not removed.`);
      }
    }).catch((ex) => {
      err = ex;
    });
    expect(err).toBeUndefined();
  });
}
