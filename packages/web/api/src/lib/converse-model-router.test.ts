import { describe, expect, it, vi } from "vitest";
import { Phase } from "@kickstart/core";

vi.mock("./openai-client.js", () => ({
  getChatDeploymentName: () => "gpt-5.4-mini",
  getGenerateDeploymentName: () => "gpt-5.4",
}));

import {
  normalizeConversePhase,
  resolveConverseModelRoute,
} from "./converse-model-router.js";

describe("converse-model-router", () => {
  it("normalizes known phases and rejects unknown ones", () => {
    expect(normalizeConversePhase(Phase.Generate)).toBe(Phase.Generate);
    expect(normalizeConversePhase("ship-it")).toBeUndefined();
    expect(normalizeConversePhase(undefined)).toBeUndefined();
  });

  it("routes only trusted generate turns to the coding deployment", () => {
    expect(
      resolveConverseModelRoute(Phase.Generate, { trustedPhase: true }),
    ).toMatchObject({
      deployment: "gpt-5.4",
      model: "gpt-5.4",
      pricingGroup: "generate",
    });
  });

  it.each([
    Phase.Discover,
    Phase.Design,
    Phase.Review,
    Phase.Handoff,
    Phase.Deploy,
  ])("keeps %s on the chat deployment", (phase) => {
    expect(
      resolveConverseModelRoute(phase, { trustedPhase: true }),
    ).toMatchObject({
      deployment: "gpt-5.4-mini",
      model: "gpt-5.4-mini",
      pricingGroup: "chat",
    });
  });

  it("fails closed to chat for untrusted or unknown generate-like phases", () => {
    expect(
      resolveConverseModelRoute(Phase.Generate, { trustedPhase: false }),
    ).toMatchObject({
      deployment: "gpt-5.4-mini",
      model: "gpt-5.4-mini",
      pricingGroup: "chat",
    });
    expect(
      resolveConverseModelRoute("generate", { trustedPhase: false }),
    ).toMatchObject({
      deployment: "gpt-5.4-mini",
      model: "gpt-5.4-mini",
      pricingGroup: "chat",
    });
    expect(
      resolveConverseModelRoute("ship-it", { trustedPhase: true }),
    ).toMatchObject({
      deployment: "gpt-5.4-mini",
      model: "gpt-5.4-mini",
      pricingGroup: "chat",
    });
  });
});
