import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Badge, Text, tokens, makeStyles } from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const BicepEditorSchema = z.object({
  content: z.string().describe('Bicep template source code'),
  templateName: z.string().optional().describe('Display name for the template'),
  isValid: z.boolean().optional().describe('Whether the template has passed validation'),
  errorCount: z.number().optional(),
  warningCount: z.number().optional(),
  readOnly: z.boolean().default(true).describe('Whether the editor is read-only'),
});

type BicepEditorProps = z.infer<typeof BicepEditorSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  codeBlock: {
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    overflowX: 'auto',
    whiteSpace: 'pre',
    maxHeight: '400px',
    overflowY: 'auto',
  },
});

export const BicepEditorRenderer: React.FC<{ props: BicepEditorProps }> = ({ props }) => {
  const classes = useStyles();
  const name = props.templateName ?? 'template.bicep';

  let validationBadge: React.ReactNode = null;
  if (props.isValid === true) {
    validationBadge = <Badge appearance="tint" color="success" size="small">Valid</Badge>;
  } else if (props.isValid === false) {
    validationBadge = (
      <Badge appearance="tint" color="danger" size="small">
        {props.errorCount ?? 0} error{(props.errorCount ?? 0) !== 1 ? 's' : ''}
      </Badge>
    );
  }

  return (
    <Card className={classes.card}>
      <CardHeader
        header={
          <div className={classes.header}>
            <Text weight="semibold">{String(name)}</Text>
            {validationBadge}
            {props.warningCount != null && props.warningCount > 0 && (
              <Badge appearance="tint" color="warning" size="small">
                {props.warningCount} warning{props.warningCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        }
      />
      <div className={classes.codeBlock}>
        {String(props.content)}
      </div>
    </Card>
  );
};

export const bicepEditorContribution: ComponentContribution = {
  name: 'azure/BicepEditor',
  propertySchema: BicepEditorSchema,
  renderer: BicepEditorRenderer,
};
