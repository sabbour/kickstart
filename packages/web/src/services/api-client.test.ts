import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, SessionExpiredError } from "./api-client";

describe("apiFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("uses manual redirects for SWA-authenticated /api calls and only adds the debug header", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await apiFetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/converse", expect.objectContaining({
      method: "POST",
      redirect: "manual",
    }));

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-kickstart-debug")).toBe("true");
    expect(headers.get("authorization")).toBeNull();
  });

  it("throws SessionExpiredError when SWA redirects the browser to login", async () => {
    fetchMock.mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: "/.auth/login/aad?post_login_redirect_uri=/" },
    }));

    await expect(apiFetch("/api/deployments")).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("returns the backend response when SWA auth does not redirect", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    fetchMock.mockResolvedValue(response);

    await expect(apiFetch("/api/deployments/run-123")).resolves.toBe(response);
  });
});
