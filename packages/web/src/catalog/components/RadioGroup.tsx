import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import {
  DynamicStringSchema,
  ActionSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';

const RadioGroupApi = {
  name: 'RadioGroup',
  schema: z.object({
    options: z.array(z.object({
      id: z.string(),
      label: DynamicStringSchema,
      description: DynamicStringSchema.optional(),
      recommended: z.boolean().optional(),
    })),
    value: DynamicStringSchema.optional(),
    action: ActionSchema,
  }).strict(),
};

export const RadioGroup = createReactComponent(RadioGroupApi, ({ props }) => {
  const [selected, setSelected] = useState(props.value || '');

  const handleSelect = (id: string) => {
    setSelected(id);
    if (props.action) {
      (props.action as () => void)();
    }
  };

  return (
    <div className="kickstart-radio-group" style={{ margin: '8px' }}>
      {(props.options || []).map((opt) => (
        <div
          key={opt.id}
          className={`kickstart-radio-card ${selected === opt.id ? 'selected' : ''}`}
          onClick={() => handleSelect(opt.id)}
          role="radio"
          aria-checked={selected === opt.id}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(opt.id); }}
        >
          {opt.recommended && (
            <span className="kickstart-recommended-badge">Recommended</span>
          )}
          <div className="kickstart-radio-card-title">{opt.label}</div>
          {opt.description && (
            <div className="kickstart-radio-card-desc">{opt.description}</div>
          )}
        </div>
      ))}
    </div>
  );
});
