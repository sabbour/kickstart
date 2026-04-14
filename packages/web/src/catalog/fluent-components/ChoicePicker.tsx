import React, {useState, useEffect, useRef, useMemo} from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  DynamicStringSchema,
  DynamicStringListSchema,
  ActionSchema,
  CheckableSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  RadioGroup as FluentRadioGroup,
  Radio,
  Checkbox,
  ToggleButton,
  Input,
  Label,
  Button,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { ArrowRight16Regular } from '@fluentui/react-icons';
import { useMessageText } from '../../contexts/MessageTextContext';

type _Option = any;

/** Delay in ms before the Continue button appears so the user sees options first. */
const CONTINUE_BUTTON_DELAY_MS = 1500;

// Extend the vendor ChoicePickerApi with an optional action that fires on selection change
const FlexibleChoicePickerApi = {
  name: 'ChoicePicker' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    label: DynamicStringSchema.optional(),
    variant: z.enum(['multipleSelection', 'mutuallyExclusive']).default('mutuallyExclusive').optional(),
    options: z.array(z.object({
      label: DynamicStringSchema,
      value: z.string(),
    })),
    value: DynamicStringListSchema,
    displayStyle: z.enum(['checkbox', 'chips']).default('checkbox').optional(),
    filterable: z.boolean().default(false).optional(),
    action: ActionSchema.optional(),
    checks: CheckableSchema.shape.checks,
  }),
};

/**
 * Returns the best-guess option index by checking whether the surrounding
 * assistant message text mentions any of the option labels. Falls back to 0
 * (first option) if no match is found.
 */
export function getBestGuessIndex(
  options: Array<{ label: unknown; value: string }>,
  messageText: string,
): number {
  if (options.length === 0) return -1;
  if (!messageText) return 0;

  const lower = messageText.toLowerCase();
  for (let i = 0; i < options.length; i++) {
    const label = String(options[i].label).toLowerCase();
    if (label && lower.includes(label)) return i;
  }
  return 0;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  chipContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  continueWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
    opacity: 0,
    transform: 'translateY(4px)',
    transitionProperty: 'opacity, transform',
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase,
  },
  continueVisible: {
    opacity: 1,
    transform: 'translateY(0)',
  },
  continueHint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

export const ChoicePicker = createReactComponent(FlexibleChoicePickerApi, ({props}) => {
  const [filter, setFilter] = useState('');
  const [showContinue, setShowContinue] = useState(false);
  const hasFiredContinueRef = useRef(false);
  const classes = useStyles();
  const messageText = useMessageText();

  const values = Array.isArray(props.value) ? props.value : [];
  const variant = props.variant ?? 'mutuallyExclusive';
  const isMutuallyExclusive = variant === 'mutuallyExclusive';
  const hasAction = typeof props.action === 'function';

  const fireAction = () => {
    if (typeof props.action === 'function') {
      (props.action as () => void)();
    }
  };

  const onToggle = (val: string) => {
    if (isMutuallyExclusive) {
      props.setValue([val]);
    } else {
      const newValues = values.includes(val)
        ? values.filter((v: string) => v !== val)
        : [...values, val];
      props.setValue(newValues);
    }
    fireAction();
  };

  const onRadioChange = (_e: unknown, data: { value: string }) => {
    props.setValue([data.value]);
    fireAction();
  };

  const options = (props.options || []).filter(
    (opt: _Option) =>
      !props.filterable ||
      filter === '' ||
      String(opt.label).toLowerCase().includes(filter.toLowerCase())
  );

  // Reveal the Continue button after a brief delay — only for mutually-exclusive pickers with an action
  useEffect(() => {
    if (!hasAction || !isMutuallyExclusive || options.length === 0) return;
    const timer = setTimeout(() => setShowContinue(true), CONTINUE_BUTTON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasAction, isMutuallyExclusive, options.length]);

  const bestGuessIdx = useMemo(
    () => getBestGuessIndex(options, messageText),
    [options, messageText],
  );

  const bestGuessLabel = bestGuessIdx >= 0 ? String(options[bestGuessIdx]?.label ?? '') : '';

  const handleContinue = () => {
    if (hasFiredContinueRef.current || bestGuessIdx < 0) return;
    hasFiredContinueRef.current = true;
    const chosen = options[bestGuessIdx];
    props.setValue([chosen.value]);
    fireAction();
  };

  return (
    <div className={classes.root}>
      {props.label && <Label weight="semibold">{props.label}</Label>}
      {props.filterable && (
        <Input
          placeholder="Filter options..."
          aria-label="Filter options"
          value={filter}
          onChange={(_e, data) => setFilter(data.value)}
        />
      )}

      {props.displayStyle === 'chips' ? (
        <div className={classes.chipContainer}>
          {options.map((opt: _Option, i: number) => {
            const isSelected = values.includes(opt.value);
            return (
              <ToggleButton
                key={i}
                checked={isSelected}
                onClick={() => onToggle(opt.value)}
                shape="circular"
                size="small"
              >
                {opt.label}
              </ToggleButton>
            );
          })}
        </div>
      ) : isMutuallyExclusive ? (
        <FluentRadioGroup
          value={values[0] || ''}
          onChange={onRadioChange}
        >
          {options.map((opt: _Option, i: number) => (
            <Radio key={i} value={opt.value} label={opt.label} />
          ))}
        </FluentRadioGroup>
      ) : (
        <div className={classes.listContainer}>
          {options.map((opt: _Option, i: number) => (
            <Checkbox
              key={i}
              checked={values.includes(opt.value)}
              label={opt.label}
              onChange={() => onToggle(opt.value)}
            />
          ))}
        </div>
      )}

      {/* Continue button — auto-selects best-guess option and fires the action */}
      {hasAction && isMutuallyExclusive && options.length > 0 && (
        <div
          className={mergeClasses(classes.continueWrapper, showContinue && classes.continueVisible)}
          aria-hidden={!showContinue}
        >
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowRight16Regular />}
            iconPosition="after"
            onClick={handleContinue}
            disabled={!showContinue}
            aria-label={`Continue with ${bestGuessLabel}`}
          >
            Continue{bestGuessLabel ? ` with ${bestGuessLabel}` : ''}
          </Button>
          <span className={classes.continueHint}>best guess</span>
        </div>
      )}
    </div>
  );
});
