/**
 * Tests for the filesystem abstraction layer.
 *
 * Covers:
 *  - Path sanitisation (traversal, absolute, backslash rejection)
 *  - InMemoryFileSystemProvider (read/write/list/delete/exists)
 *  - CloudShellProvider (connector-based, mocked HTTP)
 *  - FileSystemProviderRegistry (register, active, switch)
 *  - FS tools (fs_read, fs_write, fs_list, fs_delete) via ToolContext
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import { sanitizePath } from "../filesystem/path-utils.js";
import { InvalidPathError, FileNotFoundError } from "../filesystem/types.js";
import { InMemoryFileSystemProvider } from "../filesystem/in-memory-provider.js";
import { CloudShellProvider } from "../filesystem/cloud-shell-provider.js";
import { FileSystemProviderRegistry } from "../filesystem/registry.js";

import { fsRead } from "../tools/fs-read.js";
import { fsWrite } from "../tools/fs-write.js";
import { fsList } from "../tools/fs-list.js";
import { fsDelete } from "../tools/fs-delete.js";

import { InMemoryArtifactStore } from "../artifacts/in-memory.js";
import type { ToolContext } from "../tools/types.js";
import type { APIConnector } from "../connectors/types.js";

// ── Path sanitisation ────────────────────────────────────────────────────────

describe("sanitizePath", () => {
  it("passes a simple relative path through", () => {
    expect(sanitizePath("k8s/deployment.yaml")).toBe("k8s/deployment.yaml");
  });

  it("collapses duplicate slashes", () => {
    expect(sanitizePath("a//b///c")).toBe("a/b/c");
  });

  it("strips trailing slash", () => {
    expect(sanitizePath("dir/")).toBe("dir");
  });

  it("rejects absolute paths", () => {
    expect(() => sanitizePath("/etc/passwd")).toThrow(InvalidPathError);
  });

  it("rejects traversal segments", () => {
    expect(() => sanitizePath("a/../b")).toThrow(InvalidPathError);
    expect(() => sanitizePath("..")).toThrow(InvalidPathError);
  });

  it("rejects backslashes", () => {
    expect(() => sanitizePath("a\\b")).toThrow(InvalidPathError);
  });

  it("rejects empty path", () => {
    expect(() => sanitizePath("")).toThrow(InvalidPathError);
    expect(() => sanitizePath("   ")).toThrow(InvalidPathError);
  });

  it("filters out single-dot segments (current dir marker)", () => {
    expect(sanitizePath("./a/b")).toBe("a/b");
  });
});

// ── InMemoryFileSystemProvider ───────────────────────────────────────────────

describe("InMemoryFileSystemProvider", () => {
  let fs: InMemoryFileSystemProvider;

  beforeEach(() => {
    fs = new InMemoryFileSystemProvider();
  });

  it("write then read", async () => {
    await fs.write("hello.txt", "world");
    expect(await fs.read("hello.txt")).toBe("world");
  });

  it("read non-existent throws FileNotFoundError", async () => {
    await expect(fs.read("nope.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("exists returns true/false", async () => {
    expect(await fs.exists("a.txt")).toBe(false);
    await fs.write("a.txt", "data");
    expect(await fs.exists("a.txt")).toBe(true);
  });

  it("delete removes a file", async () => {
    await fs.write("a.txt", "data");
    await fs.delete("a.txt");
    expect(await fs.exists("a.txt")).toBe(false);
  });

  it("delete non-existent is a no-op", async () => {
    await expect(fs.delete("nothing.txt")).resolves.toBeUndefined();
  });

  it("overwrite replaces content", async () => {
    await fs.write("f.txt", "v1");
    await fs.write("f.txt", "v2");
    expect(await fs.read("f.txt")).toBe("v2");
    expect(fs.size).toBe(1);
  });

  it("list returns files and subdirectories", async () => {
    await fs.write("a.txt", "1");
    await fs.write("dir/b.txt", "2");
    await fs.write("dir/c.txt", "3");
    await fs.write("dir/sub/d.txt", "4");

    const root = await fs.list(".");
    expect(root).toHaveLength(2); // a.txt + dir/
    expect(root.find((e) => e.path === "a.txt")?.type).toBe("file");
    expect(root.find((e) => e.path === "dir")?.type).toBe("directory");

    const dirEntries = await fs.list("dir");
    expect(dirEntries).toHaveLength(3); // b.txt, c.txt, sub/
    expect(dirEntries.find((e) => e.path === "dir/b.txt")?.type).toBe("file");
    expect(dirEntries.find((e) => e.path === "dir/sub")?.type).toBe("directory");
  });

  it("list empty directory returns empty array", async () => {
    const entries = await fs.list(".");
    expect(entries).toEqual([]);
  });

  it("rejects path traversal on read", async () => {
    await expect(fs.read("../secret")).rejects.toThrow(InvalidPathError);
  });

  it("rejects absolute path on write", async () => {
    await expect(fs.write("/etc/shadow", "bad")).rejects.toThrow(InvalidPathError);
  });
});

// ── CloudShellProvider ───────────────────────────────────────────────────────

describe("CloudShellProvider", () => {
  function mockConnector(
    handler: (method: string, path: string, body?: unknown) => Response | Promise<Response>,
  ): APIConnector {
    return {
      name: "cloud-shell-mock",
      baseUrl: "https://cloud-shell.example.com",
      authenticate: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockReturnValue(true),
      request: vi.fn(
        (method: string, path: string, body?: unknown) => Promise.resolve(handler(method, path, body)),
      ) as any,
    };
  }

  it("read calls GET /api/fs/{basePath}/{path}", async () => {
    const connector = mockConnector((_m, path) => {
      expect(path).toBe("/api/fs/home/project/file.txt");
      return new Response("hello", { status: 200 });
    });

    const cs = new CloudShellProvider(connector, "/home/project");
    const content = await cs.read("file.txt");
    expect(content).toBe("hello");
  });

  it("read 404 throws FileNotFoundError", async () => {
    const connector = mockConnector(() =>
      new Response("", { status: 404, statusText: "Not Found" }),
    );

    const cs = new CloudShellProvider(connector, "/home");
    await expect(cs.read("missing.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("write calls PUT", async () => {
    const connector = mockConnector((method, path) => {
      expect(method).toBe("PUT");
      expect(path).toBe("/api/fs/home/out.yaml");
      return new Response("", { status: 200 });
    });

    const cs = new CloudShellProvider(connector, "/home");
    await cs.write("out.yaml", "apiVersion: v1");
  });

  it("delete 404 is a no-op", async () => {
    const connector = mockConnector(() =>
      new Response("", { status: 404 }),
    );

    const cs = new CloudShellProvider(connector, "/home");
    await expect(cs.delete("gone.txt")).resolves.toBeUndefined();
  });

  it("rejects path traversal", async () => {
    const connector = mockConnector(() => new Response("", { status: 200 }));
    const cs = new CloudShellProvider(connector, "/home");
    await expect(cs.read("../etc/passwd")).rejects.toThrow(InvalidPathError);
  });

  it("list parses JSON response", async () => {
    const connector = mockConnector((_m, _p) =>
      new Response(
        JSON.stringify([
          { name: "app.ts", type: "file", size: 120 },
          { name: "k8s", type: "directory" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const cs = new CloudShellProvider(connector, "/home");
    const entries = await cs.list("project");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      path: "project/app.ts",
      type: "file",
      size: 120,
      modifiedAt: undefined,
    });
    expect(entries[1]).toEqual({
      path: "project/k8s",
      type: "directory",
      size: undefined,
      modifiedAt: undefined,
    });
  });

  it("exists returns true on 200", async () => {
    const connector = mockConnector(() => new Response("data", { status: 200 }));
    const cs = new CloudShellProvider(connector, "/home");
    expect(await cs.exists("file.txt")).toBe(true);
  });

  it("exists returns false on 404", async () => {
    const connector = mockConnector(() => new Response("", { status: 404 }));
    const cs = new CloudShellProvider(connector, "/home");
    expect(await cs.exists("file.txt")).toBe(false);
  });
});

// ── FileSystemProviderRegistry ───────────────────────────────────────────────

describe("FileSystemProviderRegistry", () => {
  let registry: FileSystemProviderRegistry;

  beforeEach(() => {
    registry = new FileSystemProviderRegistry();
  });

  it("auto-activates first registered provider", () => {
    const mem = new InMemoryFileSystemProvider();
    registry.register(mem);
    expect(registry.active).toBe(mem);
    expect(registry.hasActive).toBe(true);
  });

  it("throws if no provider is active", () => {
    expect(() => registry.active).toThrow("No filesystem provider is active");
    expect(registry.hasActive).toBe(false);
  });

  it("setActive switches providers", () => {
    const a = new InMemoryFileSystemProvider();
    // Create a second provider with a different name
    const b = { ...a, name: "other" } as any;
    registry.register(a);
    registry.register(b);
    registry.setActive("other");
    expect(registry.active.name).toBe("other");
  });

  it("setActive rejects unknown name", () => {
    expect(() => registry.setActive("nope")).toThrow("not registered");
  });

  it("unregister clears active if it was the active provider", () => {
    const mem = new InMemoryFileSystemProvider();
    registry.register(mem);
    registry.unregister("in-memory");
    expect(registry.hasActive).toBe(false);
  });

  it("listNames returns all registered names", () => {
    const a = new InMemoryFileSystemProvider();
    registry.register(a);
    expect(registry.listNames()).toEqual(["in-memory"]);
  });
});

// ── FS Tools ─────────────────────────────────────────────────────────────────

describe("FS tools", () => {
  let mem: InMemoryFileSystemProvider;
  let ctx: ToolContext;

  beforeEach(() => {
    mem = new InMemoryFileSystemProvider();
    ctx = {
      artifactStore: new InMemoryArtifactStore(),
      fileSystem: mem,
    };
  });

  describe("fs_read", () => {
    it("reads an existing file", async () => {
      await mem.write("readme.md", "# Hello");
      const result = (await fsRead.execute({ path: "readme.md" }, ctx)) as any;
      expect(result.content).toBe("# Hello");
      expect(result.path).toBe("readme.md");
    });

    it("returns error for missing file", async () => {
      const result = (await fsRead.execute({ path: "nope" }, ctx)) as any;
      expect(result.error).toContain("File not found");
    });

    it("returns error when no filesystem available", async () => {
      const noFsCtx: ToolContext = { artifactStore: new InMemoryArtifactStore() };
      const result = (await fsRead.execute({ path: "x" }, noFsCtx)) as any;
      expect(result.error).toContain("No filesystem provider");
    });
  });

  describe("fs_write", () => {
    it("requires approval", () => {
      expect(fsWrite.requireApproval).toBe(true);
    });

    it("writes a file", async () => {
      const result = (await fsWrite.execute(
        { path: "out.yaml", content: "key: val" },
        ctx,
      )) as any;
      expect(result.message).toContain("out.yaml");
      expect(await mem.read("out.yaml")).toBe("key: val");
    });
  });

  describe("fs_list", () => {
    it("lists directory contents", async () => {
      await mem.write("a.txt", "1");
      await mem.write("b.txt", "2");
      const result = (await fsList.execute({ directory: "." }, ctx)) as any;
      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);
    });
  });

  describe("fs_delete", () => {
    it("requires approval", () => {
      expect(fsDelete.requireApproval).toBe(true);
    });

    it("deletes an existing file", async () => {
      await mem.write("x.txt", "data");
      const result = (await fsDelete.execute({ path: "x.txt" }, ctx)) as any;
      expect(result.deleted).toBe(true);
      expect(await mem.exists("x.txt")).toBe(false);
    });

    it("reports no-op for missing file", async () => {
      const result = (await fsDelete.execute({ path: "gone.txt" }, ctx)) as any;
      expect(result.deleted).toBe(false);
      expect(result.message).toContain("no-op");
    });
  });
});
