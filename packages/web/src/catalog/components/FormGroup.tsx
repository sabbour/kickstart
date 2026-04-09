import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import {
  DynamicStringSchema,
  ComponentIdSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';

const FormGroupApi = {
  name: 'FormGroup',
  schema: z.object({
    title: DynamicStringSchema,
    step: z.number().optional(),
    child: ComponentIdSchema,
  }).strict(),
};

export const FormGroup = createReactComponent(FormGroupApi, ({ props, buildChild }) => {
  return (
    <div className="kickstart-form-group" style={{ margin: '8px', width: '100%', boxSizing: 'border-box' }}>
      <div className="kickstart-form-group-header">
        {props.step != null && (
          <span className="kickstart-step-badge">Step {props.step}</span>
        )}
        <span className="kickstart-form-group-title">{props.title}</span>
      </div>
      <div>
        {props.child ? buildChild(props.child) : null}
      </div>
    </div>
  );
});
