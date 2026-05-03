import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Badge,
  Button,
  Card,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Schema  (Recipe R9 — Review pack composition)
// ---------------------------------------------------------------------------

const ReviewFileSchema = z.object({
  name: DynamicStringSchema,
  provenance: z.enum(['new', 'modified', 'existing']).optional(),
  description: DynamicStringSchema.optional(),
}).strict();

const DeliveryOptionSchema = z.object({
  label: DynamicStringSchema,
  channel: z.enum(['pr', 'slack', 'zip', 'link', 'terminal']).optional(),
}).strict();

const ReviewPackApi = {
  name: 'ReviewPack',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      files: z.array(ReviewFileSchema),
      deliveryOptions: z.array(DeliveryOptionSchema).optional(),
      children: z.array(z.string()).optional(),
    })
    .strict(),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PROVENANCE_ICON: Record<string, string> = {
  new: '✨',
  modified: '⚙',
  existing: '',
};

const useStyles = makeStyles({
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  contentsCard: {
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  deliveryCard: {
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  title: {
    color: tokens.colorNeutralForeground2,
    display: 'block',
    marginBottom: tokens.spacingVerticalS,
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  deliveryRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  childrenArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReviewPack = createReactComponent(ReviewPackApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const files = props.files ?? [];
  const deliveryOptions = props.deliveryOptions ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  return (
    <div className={classes.wrapper} data-testid="a2ui-ReviewPack">
      <Card className={classes.contentsCard}>
        {props.title && (
          <Body1Strong className={classes.title}>{props.title}</Body1Strong>
        )}
        <div className={classes.fileList}>
          {files.map((file, idx) => (
            <div key={idx} className={classes.fileRow}>
              {file.provenance && PROVENANCE_ICON[file.provenance] && (
                <span>{PROVENANCE_ICON[file.provenance]}</span>
              )}
              <Body1Strong>{file.name}</Body1Strong>
              {file.description && (
                <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
                  — {file.description}
                </Body1>
              )}
            </div>
          ))}
        </div>
      </Card>
      {deliveryOptions.length > 0 && (
        <Card className={classes.deliveryCard}>
          <div className={classes.deliveryRow}>
            {deliveryOptions.map((opt, idx) => (
              <Button key={idx} appearance={idx === 0 ? 'primary' : 'secondary'} size="small">
                {opt.label}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {childIds.length > 0 && (
        <div className={classes.childrenArea}>
          {childIds.map((id) => (
            <React.Fragment key={id}>{buildChild(id)}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
});
