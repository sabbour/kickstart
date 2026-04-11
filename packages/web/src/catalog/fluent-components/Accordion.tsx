import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {DynamicStringSchema} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Accordion as FluentAccordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {ChildList} from './ChildList';

const FlexibleAccordionApi = {
  name: 'Accordion' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    items: z.array(z.object({
      title: DynamicStringSchema,
      children: z.array(z.string()),
    })),
    collapsible: z.boolean().optional(),
    multiple: z.boolean().optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
});

export const Accordion = createReactComponent(FlexibleAccordionApi, ({props, buildChild, context}) => {
  const classes = useStyles();
  const items = props.items ?? [];

  return (
    <FluentAccordion
      className={classes.root}
      collapsible={props.collapsible !== false}
      multiple={props.multiple === true}
    >
      {items.map((item: any, i: number) => (
        <AccordionItem key={i} value={String(i)}>
          <AccordionHeader>{item.title ?? ''}</AccordionHeader>
          <AccordionPanel>
            <ChildList childList={item.children} buildChild={buildChild} context={context} />
          </AccordionPanel>
        </AccordionItem>
      ))}
    </FluentAccordion>
  );
});
