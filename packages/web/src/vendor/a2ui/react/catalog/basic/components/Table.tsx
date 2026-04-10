/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import {createReactComponent} from '../../../adapter';
import {TableApi} from '../../../../web_core/basic_catalog/index';
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

export const Table = createReactComponent(TableApi, ({props}) => {
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
