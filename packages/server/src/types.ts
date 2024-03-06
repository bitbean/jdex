import type { NodeInfo } from "jdex";

export { NodeInfo };

/** Configuration data loaded by the Database. */
export interface Config {
  /** A relative or absolute path to the root data directory. */
  root: string;
  /** Type of driver. Defaults to `fs`. */
  type?: "fs" | "sqlite";
  /** Config for the file system driver. */
  fs?: FsDriverConfig;
}

export interface FsDriverConfig {
  /**
   * Disable cached ids by setting `false` or set a file path `string`. The
   * default path is `"./${configFileName}.ids.json"`
   */
  ids?: string | false;
}

export interface ILogger {
  log(message: string, ...optionalParams: any[]): void;
  warn(message: string, ...optionalParams: any[]): void;
}

export interface CreateNodeOptions {
  /** Cached id if already known. */
  id?: string;
  isDir?: boolean;
  /** Parent directory node id. */
  pId?: string;
  stats?: CreateNodeStats;
}

export interface CreateNodeStats {
  /** Change time Unix timestamp, e.g. milliseconds since UTC 1970-01-01. */
  ctime?: Date | number;
}

export interface Driver {
  close(): Promise<void>;
  createTransaction(): Transaction;
  open(): Promise<void>;
}

export type NodeVisitorFn = (
  node: NodeInfo,
  index: NodeVisitorIndex,
) => boolean | undefined | void;

export interface NodeVisitorIndex {
  /** Depth within the Database source directory. `0` is a root node.  */
  depth: number;
  /** Order within the parent node. */
  order: number;
}

export interface QueryInterface {
  /** Adds a directory to the given parent node id and returns a new node id. */
  addDirectory(name: string, pId?: string | null): Promise<string>;
  /** Adds a file to the given parent node id and returns a new node id. */
  addFile(
    name: string,
    info: { data: unknown; pId?: string | null },
  ): Promise<string>;
  /**
   * Traverses the tree in depth-first order calling the given callback for
   * each node.
   * @example
   * const { count } = await db.transaction(trx => {
   *   let count = 0;
   *   trx.eachNode((node, { depth, order }) => {
   *     console.log(node.id, node.path, `item #${order} @ level ${depth}`);
   *     count += 1;
   *   });
   *   return { count };
   * });
   * console.log("NODES", count);
   */
  eachNode(visit: NodeVisitorFn): void;
  /**
   * Returns the id used to refer to the given path. The path be relative to
   * the database root, e.g. `"my/folder/file.json"` or `"my/folder"`. Returns
   * `undefined` if path not found.
   */
  id(path: string): string | undefined;
  /**
   * Moves a directory or file id into a new parent directory (or root, when
   * `toId` is `null`) and returns the new path.
   */
  move(id: string, toId: string | null): Promise<string>;
  /**
   * Returns the path for the given node id, the root path if id is `null`.
   * and `undefined` if id not found.
   */
  path(id: string | null): string | undefined;
  /** Removes a directory or file by id returning `true` if successful. */
  remove(id: string): Promise<boolean>;
  /** Renames a directory or file by id and returns the new path. */
  rename(id: string, name: string): Promise<string>;
}
/** See https://stackoverflow.com/questions/51465182/how-to-remove-index-signature-using-mapped-types/66252656#66252656 */
export type RemoveIndex<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: T[K];
};

export interface Transaction extends QueryInterface {
  commit(): void;
  rollback(): void;
}

export type TransactionCallback<T = any> = (trx: Transaction) => T | Promise<T>;
