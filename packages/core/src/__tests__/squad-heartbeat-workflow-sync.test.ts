import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  const filePath = fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url));
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

describe("squad-heartbeat workflow sync", () => {
  it("keeps the installed template in sync with the active workflow", () => {
    const activeWorkflow = readRepoFile(".github/workflows/squad-heartbeat.yml");
    const installedTemplate = readRepoFile(".squad/templates/workflows/squad-heartbeat.yml");

    expect(installedTemplate).toBe(activeWorkflow);
  });
});
