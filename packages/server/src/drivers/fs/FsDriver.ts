import Path from "node:path";
import FS from "node:fs";
import FSP from "node:fs/promises";
import { customAlphabet } from "nanoid";
// import * as JsonPatch from "fast-json-patch";
import { glob } from "glob";
// Local
import type { Database } from "@/Database";
import { CreateNodeOptions, Driver, Transaction } from "@/types";
import { IdsFile, Node, VisitNodeFn, isDirectoryNode } from "./types";
import FsTransaction from "./FsTransaction";

/**
 * Generates a short (9 char) id for use in a JavaScript {@link Map}.
 *
 * **See**:
 * - https://zelark.github.io/nano-id-cc/
 * - https://github.com/ai/nanoid#custom-alphabet-or-size
 *
 * **Notes**:
 * - Simply re-generate on collision, by checking if `map.has(newId)`.
 */
const createShortId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 9);

export class FsDriver implements Driver {
  /** Object name for the default `toString` implementation. */
  public readonly [Symbol.toStringTag]: string = "FsDriver";

  private _idsPath: string | undefined;
  /** Directory and File nodes by id. */
  private _nodes = new Map<string, Node>();
  /** `true` if {@link FsDriver.open}, `false` if {@link FsDriver.close}d */
  private _opened = false;
  /** Meta-data for each Node, just their relative paths for now. */
  private _paths = new WeakMap<Node, string>();
  /** Depth of the root {@link path} children in absolute fs path. */
  private _rootChildDepth = 0;
  /** Root Directory and File nodes. */
  private _rootNodes = new Set<Node>();

  /** The root file path of the database. */
  public readonly path: string;

  constructor({ db }: { db: Database<any> }) {
    const { configFile, path } = db;
    let idsPath = db.config.fs?.ids;
    if (configFile && idsPath !== false) {
      if (!idsPath) {
        // Set a default idsPath.
        const configExt = Path.extname(configFile);
        idsPath = Path.basename(configFile, configExt) + ".ids" + configExt;
        // e.g. idsPath "projectDb.ids.json" for config file "projectDb.json"
      }
      const configDir = Path.dirname(configFile);
      this._idsPath = Path.resolve(configDir, idsPath);
    }
    this[Symbol.toStringTag] = `FsDriver("${path}")`;
    this._rootChildDepth = path.split(Path.sep).length;
    this.path = path;
  }

  createTransaction(): Transaction {
    return new FsTransaction(this);
  }

  // #region Lifecycle
  /** Closes the database if opened. */
  async close() {
    const { _idsPath, _opened } = this;
    if (!_opened) {
      return;
    }
    if (_idsPath) {
      await this.writeIdsFile();
    }
    // Save state.
    this._nodes = new Map<string, Node>();
    this._rootNodes = new Set<Node>();
    this._opened = false;
  }

  private async loadIdsFile(): Promise<IdsFile | undefined> {
    const { _idsPath } = this;
    if (!_idsPath) {
      return undefined;
    }
    if (!FS.existsSync(_idsPath)) {
      return;
    }
    const idsFileJson = (await FSP.readFile(_idsPath)).toString();
    const idsFile = JSON.parse(idsFileJson) as IdsFile;
    return idsFile;
  }
  /**
   * Loads all directories and files within the root path using cached ids
   * from the {@link Config.ids} file, if any.
   */
  async open() {
    const { _opened, _rootChildDepth, path } = this;
    if (_opened) {
      throw new Error(`FsDriver is already opened - ${path}`);
    }
    const rootStat = await FSP.stat(path);
    // console.log("OPENING", rootStat);
    if (!rootStat.isDirectory()) {
      throw new Error(`Expected path to be a directory.`);
    }
    const srcNodes = (
      await glob(matchAllDirsAndFileExt([".json"]), {
        cwd: path,
        dot: false,
        // ignore: ["node_modules/**"],
        stat: true,
        withFileTypes: true,
      })
    ).sort((a, b) => {
      // IMPORTANT: Sort by path so that parents come before their children and
      // the children are sorted alphabetically.
      const p1 = a.relative(),
        p2 = b.relative();
      return p1 > p2 ? 1 : p2 > p1 ? -1 : 0;
    });
    const dirty = this._nodes.size > 0;
    const nodes = !dirty ? this._nodes : new Map<string, Node>();
    const rootNodes = !dirty ? this._rootNodes : new Set<Node>();
    const dirsByPath = new Map<string, Node>();
    const idsFile = await this.loadIdsFile();

    // Map each srcNode into _nodes and assign parent/child references.
    for (const srcNode of srcNodes) {
      const type = srcNode.getType();
      if (type !== "Directory" && type !== "File") {
        continue;
      }
      const depth = srcNode.depth();
      const isDirectory = srcNode.isDirectory();
      const isRootDepth = depth === _rootChildDepth;
      const pathFromRoot = srcNode.relativePosix();
      // console.log("NODE", srcNode.relative());
      const node = this.createNode(srcNode.name, {
        id: idsFile?.[pathFromRoot],
        isDir: isDirectory,
        stats: srcNode,
      });
      if (isDirectory) {
        dirsByPath.set(pathFromRoot, node);
      }
      if (isRootDepth) {
        rootNodes.add(node);
      } else {
        // Set the parent id. We sorted srcNodes, so parents should always
        // appear before their children. Children should all also be sorted.
        const parentPathFromRoot = srcNode.parent!.relativePosix();
        const parentNode = dirsByPath.get(parentPathFromRoot)!;
        node.entry.pId = parentNode.id;
        parentNode.children!.add(node);
      }
    }
    // Save state.
    this._nodes = nodes;
    this._rootNodes = rootNodes;
    this._opened = true;
  }

  private async writeIdsFile() {
    const { _idsPath, _nodes, _opened } = this;
    if (!_opened || !_idsPath) {
      return;
    }
    const idsFile: IdsFile = {};
    const nodes = _nodes.values();
    for (const node of nodes) {
      const path = this.getNodePath(node);
      idsFile[path] = node.id;
    }
    const idsFileJson = JSON.stringify(idsFile, undefined, 2);
    await FSP.writeFile(_idsPath, idsFileJson);
  }
  // #endregion

  // #region Node Management
  createNode(name: string, { id, isDir, pId, stats }: CreateNodeOptions = {}) {
    const { _nodes } = this;
    if (!id) {
      id = this.createNodeId(isDir);
    } else if (_nodes.has(id)) {
      throw new Error(`Node id already exists - "${id}"`);
    }
    const ctime = stats?.ctime ?? 0;
    const node: Node = {
      // A Node is declared with ONLY it's required fields, so that there are
      // fewer keys to look at when observing changes.
      id,
      entry: {
        name,
        ctime: typeof ctime === "number" ? ctime : ctime.getTime(),
      },
    };
    if (pId) {
      node.entry.pId = pId;
    }
    if (isDir) {
      node.children = new Set<Node>();
    }
    _nodes.set(id, node);
    return node;
  }

  createNodeId(directory?: boolean) {
    const { _nodes } = this;
    const prefix = directory ? "d" : "f";
    let id = prefix + createShortId();
    while (_nodes.has(id)) {
      id = prefix + createShortId();
    }
    return id;
  }
  /**
   * Traverses the tree in depth-first order calling the given callback for
   * each node.
   * @example
   * db.eachNode((node, { depth, order }) => {
   *   console.log(db.getNodePath(node), `item #${order} @ level ${depth}`);
   * });
   */
  eachNode(visit: VisitNodeFn, within?: Node) {
    const rootNodes = within?.children ?? this._rootNodes;
    let i = 0;
    for (const rootNode of rootNodes) {
      const stack = [{ node: rootNode, depth: 0, order: i }];
      let returned: boolean | void | undefined;
      while (stack.length > 0) {
        const { node, depth, order } = stack.pop()!;
        returned = visit(node, { depth, order });
        if (returned === true) {
          return;
        } else if (returned === false) {
          continue;
        }
        if (node.children) {
          const children = [...node.children.values()];
          stack.push(
            ...children
              .map((it, j) => ({
                node: it,
                depth: depth + 1,
                order: j,
              }))
              .reverse(),
          );
        }
      }
      i += 1;
    }
  }
  /**
   * Gets a full path and optionally a node, for the given `id`. When no `id`
   * is given, the path goes to the root folder and no `node` is returned.
   * When an `id` is given, the path goes to the matching `node`. If the given
   * `id` is not found, an **error** is thrown.
   * @example
   * const { node: pNode, path: pPath } = driver.getFullPathMaybeNode(pId);
   */
  getFullPathMaybeNode(id?: string): {
    path: string;
    node?: Node;
  } {
    const { _nodes, path } = this;
    if (!id) {
      return {
        path,
      };
    }
    const node = _nodes.get(id);
    if (!node) {
      throw new Error(`Node not found - "${id}"`);
    }
    return {
      path: Path.join(path, this.getNodePath(node)),
      node,
    };
  }

  getNodeById(id: string): Node | undefined {
    return this._nodes.get(id);
  }

  getNodeByPath(path: string): Node | undefined {
    const parts = path.split("/");
    const { length } = parts;
    const last = length - 1;
    let found: Node | undefined = undefined;
    this.eachNode((node, { depth }) => {
      if (node.entry.name === parts[depth] && depth === last) {
        found = node;
        return true;
      }
    });
    return found;
  }

  getNodeDepth(node: Node) {
    const { _nodes } = this;
    let {
      entry: { pId },
    } = node;
    if (!pId) {
      return 0;
    }
    let depth = 1;
    while (pId) {
      pId = _nodes.get(pId)?.entry.pId;
      depth += 1;
    }
    return depth;
  }

  getNodeFullPath(node: Node, skipCached?: boolean) {
    const nodePath = this.getNodePath(node, skipCached);
    return Path.join(this.path, nodePath);
  }

  getNodePath(node: Node, skipCached?: boolean) {
    const { _nodes, _paths } = this;
    if (!skipCached) {
      const cached = _paths.get(node);
      if (cached) {
        return cached;
      }
    }
    const parts: string[] = [];
    const {
      entry: { name, pId: parentId },
    } = node;
    if (!parentId) {
      _paths.set(node, name);
      return name;
    }
    parts.push(name);
    let pId: string | undefined = parentId;
    while (pId) {
      const parent = _nodes.get(pId);
      if (parent) {
        parts.unshift(parent.entry.name);
        pId = parent.entry.pId;
      } else {
        pId = undefined;
      }
    }
    const path = parts.join("/");
    _paths.set(node, path);
    return path;
  }

  removeNode(node: Node) {
    const { _nodes, _paths } = this;
    this.removeNodeFromParent(node);
    const found = _nodes.delete(node.id);
    // Delete cached path for this node and any children.
    _paths.delete(node);
    if (isDirectoryNode(node)) {
      this.eachNode((node) => {
        _nodes.delete(node.id);
        _paths.delete(node);
      }, node);
    }
    return found;
  }
  /** Delete cached path for this node and any children. */
  removeNodeCachedPaths(node: Node) {
    const { _paths } = this;
    _paths.delete(node);
    if (isDirectoryNode(node)) {
      this.eachNode((child) => {
        _paths.delete(child);
      }, node);
    }
  }

  removeNodeFromParent(
    node: Node,
    parentNode: Node | string | undefined = node.entry.pId,
  ) {
    const { _rootNodes } = this;
    if (!parentNode) {
      _rootNodes.delete(node);
    } else if (typeof parentNode === "string") {
      parentNode = this.getNodeById(parentNode)!;
      parentNode.children!.delete(node);
    } else {
      parentNode.children!.delete(node);
    }
  }

  setNodeParent(node: Node, parentNode?: Node | string) {
    if (!parentNode) {
      this._rootNodes.add(node);
    } else if (typeof parentNode === "string") {
      parentNode = this.getNodeById(parentNode)!;
      parentNode.children!.add(node);
    } else {
      parentNode.children!.add(node);
    }
  }

  sortNodeSiblings(node: Node) {
    const { pId } = node.entry;
    if (!pId) {
      this._rootNodes = sortNodes(this._rootNodes);
    } else {
      const parentNode = this.getNodeById(pId)!;
      parentNode.children = sortNodes(parentNode.children!);
    }
  }
  // #endregion
}

/** Returns a glob pattern to match all directories + files with extensions. */
function matchAllDirsAndFileExt(fileExtensions: string[]) {
  /** e.g. `.json|.jsonc` */
  const extensionsPattern = fileExtensions
    .map((it) => (it.startsWith(".") ? it : "." + it))
    .join("|");
  // See https://stackoverflow.com/questions/50749861
  //
  // Start with **/* to make matches descending into the cwd recursively...
  // Match a list with {}
  //  /                        match all directories
  //  +(.json|.jsonc)          match files with extensions
  // Result
  //  **/*{/,+(.json|.jsonc)}  match all directories or files with extension
  //
  return `**/*{/,+(${extensionsPattern})}`;
}

function orderByNodeName(a: Node, b: Node) {
  const p1 = a.entry.name,
    p2 = b.entry.name;
  return p1 > p2 ? 1 : p2 > p1 ? -1 : 0;
}

function sortNodes(
  nodes: Set<Node>,
  order: (a: Node, b: Node) => number = orderByNodeName,
) {
  return new Set<Node>([...nodes.values()].sort(order));
}
