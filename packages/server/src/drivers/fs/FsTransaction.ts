import Path from "node:path";
// import FS from "node:fs";
import FSP from "node:fs/promises";
// Local
import { Transaction, NodeVisitorFn } from "@/types";
import type { FsDriver } from "./FsDriver";
import { isDirectoryNode } from "./types";

export default class FsTransaction implements Transaction {
  driver: FsDriver;
  constructor(driver: FsDriver) {
    this.driver = driver;
  }
  // #region Transaction Control
  commit() {
    throw new Error("Not implemented");
  }

  rollback() {
    throw new Error("Not implemented");
  }
  // #endregion

  // #region File System Node Queries
  /** Adds a directory to the given parent node id and returns a new node id. */
  async addDirectory(name: string, pId?: string | null): Promise<string> {
    name = name.trim();
    pId = pId ?? undefined;
    const { driver } = this;
    const { node: parentNode, path: parentPath } =
      driver.getFullPathMaybeNode(pId);
    // Make directory
    const newPath = Path.join(parentPath, name);
    await FSP.mkdir(newPath, { recursive: true });
    // Create node
    const node = driver.createNode(name, {
      isDir: true,
      pId,
      stats: await FSP.stat(newPath),
    });
    driver.setNodeParent(node, parentNode);
    driver.sortNodeSiblings(node);
    return node.id;
  }
  /** Adds a file to the given parent node id and returns a new node id. */
  async addFile(
    name: string,
    {
      data,
      pId,
    }: {
      data: unknown;
      pId?: string | null;
    },
  ) {
    name = name.trim();
    pId = pId ?? undefined;
    const { driver } = this;
    const { node: parentNode, path: parentPath } =
      driver.getFullPathMaybeNode(pId);
    // Write file
    const newPath = Path.join(parentPath, name);
    const json = JSON.stringify(data, undefined, 2);
    await FSP.writeFile(newPath, json);
    // Create node
    const node = driver.createNode(name, {
      isDir: false,
      pId,
      stats: await FSP.stat(newPath),
    });
    driver.setNodeParent(node, parentNode);
    driver.sortNodeSiblings(node);
    return node.id;
  }
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
  eachNode(visit: NodeVisitorFn, withinId?: string) {
    const { driver } = this;
    const within = withinId ? driver.getNodeById(withinId) : undefined;
    driver.eachNode((node, index) => {
      const {
        id,
        entry: { ctime, name, pId },
      } = node;
      visit(
        {
          ctime,
          id,
          name,
          pId,
          isDir: isDirectoryNode(node),
          path: driver.getNodePath(node),
        },
        index,
      );
    }, within);
  }
  /**
   * Returns the id used to refer to the given path. The path be relative to
   * the database root, e.g. `"my/folder/file.json"` or `"my/folder"`.
   */
  id(path: string): string | undefined {
    path = path.trim();
    if (path.endsWith("/")) path = path.substring(0, path.length - 1);
    const node = this.driver.getNodeByPath(path);
    return node ? node.id : undefined;
  }
  /**
   * Moves a directory or file id into a new parent directory or the root (when
   * `toId` is missing) and returns the new path.
   */
  async move(id: string, toId: string | null): Promise<string> {
    const { driver } = this;
    const node = driver.getNodeById(id);
    if (!node) throw new Error(`Node not found - "${id}"`);
    const { node: newParent, path: newParentPath } =
      driver.getFullPathMaybeNode(toId ?? undefined);
    // Rename
    const fullPath = driver.getNodeFullPath(node);
    const newPath = Path.join(newParentPath, node.entry.name);
    await FSP.rename(fullPath, newPath);
    // Update our node
    const { entry } = node;
    entry.ctime = (await FSP.stat(newPath)).ctime.getTime();
    driver.removeNodeCachedPaths(node);
    driver.removeNodeFromParent(node);
    driver.setNodeParent(node, newParent);
    driver.sortNodeSiblings(node);
    return driver.getNodePath(node);
  }
  /** Returns the path for the given node id. */
  path(id: string): string | undefined {
    const { driver } = this;
    const node = driver.getNodeById(id);
    if (!node) {
      return undefined;
    }
    return driver.getNodePath(node);
  }
  /** Removes a directory or file by id returning `true` if successful. */
  async remove(id: string): Promise<boolean> {
    const { driver } = this;
    const node = driver.getNodeById(id);
    if (!node) {
      return false;
    }
    // Remove
    const fullPath = driver.getNodeFullPath(node);
    // console.log("REMOVING", fullPath);
    await FSP.rm(fullPath, { recursive: true });
    // Update our nodes
    return driver.removeNode(node);
  }
  /** Renames a directory or file by id and returns the new path. */
  async rename(id: string, name: string): Promise<string> {
    // TODO: Validate that name doesn't contain slashes.
    const { driver } = this;
    const node = driver.getNodeById(id);
    if (!node) throw new Error(`Node not found - "${id}"`);
    // Rename
    const fullPath = driver.getNodeFullPath(node);
    const newPath = Path.join(fullPath, `../${name}`);
    await FSP.rename(fullPath, newPath);
    // Update our node
    const { entry } = node;
    entry.name = name;
    entry.ctime = (await FSP.stat(newPath)).ctime.getTime();
    driver.removeNodeCachedPaths(node);
    driver.sortNodeSiblings(node);
    return driver.getNodePath(node);
  }
  // #endregion
}
