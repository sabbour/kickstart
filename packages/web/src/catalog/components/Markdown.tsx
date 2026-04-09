import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { makeStyles, tokens, Link } from '@fluentui/react-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/vs.css';

// Register highlight.js languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('markdown', markdown);

const MarkdownApi = {
  name: 'Markdown',
  schema: z.object({
    content: DynamicStringSchema,
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
  },
  h1: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase600,
    marginTop: tokens.spacingVerticalXXL,
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
  },
  h2: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase500,
    marginTop: tokens.spacingVerticalXL,
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
  },
  h3: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase400,
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
  h4: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
  h5: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
  h6: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase200,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
  p: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    marginTop: '0',
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
  },
  a: {
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  ul: {
    marginTop: '0',
    marginBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalXL,
  },
  ol: {
    marginTop: '0',
    marginBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalXL,
  },
  li: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXXS}`,
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorNeutralForeground1,
  },
  pre: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: 'auto',
    marginTop: '0',
    marginBottom: tokens.spacingVerticalM,
  },
  blockquote: {
    borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
    paddingLeft: tokens.spacingHorizontalM,
    marginLeft: '0',
    marginRight: '0',
    marginTop: '0',
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground2,
    fontStyle: 'italic',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    marginTop: '0',
    marginBottom: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeBase300,
  },
  th: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.colorNeutralStroke1,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    textAlign: 'left',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  td: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.colorNeutralStroke1,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    color: tokens.colorNeutralForeground1,
  },
  hr: {
    borderWidth: '0',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalL,
  },
});

export const Markdown = createReactComponent(MarkdownApi, ({ props }) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className={classes.h1} {...props} />,
          h2: ({ node, ...props }) => <h2 className={classes.h2} {...props} />,
          h3: ({ node, ...props }) => <h3 className={classes.h3} {...props} />,
          h4: ({ node, ...props }) => <h4 className={classes.h4} {...props} />,
          h5: ({ node, ...props }) => <h5 className={classes.h5} {...props} />,
          h6: ({ node, ...props }) => <h6 className={classes.h6} {...props} />,
          p: ({ node, ...props }) => <p className={classes.p} {...props} />,
          a: ({ node, ...props }) => <Link className={classes.a} {...props} />,
          ul: ({ node, ...props }) => <ul className={classes.ul} {...props} />,
          ol: ({ node, ...props }) => <ol className={classes.ol} {...props} />,
          li: ({ node, ...props }) => <li className={classes.li} {...props} />,
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            if (!inline && language) {
              try {
                const result = hljs.highlight(String(children).replace(/\n$/, ''), {
                  language,
                });
                return (
                  <pre className={classes.pre}>
                    <code dangerouslySetInnerHTML={{ __html: result.value }} />
                  </pre>
                );
              } catch (error) {
                return (
                  <pre className={classes.pre}>
                    <code {...props}>{children}</code>
                  </pre>
                );
              }
            } else if (!inline) {
              try {
                const result = hljs.highlightAuto(String(children).replace(/\n$/, ''));
                return (
                  <pre className={classes.pre}>
                    <code dangerouslySetInnerHTML={{ __html: result.value }} />
                  </pre>
                );
              } catch (error) {
                return (
                  <pre className={classes.pre}>
                    <code {...props}>{children}</code>
                  </pre>
                );
              }
            }
            return <code className={classes.code} {...props}>{children}</code>;
          },
          blockquote: ({ node, ...props }) => (
            <blockquote className={classes.blockquote} {...props} />
          ),
          table: ({ node, ...props }) => <table className={classes.table} {...props} />,
          th: ({ node, ...props }) => <th className={classes.th} {...props} />,
          td: ({ node, ...props }) => <td className={classes.td} {...props} />,
          hr: ({ node, ...props }) => <hr className={classes.hr} {...props} />,
        }}
      >
        {props.content || ''}
      </ReactMarkdown>
    </div>
  );
});
