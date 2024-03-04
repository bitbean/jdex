import Path from "node:path";
// Packages
import { Database } from "@/index";
// Local
import { dirname } from "./paths";

const _dirname = dirname(import.meta);
export const fixtures_path = Path.join(_dirname, "../../../fixtures/");

export function openDb<DB = any, R = any>(
  pathOrDb: string | Database<DB>,
  cb: (db: Database<DB>) => Promise<R>,
): Promise<R> {
  async function openDbLifetime(db: Database<DB>) {
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
  }
  if (typeof pathOrDb === "string") {
    return withDb<DB, Promise<R>>(pathOrDb, openDbLifetime);
  } else {
    return openDbLifetime(pathOrDb);
  }
}

export function withDb<DB = any, R = any>(
  path: string,
  cb: (db: Database<DB>) => R,
): R {
  const db = new Database(Path.join(fixtures_path, path));
  return cb(db);
}
