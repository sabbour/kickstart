import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {SliderApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {
  Slider as FluentSlider,
  Label,
  Body1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type {SliderOnChangeData} from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
  },
});

export const Slider = createReactComponent(SliderApi, ({props}) => {
  const classes = useStyles();

  const onChange = (_ev: React.ChangeEvent<HTMLInputElement>, data: SliderOnChangeData) => {
    props.setValue(data.value);
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        {props.label && <Label weight="semibold">{props.label}</Label>}
        <Body1>{props.value}</Body1>
      </div>
      <FluentSlider
        min={props.min ?? 0}
        max={props.max}
        value={props.value ?? 0}
        onChange={onChange}
        aria-label={props.label || props.accessibility?.label || 'Slider'}
        aria-valuetext={`${props.value}`}
      />
    </div>
  );
});
