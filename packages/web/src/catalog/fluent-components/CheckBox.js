import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { CheckBoxApi } from '../../vendor/a2ui/web_core/basic_catalog/index';
import { Checkbox, Field, makeStyles, tokens } from '@fluentui/react-components';
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
    },
});
export const CheckBox = createReactComponent(CheckBoxApi, ({ props }) => {
    const classes = useStyles();
    const onChange = (_ev, data) => {
        props.setValue(!!data.checked);
    };
    const hasError = props.validationErrors && props.validationErrors.length > 0;
    return (<div className={classes.root}>
      <Field validationMessage={hasError ? props.validationErrors?.[0] : undefined} validationState={hasError ? 'error' : 'none'}>
        <Checkbox checked={!!props.value} onChange={onChange} label={props.label || undefined}/>
      </Field>
    </div>);
});
//# sourceMappingURL=CheckBox.js.map