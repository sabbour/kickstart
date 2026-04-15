import { describe, expect, it } from "vitest";
import { sanitizeActionContext } from "../utils/sanitize-action-context";

describe("sanitizeActionContext", () => {
  it("preserves GitHub repository selection keys", () => {
    expect(sanitizeActionContext({
      value: "sabbour/demo-app",
      owner: "sabbour",
      repo: "demo-app",
      visibility: "private",
      ignored: "drop-me",
    })).toEqual({
      value: "sabbour/demo-app",
      owner: "sabbour",
      repo: "demo-app",
      visibility: "private",
    });
  });
});
