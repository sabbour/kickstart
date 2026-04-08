import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appHtmlPath = resolve(__dirname, "..", "app", "kickstart-app.html");

describe("kickstart-app.html", () => {
  it("exists in the source tree", () => {
    expect(existsSync(appHtmlPath)).toBe(true);
  });

  it("is valid HTML with required structure", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("contains the messages container", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain('id="messages"');
  });

  it("contains the input area", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain('id="input"');
    expect(html).toContain('id="send-btn"');
  });

  it("contains the phase bar", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain('id="phase-bar"');
  });

  it("implements the postMessage protocol", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain("postMessage");
    expect(html).toContain('"kickstart"');
    expect(html).toContain('"converse"');
    expect(html).toContain('"action"');
  });

  it("contains all A2UI component renderers", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    const requiredRenderers = [
      "Text", "Button", "TextField", "Row", "Column", "Card", "Tabs",
      "ConversationPhase", "CodeBlock", "ResourcePicker",
      "DeploymentProgress", "ArchitectureDiagram", "CostEstimate", "HandoffCard",
      "RepoPicker", "WorkflowStatus", "CodespaceLink", "AppOverview",
    ];
    for (const renderer of requiredRenderers) {
      expect(html).toContain(renderer);
    }
  });

  it("includes dark mode support", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain("prefers-color-scheme: dark");
  });

  it("includes Fluent 2 design tokens", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain("--color-brand-primary");
    expect(html).toContain("--font-family-base");
    expect(html).toContain("--spacing-");
    expect(html).toContain("--radius-");
  });

  it("includes all 6 conversation phases", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    expect(html).toContain("Discover");
    expect(html).toContain("Design");
    expect(html).toContain("Generate");
    expect(html).toContain("Review");
    expect(html).toContain("Handoff");
    expect(html).toContain("Deploy");
  });

  it("auto-sends kickstart on load", () => {
    const html = readFileSync(appHtmlPath, "utf-8");
    // Should send kickstart message to parent on boot
    expect(html).toContain('sendToServer({ type: "kickstart" })');
  });
});
