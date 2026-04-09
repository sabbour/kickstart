import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import {
  DynamicStringSchema,
  ActionSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Card,
  CardHeader,
  Badge,
  Body1,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

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

export const RadioGroup = createReactComponent(RadioGroupApi, ({ props }) => {
  const [selected, setSelected] = useState(props.value || '');
  const classes = useStyles();

  const handleSelect = (id: string) => {
    setSelected(id);
    if (props.action) {
      (props.action as () => void)();
    }
  };

  return (
    <div className={classes.root}>
      {(props.options || []).map((opt) => (
        <Card
          key={opt.id}
          className={selected === opt.id ? classes.selectedCard : classes.card}
          onClick={() => handleSelect(opt.id)}
          role="radio"
          aria-checked={selected === opt.id}
        >
          <CardHeader
            header={<Body1 weight="semibold">{opt.label}</Body1>}
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
