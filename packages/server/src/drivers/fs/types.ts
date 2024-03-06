export type IdsFile = Record<string, string>;

/** A node in the Database represeting a Directory or JSON File. */
export interface Node {
  /** Directory or File id. Begins with `d` or `f` for Directory or File. */
  id: string;
  /** Children of this node. */
  children?: Set<Node>;

  /** The entry strictly contains the listing entry data shared with clients. */
  entry: {
    /** Parent (Directory) id. */
    pId?: string;
    /** Name of the Directory or File. */
    name: string;
    /** Change time Unix timestamp, e.g. milliseconds since UTC 1970-01-01. */
    ctime: number;
  };
  // content?: unknown;
  // history?: NodeChange[];
  // futures?: NodeChange[];
}

/**
 * A function called when visiting nodes, e.g. `Database.eachNode`.
 * @returns `true` to stop tree traversal. `false` to stop at `index.depth`.
 */
export type VisitNodeFn = (
  node: Node,
  index: { depth: number; order: number },
) => boolean | undefined | void;

export function isDirectoryNode(
  node: Node,
): node is Node & { children: Set<Node> } {
  return node.id.startsWith("d");
}

export function isFileNode(node: Node) {
  return node.id.startsWith("f");
}
