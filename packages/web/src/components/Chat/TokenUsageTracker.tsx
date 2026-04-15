import React from 'react';
import type { TokenUsageSummary } from '../../types';

interface TokenUsageTrackerProps {
  usage: TokenUsageSummary;
}

const integerFormatter = new Intl.NumberFormat('en-US');

export function TokenUsageTracker({ usage }: TokenUsageTrackerProps) {
  return (
    <div
      className="chat-usage-tracker"
      role="status"
      aria-live="polite"
      data-testid="chat-usage-tracker"
    >
      <span className="chat-usage-segment" aria-label={`This turn input tokens ${usage.turn.inputTokens}`}>
        ▲ {formatInteger(usage.turn.inputTokens)}
      </span>
      <span className="chat-usage-segment" aria-label={`This turn output tokens ${usage.turn.outputTokens}`}>
        ▼ {formatInteger(usage.turn.outputTokens)}
      </span>
      <span className="chat-usage-divider" aria-hidden="true">|</span>
      <span className="chat-usage-segment" aria-label={`Session token totals ${usage.session.inputTokens} input and ${usage.session.outputTokens} output`}>
        Σ {formatInteger(usage.session.inputTokens)} / {formatInteger(usage.session.outputTokens)}
      </span>
      <span className="chat-usage-divider" aria-hidden="true">|</span>
      <span className={`chat-usage-segment${usage.session.costStatus === 'estimated' ? '' : ' chat-usage-segment--muted'}`}>
        {formatCost(usage)}
      </span>
      <span className="chat-usage-divider" aria-hidden="true">|</span>
      <span className="chat-usage-segment chat-usage-model">{usage.turn.model}</span>
    </div>
  );
}

function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

function formatCost(usage: TokenUsageSummary): string {
  if (usage.session.costStatus !== 'estimated' || usage.session.estimatedCostUsd === undefined) {
    return 'Cost —';
  }

  const digits = usage.session.estimatedCostUsd < 0.01 ? 4 : 2;
  return `~${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(usage.session.estimatedCostUsd)}`;
}
