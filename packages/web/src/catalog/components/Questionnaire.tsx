import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Button,
  Checkbox,
  Input,
  Label,
  RadioGroup as FluentRadioGroup,
  Radio,
  Card,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const QuestionnaireApi = {
  name: 'Questionnaire',
  schema: z.object({
    questions: z.array(z.object({
      id: DynamicStringSchema,
      label: DynamicStringSchema,
      type: z.enum(['text', 'choice', 'multiChoice']).optional(),
      choices: z.array(z.object({ id: DynamicStringSchema, label: DynamicStringSchema })).optional(),
      required: z.boolean().optional(),
    })),
    submitLabel: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: tokens.spacingHorizontalL,
  },
  question: {
    marginBottom: tokens.spacingVerticalL,
  },
  label: {
    display: 'block',
    marginBottom: tokens.spacingVerticalXS,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  required: {
    color: tokens.colorPaletteRedForeground1,
    marginLeft: tokens.spacingHorizontalXXS,
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: tokens.spacingVerticalM,
  },
});

export const Questionnaire = createReactComponent(QuestionnaireApi, ({ props }) => {
  const classes = useStyles();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const updateAnswer = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const toggleMultiChoice = (questionId: string, choiceId: string) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || [];
      const next = current.includes(choiceId)
        ? current.filter(c => c !== choiceId)
        : [...current, choiceId];
      return { ...prev, [questionId]: next };
    });
  };

  return (
    <Card className={classes.root}>
      <Subtitle2 style={{ marginBottom: tokens.spacingVerticalM }}>
        {props.submitLabel || 'Questionnaire'}
      </Subtitle2>

      {(props.questions || []).map((q) => {
        const qType = q.type || 'text';
        const qId = q.id as string;
        const qLabel = q.label as string;

        return (
          <div key={qId} className={classes.question}>
            <Label className={classes.label}>
              {qLabel}
              {q.required && <span className={classes.required}>*</span>}
            </Label>

            {qType === 'text' && (
              <Input
                style={{ width: '100%' }}
                value={(answers[qId] as string) || ''}
                onChange={(_e, data) => updateAnswer(qId, data.value)}
              />
            )}

            {qType === 'choice' && q.choices && (
              <FluentRadioGroup
                value={(answers[qId] as string) || ''}
                onChange={(_e, data) => updateAnswer(qId, data.value)}
              >
                {q.choices.map((c) => (
                  <Radio
                    key={c.id as string}
                    value={c.id as string}
                    label={c.label as string}
                  />
                ))}
              </FluentRadioGroup>
            )}

            {qType === 'multiChoice' && q.choices && (
              <div className={classes.checkboxGroup}>
                {q.choices.map((c) => {
                  const selected = ((answers[qId] as string[]) || []).includes(c.id as string);
                  return (
                    <Checkbox
                      key={c.id as string}
                      checked={selected}
                      onChange={() => toggleMultiChoice(qId, c.id as string)}
                      label={c.label as string}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className={classes.footer}>
        <Button appearance="primary">
          {(props.submitLabel as string) || 'Submit'}
        </Button>
      </div>
    </Card>
  );
});
