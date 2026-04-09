import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Card,
  Button,
  Body1,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { CopyRegular, CheckmarkRegular } from '@fluentui/react-icons';

const CodeBlockApi = {
  name: 'CodeBlock',
  schema: z.object({
    code: DynamicStringSchema,
    language: DynamicStringSchema.optional(),
    filename: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: '0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  codeContent: {
    padding: tokens.spacingHorizontalM,
    margin: '0',
    overflowX: 'auto',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

export const CodeBlock = createReactComponent(CodeBlockApi, ({ props }) => {
  const [copied, setCopied] = useState(false);
  const classes = useStyles();

  const handleCopy = () => {
    navigator.clipboard.writeText(props.code || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className={classes.root}>
      {(props.filename || props.language) && (
        <div className={classes.header}>
          <div className={classes.fileInfo}>
            {props.filename && <Body1 weight="semibold">{props.filename}</Body1>}
            {props.language && (
              <Caption1>{props.language}</Caption1>
            )}
          </div>
          <Button
            appearance="subtle"
            icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
            onClick={handleCopy}
            size="small"
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
      <pre className={classes.codeContent}>
        <code>{props.code}</code>
      </pre>
    </Card>
  );
});
