import Path from "node:path";
// Packages
import { Database } from "@jdex/server";
// Local
import { dirname } from "./paths";

const _dirname = dirname(import.meta);

export function openDb<DB = any, R = any>(
  path: string,
  cb: (db: Database<DB>) => Promise<R>,
): Promise<R> {
  return withDb<DB, Promise<R>>(path, async (db) => {
    let closed = false;
    let value: R;
    try {
      await db.open();
      value = await cb(db);
      await db.close();
      closed = true;
    } finally {
      if (!closed) {
        console.warn("Unclosed db. Cleaning up...");
        await db.close();
      }
    }
    return value;
  });
}

export function withDb<DB = any, R = any>(
  path: string,
  cb: (db: Database<DB>) => R,
): R {
  const db = new Database(Path.join(_dirname, "../../fixtures/", path));
  return cb(db);
}