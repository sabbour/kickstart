import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  DynamicStringSchema,
  ActionSchema,
  AccessibilityAttributesSchema,
} from '../../vendor/a2ui/schema/common-types';
import {
  Table as FluentTable,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const FlexibleTableApi = {
  name: 'Table' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    columns: z.array(DynamicStringSchema),
    rows: z.array(z.array(DynamicStringSchema)).optional(),
    caption: DynamicStringSchema.optional(),
  }),
};

const useStyles = makeStyles({
  wrapper: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    overflowX: 'auto',
  },
  caption: {
    marginBottom: tokens.spacingVerticalXS,
    display: 'block',
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
  },
  stripedRow: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
});

export const Table = createReactComponent(FlexibleTableApi, ({props}) => {
  const classes = useStyles();
  const columns = props.columns ?? [];
  const rows = props.rows ?? [];

  return (
    <div className={classes.wrapper}>
      {props.caption && (
        <Caption1 className={classes.caption}>{props.caption}</Caption1>
      )}
      <FluentTable aria-label={props.caption ?? 'Data table'}>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHeaderCell key={i} className={classes.headerCell}>
                {col}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIdx) => (
            <TableRow key={rowIdx} className={rowIdx % 2 === 1 ? classes.stripedRow : undefined}>
              {columns.map((_col, colIdx) => (
                <TableCell key={colIdx}>
                  {row[colIdx] ?? ''}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </FluentTable>
    </div>
  );
});
