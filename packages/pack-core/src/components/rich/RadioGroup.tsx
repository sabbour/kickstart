import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import {
  DynamicStringSchema,
  ActionSchema,
} from '../../vendor/a2ui/schema/common-types';
import {
  Card,
  CardHeader,
  Badge,
  Body1Strong,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { sanitizeActionContext } from '../../vendor/sanitize-action-context';

const RadioGroupApi = {
  name: 'RadioGroup',
  schema: z.object({
    options: z.array(z.object({
      id: z.string(),
      label: DynamicStringSchema,
      description: DynamicStringSchema.optional(),
      recommended: z.boolean().optional(),
    })),
    value: DynamicStringSchema.optional(),
    action: ActionSchema,
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
    width: '100%',
  },
  card: {
    marginBottom: tokens.spacingVerticalXS,
    cursor: 'pointer',
    width: '100%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  selectedCard: {
    marginBottom: tokens.spacingVerticalXS,
    cursor: 'pointer',
    width: '100%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    borderTopWidth: tokens.strokeWidthThick,
    borderRightWidth: tokens.strokeWidthThick,
    borderBottomWidth: tokens.strokeWidthThick,
    borderLeftWidth: tokens.strokeWidthThick,
  },
});

export const RadioGroup = createReactComponent(RadioGroupApi, ({ props, context }) => {
  const [selected, setSelected] = useState(props.value || '');
  const classes = useStyles();
  const options = props.options || [];

  const handleSelect = (id: string) => {
    setSelected(id);

    // Dispatch enriched action with selected value and label in context
    const rawAction = context.componentModel.properties.action;
    if (rawAction && typeof rawAction === 'object' && 'event' in rawAction && rawAction.event) {
      const selectedOpt = options.find(opt => opt.id === id);
      const resolved = context.dataContext.resolveAction(rawAction);
      const safeContext = sanitizeActionContext(resolved.event.context);
      context.dispatchAction({
        event: {
          ...resolved.event,
          context: {
            ...safeContext,
            value: id,
            selectedLabel: selectedOpt ? String(selectedOpt.label).slice(0, 200) : undefined,
          },
        },
      });
    } else if (props.action) {
      (props.action as () => void)();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIdx = (idx + 1) % options.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIdx = (idx - 1 + options.length) % options.length;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleSelect(options[idx].id);
      return;
    } else {
      return;
    }
    handleSelect(options[nextIdx].id);
    const container = (e.currentTarget as HTMLElement).parentElement;
    const cards = container?.querySelectorAll('[role="radio"]');
    (cards?.[nextIdx] as HTMLElement)?.focus();
  };

  return (
    <div className={classes.root} role="radiogroup" aria-label="Options">
      {options.map((opt, idx) => (
        <Card
          key={opt.id}
          className={selected === opt.id ? classes.selectedCard : classes.card}
          onClick={() => handleSelect(opt.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          role="radio"
          aria-checked={selected === opt.id}
          aria-label={String(opt.label)}
          tabIndex={selected === opt.id || (!selected && idx === 0) ? 0 : -1}
        >
          <CardHeader
            header={<Body1Strong>{String(opt.label)}</Body1Strong>}
            description={opt.description ? <Caption1>{opt.description}</Caption1> : undefined}
            action={
              opt.recommended ? (
                <Badge appearance="filled" color="brand">Recommended</Badge>
              ) : undefined
            }
          />
        </Card>
      ))}
    </div>
  );
});
