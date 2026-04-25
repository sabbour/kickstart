import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Card,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { sanitizeActionContext } from '../../vendor/sanitize-action-context';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const TrackPickerApi = {
  name: 'TrackPicker',
  schema: z
    .object({
      title: DynamicStringSchema,
      tracks: z
        .array(
          z.object({
            id: z.string(),
            label: DynamicStringSchema,
            description: DynamicStringSchema,
            icon: z.string().nullable().optional(),
          }),
        )
        .min(1),
    })
    .strict(),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  title: {
    color: tokens.colorNeutralForeground1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  tile: {
    cursor: 'pointer',
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  tileLabel: {
    marginBottom: tokens.spacingVerticalXXS,
  },
  tileDescription: {
    color: tokens.colorNeutralForeground2,
  },
});

// Safe track-ID pattern — schema validates upstream; reject malformed IDs as
// a defence-in-depth measure before dispatching the action.
const SAFE_TRACK_ID = /^[a-zA-Z0-9_-]{1,64}$/;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TrackPicker = createReactComponent(TrackPickerApi, ({ props, context }) => {
  const classes = useStyles();
  const tracks = props.tracks ?? [];

  const handleSelect = (trackId: string, trackLabel: string) => {
    if (!SAFE_TRACK_ID.test(trackId)) return;

    context.dispatchAction({
      event: {
        name: 'pick_track',
        context: sanitizeActionContext({
          value: trackId,
          selectedLabel: String(trackLabel).slice(0, 200),
        }),
      },
    });
  };

  if (tracks.length === 0) return null;

  return (
    <div data-testid="a2ui-TrackPicker" className={classes.root}>
      <Subtitle2 className={classes.title}>{props.title}</Subtitle2>
      <div className={classes.grid}>
        {tracks.map((track) => (
          <Card
            key={track.id}
            tabIndex={0}
            role="button"
            className={classes.tile}
            onClick={() => handleSelect(track.id, String(track.label))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSelect(track.id, String(track.label));
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ') {
                e.preventDefault();
                handleSelect(track.id, String(track.label));
              }
            }}
            aria-label={String(track.label)}
          >
            <Body1Strong className={classes.tileLabel}>{track.label}</Body1Strong>
            <Body1 className={classes.tileDescription}>{track.description}</Body1>
          </Card>
        ))}
      </div>
    </div>
  );
});
