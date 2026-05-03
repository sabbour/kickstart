import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Schema  (Recipe R8 — Job-to-be-done table)
// ---------------------------------------------------------------------------

const JtbdRowSchema = z.object({
  you_want: DynamicStringSchema,
  how_aks: DynamicStringSchema,
}).strict();

const JobToBeDoneTableApi = {
  name: 'JobToBeDoneTable',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      rows: z.array(JtbdRowSchema),
      reshapeLabel: DynamicStringSchema.optional(),
      stayLabel: DynamicStringSchema.optional(),
      exitLabel: DynamicStringSchema.optional(),
      children: z.array(z.string()).optional(),
    })
    .strict(),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  title: {
    color: tokens.colorNeutralForeground2,
    display: 'block',
    marginBottom: tokens.spacingVerticalXS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
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

export const JobToBeDoneTable = createReactComponent(JobToBeDoneTableApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const rows = props.rows ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  return (
    <Card className={classes.card} data-testid="a2ui-JobToBeDoneTable">
      {props.title && (
        <Body1Strong className={classes.title}>{String(props.title)}</Body1Strong>
      )}
      <Table aria-label="Job to be done">
        <TableHeader>
          <TableRow>
            <TableHeaderCell><Body1Strong>You want</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>How AKS Automatic does it</Body1Strong></TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell><Body1>{String(row.you_want)}</Body1></TableCell>
              <TableCell><Body1>{String(row.how_aks)}</Body1></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(props.reshapeLabel || props.stayLabel || props.exitLabel) && (
        <div className={classes.actions}>
          {props.reshapeLabel && (
            <Button appearance="primary" size="small">{String(props.reshapeLabel)}</Button>
          )}
          {props.stayLabel && (
            <Button appearance="secondary" size="small">{String(props.stayLabel)}</Button>
          )}
          {props.exitLabel && (
            <Button appearance="subtle" size="small">{String(props.exitLabel)}</Button>
          )}
        </div>
      )}
      {childIds.length > 0 && (
        <div className={classes.childrenArea}>
          {childIds.map((id) => (
            <React.Fragment key={id}>{buildChild(id)}</React.Fragment>
          ))}
        </div>
      )}
    </Card>
  );
});
