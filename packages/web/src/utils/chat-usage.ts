import type { ChatMessage, SessionUsageTotals, TokenUsageSummary } from '../types';

export function summarizeTokenUsage(messages: readonly ChatMessage[]): TokenUsageSummary | null {
  const turnUsages = messages
    .filter((message): message is ChatMessage & { usage: NonNullable<ChatMessage['usage']> } => (
      message.role === 'assistant' && Boolean(message.usage)
    ))
    .map((message) => message.usage);

  if (turnUsages.length === 0) {
    return null;
  }

  const latestTurn = turnUsages[turnUsages.length - 1];
  const canEstimateSessionCost = turnUsages.every(
    (usage) => usage.costStatus === 'estimated' && typeof usage.estimatedCostUsd === 'number',
  );

  const session: SessionUsageTotals = {
    inputTokens: turnUsages.reduce((sum, usage) => sum + usage.inputTokens, 0),
    outputTokens: turnUsages.reduce((sum, usage) => sum + usage.outputTokens, 0),
    totalTokens: turnUsages.reduce((sum, usage) => sum + usage.totalTokens, 0),
    turnCount: turnUsages.length,
    ...(canEstimateSessionCost
      ? {
          estimatedCostUsd: roundUsd(turnUsages.reduce(
            (sum, usage) => sum + (usage.estimatedCostUsd ?? 0),
            0,
          )),
        }
      : {}),
    costStatus: canEstimateSessionCost ? 'estimated' : 'unavailable',
  };

  return {
    turn: latestTurn,
    session,
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
