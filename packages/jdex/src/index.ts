export interface NodeInfo {
  /** Directory or File id. Begins with `d` or `f` for Directory or File. */
  readonly id: string;
  /** True if this node represents a Directory. */
  readonly isDir: boolean;
  /** Relative path to the Directory or File. */
  readonly path: string;
  /** Parent (Directory) id. */
  readonly pId?: string;
  /** Name of the Directory or File. */
  readonly name: string;
  /** Change time Unix timestamp, e.g. milliseconds since UTC 1970-01-01. */
  readonly ctime: number;
}

export default {};
