import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';

const ProgressStepsApi = {
  name: 'ProgressSteps',
  schema: z.object({
    steps: z.array(z.object({
      id: z.string(),
      label: DynamicStringSchema,
      status: z.enum(['pending', 'active', 'complete', 'error']),
    })),
  }).strict(),
};

export const ProgressSteps = createReactComponent(ProgressStepsApi, ({ props }) => {
  const steps = props.steps || [];

  return (
    <div className="kickstart-progress-steps" style={{ margin: '8px' }}>
      {steps.map((step, i) => (
        <div key={step.id} className={`kickstart-step ${step.status}`}>
          <div className="kickstart-step-indicator">
            {i < steps.length - 1 && <div className="kickstart-step-connector" />}
            <div className="kickstart-step-dot">
              {step.status === 'complete' && '✓'}
              {step.status === 'error' && '✕'}
              {step.status === 'active' && '●'}
              {step.status === 'pending' && (i + 1)}
            </div>
          </div>
          <span className="kickstart-step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
});
