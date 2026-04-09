/**
 * B-25 — Hybrid action model: unified ActionSchema
 *
 * Contract tests validating that:
 *   • All buttons use A2UI ActionSchema (not custom reply format)
 *   • Action format is consistent across all component types
 *   • The ButtonAction interface enforces the canonical event shape
 *   • Backward compatibility with existing action formats
 *
 * These are schema-level tests — they verify type contracts and structural
 * invariants, not runtime behavior. Written TDD-style.
 */

import { describe, it, expect } from "vitest";
import type {
  ButtonComponent,
  ButtonAction,
  TextFieldComponent,
  CheckBoxComponent,
  ChoicePickerComponent,
  SliderComponent,
  Component,
} from "../catalog/index.js";

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a valid ButtonComponent with the given action. */
function makeButton(
  id: string,
  action: ButtonAction,
  overrides: Partial<ButtonComponent> = {},
): ButtonComponent {
  return {
    id,
    component: "Button",
    child: `${id}-label`,
    action,
    ...overrides,
  };
}

/** Build a valid ButtonAction with A2UI ActionSchema event format. */
function makeAction(
  name: string,
  data?: Record<string, unknown>,
): ButtonAction {
  return {
    event: { name, ...(data !== undefined ? { data } : {}) },
  };
}

/**
 * Validate that an action conforms to the A2UI ActionSchema.
 * Returns true if the action has the canonical { event: { name, data? } } shape.
 */
function isValidActionSchema(action: unknown): boolean {
  if (!action || typeof action !== "object") return false;
  const a = action as Record<string, unknown>;
  if (!a.event || typeof a.event !== "object") return false;
  const event = a.event as Record<string, unknown>;
  if (typeof event.name !== "string" || event.name.length === 0) return false;
  if (event.data !== undefined && (typeof event.data !== "object" || event.data === null)) {
    return false;
  }
  return true;
}

// ── A2UI ActionSchema conformance ───────────────────────────────────

describe("B-25: ActionSchema — canonical event format", () => {
  it("ButtonAction requires event.name as a non-empty string", () => {
    const action = makeAction("advance");
    expect(isValidActionSchema(action)).toBe(true);
    expect(action.event.name).toBe("advance");
  });

  it("ButtonAction allows optional event.data object", () => {
    const action = makeAction("select", { runtime: "node" });
    expect(isValidActionSchema(action)).toBe(true);
    expect(action.event.data).toEqual({ runtime: "node" });
  });

  it("ButtonAction without data is valid", () => {
    const action = makeAction("skip");
    expect(isValidActionSchema(action)).toBe(true);
    expect(action.event.data).toBeUndefined();
  });

  it("rejects action with empty event name", () => {
    const action: ButtonAction = { event: { name: "" } };
    expect(isValidActionSchema(action)).toBe(false);
  });

  it("rejects action with missing event object", () => {
    expect(isValidActionSchema({})).toBe(false);
    expect(isValidActionSchema({ event: null })).toBe(false);
  });

  it("rejects action with non-object event.data", () => {
    const action = { event: { name: "test", data: "not-an-object" } };
    expect(isValidActionSchema(action)).toBe(false);
  });

  it("rejects null action", () => {
    expect(isValidActionSchema(null)).toBe(false);
  });

  it("rejects primitive action", () => {
    expect(isValidActionSchema("advance")).toBe(false);
    expect(isValidActionSchema(42)).toBe(false);
  });
});

describe("B-25: ActionSchema — all action types use canonical format", () => {
  const actionTypes = [
    { name: "advance", desc: "advance to next phase" },
    { name: "skip", desc: "skip current phase" },
    { name: "select", desc: "select a value" },
    { name: "submit", desc: "submit form data" },
    { name: "reply", desc: "reply with a message" },
    { name: "navigate", desc: "navigate to a phase" },
    { name: "api", desc: "call an API" },
  ];

  for (const { name, desc } of actionTypes) {
    it(`"${name}" (${desc}) uses A2UI ActionSchema format`, () => {
      const action = makeAction(name, { key: "value" });
      expect(isValidActionSchema(action)).toBe(true);

      // Verify the structure matches ButtonAction interface
      const button = makeButton(`btn-${name}`, action);
      expect(button.action.event.name).toBe(name);
      expect(button.component).toBe("Button");
    });
  }
});

describe("B-25: ActionSchema — Button components", () => {
  it("Button component has required action property", () => {
    const button = makeButton("btn-1", makeAction("advance"));
    expect(button.action).toBeDefined();
    expect(button.action.event).toBeDefined();
    expect(button.action.event.name).toBeTruthy();
  });

  it("primary button action follows ActionSchema", () => {
    const button = makeButton("btn-primary", makeAction("submit", { confirmed: true }), {
      variant: "primary",
    });

    expect(isValidActionSchema(button.action)).toBe(true);
    expect(button.variant).toBe("primary");
    expect(button.action.event.data).toEqual({ confirmed: true });
  });

  it("danger button action follows ActionSchema", () => {
    const button = makeButton("btn-danger", makeAction("skip"), {
      variant: "danger",
    });

    expect(isValidActionSchema(button.action)).toBe(true);
    expect(button.variant).toBe("danger");
  });

  it("disabled button still has valid action schema", () => {
    const button = makeButton("btn-disabled", makeAction("advance"), {
      disabled: true,
    });

    expect(isValidActionSchema(button.action)).toBe(true);
    expect(button.disabled).toBe(true);
  });
});

describe("B-25: ActionSchema — input component actions", () => {
  it("TextField action uses the same event.name format", () => {
    const field: TextFieldComponent = {
      id: "tf-1",
      component: "TextField",
      label: "App name",
      placeholder: "my-app",
      action: { event: { name: "select" } },
    };

    expect(field.action).toBeDefined();
    expect(field.action!.event.name).toBe("select");
  });

  it("CheckBox action uses the same event.name format", () => {
    const checkbox: CheckBoxComponent = {
      id: "cb-1",
      component: "CheckBox",
      label: "Enable ingress",
      checked: false,
      action: { event: { name: "select" } },
    };

    expect(checkbox.action).toBeDefined();
    expect(checkbox.action!.event.name).toBe("select");
  });

  it("ChoicePicker action uses the same event.name format", () => {
    const picker: ChoicePickerComponent = {
      id: "cp-1",
      component: "ChoicePicker",
      label: "Runtime",
      options: [
        { label: "Node.js", value: "node" },
        { label: "Python", value: "python" },
      ],
      action: { event: { name: "select" } },
    };

    expect(picker.action).toBeDefined();
    expect(picker.action!.event.name).toBe("select");
  });

  it("Slider action uses the same event.name format", () => {
    const slider: SliderComponent = {
      id: "sl-1",
      component: "Slider",
      label: "Port",
      min: 1024,
      max: 65535,
      value: 8080,
      action: { event: { name: "select" } },
    };

    expect(slider.action).toBeDefined();
    expect(slider.action!.event.name).toBe("select");
  });

  it("all input components share the same action event interface", () => {
    // Structural check: input actions have { event: { name: string } }
    const inputActions = [
      { event: { name: "select" } },
      { event: { name: "submit" } },
      { event: { name: "reply" } },
    ];

    for (const action of inputActions) {
      expect(typeof action.event.name).toBe("string");
      expect(action.event.name.length).toBeGreaterThan(0);
    }
  });
});

describe("B-25: ActionSchema — unified format across component types", () => {
  it("Button and TextField use structurally compatible action formats", () => {
    const buttonAction: ButtonAction = makeAction("submit", { name: "my-app" });
    const fieldAction = { event: { name: "select" } };

    // Both have event.name
    expect(typeof buttonAction.event.name).toBe("string");
    expect(typeof fieldAction.event.name).toBe("string");

    // Both follow the same shape
    expect(buttonAction.event).toHaveProperty("name");
    expect(fieldAction.event).toHaveProperty("name");
  });

  it("no component uses a custom reply format (only ActionSchema)", () => {
    // Build components representing a typical kickstart conversation turn
    const components: Component[] = [
      {
        id: "txt-welcome",
        component: "Text",
        text: "What runtime does your app use?",
      },
      {
        id: "btn-node",
        component: "Button",
        child: "lbl-node",
        action: makeAction("select", { runtime: "node" }),
      },
      {
        id: "btn-python",
        component: "Button",
        child: "lbl-python",
        action: makeAction("select", { runtime: "python" }),
      },
      {
        id: "btn-skip",
        component: "Button",
        child: "lbl-skip",
        action: makeAction("skip"),
        variant: "ghost",
      },
    ];

    // Every button must use ActionSchema — no `{ reply: "..." }` format
    const buttons = components.filter(
      (c): c is ButtonComponent => c.component === "Button",
    );

    for (const button of buttons) {
      expect(isValidActionSchema(button.action)).toBe(true);
      // Must NOT have a raw `reply` property at the top level
      expect(button).not.toHaveProperty("reply");
      // action.event must exist
      expect(button.action.event).toBeDefined();
      expect(button.action.event.name).toBeTruthy();
    }
  });
});

describe("B-25: ActionSchema — backward compatibility", () => {
  it("existing advance/skip/select/submit actions still work with ActionSchema", () => {
    const legacyActionTypes = ["advance", "skip", "select", "submit"];

    for (const actionType of legacyActionTypes) {
      const action = makeAction(actionType);
      expect(isValidActionSchema(action)).toBe(true);

      const button = makeButton(`btn-${actionType}`, action);
      expect(button.action.event.name).toBe(actionType);
    }
  });

  it("new action types (reply, navigate, api) follow the same schema", () => {
    const newActionTypes = ["reply", "navigate", "api"];

    for (const actionType of newActionTypes) {
      const action = makeAction(actionType, { context: "test" });
      expect(isValidActionSchema(action)).toBe(true);

      const button = makeButton(`btn-${actionType}`, action);
      expect(button.action.event.name).toBe(actionType);
      expect(button.action.event.data).toEqual({ context: "test" });
    }
  });

  it("action data can carry complex nested structures", () => {
    const action = makeAction("submit", {
      appDefinition: {
        name: "my-service",
        runtime: "dotnet",
        port: 5000,
        envVars: ["API_KEY", "DB_URL"],
      },
    });

    expect(isValidActionSchema(action)).toBe(true);
    expect(action.event.data!.appDefinition).toBeDefined();
  });

  it("existing ButtonAction type is compatible with ActionSchema", () => {
    // The existing type: { event: { name: string, data?: Record<string, unknown> } }
    // Should be forward-compatible with the new unified schema
    const existing: ButtonAction = {
      event: { name: "advance", data: { phase: "design" } },
    };

    expect(isValidActionSchema(existing)).toBe(true);
    expect(existing.event.name).toBe("advance");
  });
});
