export type UsageCostStatus = "estimated" | "unavailable";

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TurnUsage extends ChatUsage {
  model: string;
  recordedAt: string;
  estimatedCostUsd?: number;
  costStatus: UsageCostStatus;
}

export interface SessionUsageTotals extends ChatUsage {
  estimatedCostUsd?: number;
  costStatus: UsageCostStatus;
  turnCount: number;
}

export interface UsageSummary {
  turn: TurnUsage;
  session: SessionUsageTotals;
}

interface RawChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface TokenPriceConfig {
  inputPricePer1kUsd: number;
  outputPricePer1kUsd: number;
}

export function normalizeChatUsage(raw?: RawChatUsage | null): ChatUsage | undefined {
  if (!raw) return undefined;

  const inputTokens = normalizeTokenCount(raw.prompt_tokens ?? raw.input_tokens);
  const outputTokens = normalizeTokenCount(raw.completion_tokens ?? raw.output_tokens);
  const providedTotal = normalizeTokenCount(raw.total_tokens);
  const totalTokens = providedTotal || inputTokens + outputTokens;

  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export function sumChatUsage(
  left?: ChatUsage,
  right?: ChatUsage,
): ChatUsage | undefined {
  if (!left) return right;
  if (!right) return left;

  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

export function buildTurnUsage(
  model: string,
  usage?: ChatUsage,
  recordedAt = new Date().toISOString(),
): TurnUsage | undefined {
  if (!usage) return undefined;

  const estimatedCostUsd = estimateUsageCostUsd(model, usage);

  return {
    ...usage,
    model,
    recordedAt,
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
    costStatus: estimatedCostUsd !== undefined ? "estimated" : "unavailable",
  };
}

export function summarizeUsageHistory(history: readonly TurnUsage[]): SessionUsageTotals {
  const totals = history.reduce<SessionUsageTotals>(
    (acc, usage) => ({
      inputTokens: acc.inputTokens + usage.inputTokens,
      outputTokens: acc.outputTokens + usage.outputTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
      turnCount: acc.turnCount + 1,
      costStatus: acc.costStatus,
      ...(acc.estimatedCostUsd !== undefined
        && usage.costStatus === "estimated"
        && usage.estimatedCostUsd !== undefined
        ? { estimatedCostUsd: roundUsd(acc.estimatedCostUsd + usage.estimatedCostUsd) }
        : {}),
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      turnCount: 0,
      estimatedCostUsd: 0,
      costStatus: "estimated",
    },
  );

  const hasEstimatedCost = history.length > 0
    && history.every((usage) => usage.costStatus === "estimated" && usage.estimatedCostUsd !== undefined);

  return {
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalTokens: totals.totalTokens,
    turnCount: totals.turnCount,
    ...(hasEstimatedCost && totals.estimatedCostUsd !== undefined
      ? { estimatedCostUsd: roundUsd(totals.estimatedCostUsd) }
      : {}),
    costStatus: hasEstimatedCost ? "estimated" : "unavailable",
  };
}

export function buildUsageSummary(
  turn: TurnUsage,
  history: readonly TurnUsage[],
): UsageSummary {
  return {
    turn,
    session: summarizeUsageHistory(history),
  };
}

function estimateUsageCostUsd(model: string, usage: ChatUsage): number | undefined {
  const pricing = resolveTokenPriceConfig(model);
  if (!pricing) return undefined;

  const inputCost = (usage.inputTokens / 1000) * pricing.inputPricePer1kUsd;
  const outputCost = (usage.outputTokens / 1000) * pricing.outputPricePer1kUsd;
  return roundUsd(inputCost + outputCost);
}

function resolveTokenPriceConfig(model: string): TokenPriceConfig | undefined {
  const upperModel = model.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const candidatePrefixes = [
    `AZURE_OPENAI_USAGE_${upperModel}`,
    model.toLowerCase().includes("codex") ? "AZURE_OPENAI_CODEX" : "AZURE_OPENAI_CHAT",
    "AZURE_OPENAI",
  ];

  for (const prefix of candidatePrefixes) {
    const inputPricePer1kUsd = readUsdNumber(process.env[`${prefix}_INPUT_PRICE_PER_1K_USD`]);
    const outputPricePer1kUsd = readUsdNumber(process.env[`${prefix}_OUTPUT_PRICE_PER_1K_USD`]);
    if (inputPricePer1kUsd !== undefined && outputPricePer1kUsd !== undefined) {
      return { inputPricePer1kUsd, outputPricePer1kUsd };
    }
  }

  return undefined;
}

function normalizeTokenCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function readUsdNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
