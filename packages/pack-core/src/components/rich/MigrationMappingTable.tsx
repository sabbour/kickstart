import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Caption1,
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
// Schema  (Recipe R3 — Migration mapping table)
// ---------------------------------------------------------------------------

const MappingRowSchema = z.object({
  from_source: DynamicStringSchema,
  to_azure: DynamicStringSchema,
  why: DynamicStringSchema,
}).strict();

const MigrationMappingTableApi = {
  name: 'MigrationMappingTable',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      rows: z.array(MappingRowSchema),
      citation: DynamicStringSchema.optional(),
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
  citation: {
    color: tokens.colorNeutralForeground3,
    display: 'block',
    marginTop: tokens.spacingVerticalXS,
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

export const MigrationMappingTable = createReactComponent(MigrationMappingTableApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const rows = props.rows ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  return (
    <Card className={classes.card} data-testid="a2ui-MigrationMappingTable">
      {props.title && (
        <Body1Strong className={classes.title}>{props.title}</Body1Strong>
      )}
      <Table aria-label="Migration mapping">
        <TableHeader>
          <TableRow>
            <TableHeaderCell><Body1Strong>Source</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>Azure equivalent</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>Why</Body1Strong></TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell><Body1>{row.from_source}</Body1></TableCell>
              <TableCell><Body1>{row.to_azure}</Body1></TableCell>
              <TableCell><Body1>{row.why}</Body1></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {props.citation && (
        <Caption1 className={classes.citation}>{props.citation}</Caption1>
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
