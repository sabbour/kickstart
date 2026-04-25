import { describe, it, expect } from 'vitest';
import { TrackPickerSchema } from '../../schemas/rich-component-schemas.js';

describe('TrackPickerSchema', () => {
  it('should validate a valid TrackPicker with all icons', () => {
    const valid = {
      id: 'picker-1',
      component: 'TrackPicker',
      title: 'Select a deployment track',
      tracks: [
        {
          id: 'static_site',
          label: 'Static Website',
          description: 'Pure HTML/CSS/JS',
          icon: 'Globe'
        },
        {
          id: 'containerized',
          label: 'Containerized App',
          description: 'Docker-based deployment',
          icon: 'DockerContainer'
        }
      ]
    };
    
    const result = TrackPickerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate TrackPicker with null icons (null = no icon, field is required by OpenAI strict mode)', () => {
    const valid = {
      id: 'picker-2',
      component: 'TrackPicker',
      title: 'Track selection',
      tracks: [
        {
          id: 'track-a',
          label: 'Track A',
          description: 'Description A',
          icon: null
        },
        {
          id: 'track-b',
          label: 'Track B',
          description: 'Description B',
          icon: 'SomeIcon'
        }
      ]
    };
    
    const result = TrackPickerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should REJECT tracks with icon field omitted entirely (field is required per OpenAI strict-mode conformance)', () => {
    const invalid = {
      id: 'picker-3',
      component: 'TrackPicker',
      title: 'Missing icon field',
      tracks: [
        {
          id: 'track-x',
          label: 'Track X',
          description: 'Icon field not present at all'
          // icon omitted — invalid: LLM must always include the field (null to omit visually)
        }
      ]
    };
    
    const result = TrackPickerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require at least one track', () => {
    const invalid = {
      id: 'picker-4',
      component: 'TrackPicker',
      title: 'No tracks',
      tracks: []
    };
    
    const result = TrackPickerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should enforce strict mode (no extra fields)', () => {
    const invalid = {
      id: 'picker-5',
      component: 'TrackPicker',
      title: 'Title',
      tracks: [
        {
          id: 'track-1',
          label: 'Label',
          description: 'Desc',
          icon: 'Icon',
          extra_field: 'should fail'
        }
      ]
    };
    
    const result = TrackPickerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
