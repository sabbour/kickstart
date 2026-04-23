/**
 * A2UIEnvelopePreview — renders a static set of A2UI component descriptors.
 *
 * This is the canonical "here are some descriptors, render them" component.
 * It encapsulates the createSurface → updateComponents → A2UISurfaceWrapper
 * lifecycle so every call site uses the same A2UI pipeline as the Chat renderer.
 *
 * Usage:
 *   <A2UIEnvelopePreview
 *     surfaceId="component-preview-core/Button"
 *     components={[{ id: 'root', component: 'Button', text: 'Click me' }]}
 *   />
 */

import React, { useEffect, useCallback, memo } from 'react';
import { useA2UI } from '../../hooks/useA2UI';
import { A2UISurfaceWrapper } from './A2UISurfaceWrapper';

export interface A2UIEnvelopePreviewProps {
  /** Unique ID for the surface created internally. */
  surfaceId: string;
  /** Flat A2UI component descriptor array. First element MUST have id="root". */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Array<Record<string, any>>;
  /** When false the surface is visually dimmed. Defaults to true. */
  isActive?: boolean;
  /** Slot rendered while the surface is being processed (defaults to nothing). */
  loading?: React.ReactNode;
}

export const A2UIEnvelopePreview = memo(function A2UIEnvelopePreview({
  surfaceId,
  components,
  isActive = true,
  loading = null,
}: A2UIEnvelopePreviewProps) {
  // Stable no-op handler — previews are read-only, no actions wired.
  const actionHandler = useCallback(() => {}, []);
  const { surfaces, processMessages, processor } = useA2UI({ actionHandler });

  useEffect(() => {
    const msgs: unknown[] = [
      { version: 'v0.9', createSurface: { surfaceId, catalogId: 'kickstart' } },
      { version: 'v0.9', updateComponents: { surfaceId, components } },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createdIds = processMessages(msgs as any);
    return () => {
      for (const id of createdIds) {
        try { processor.model.deleteSurface(id); } catch { /* already gone */ }
      }
    };
    // processMessages and processor are stable refs; re-run only when surfaceId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceId]);

  const surfaceEntries = Array.from(surfaces.entries());

  if (surfaceEntries.length === 0) {
    return <>{loading}</>;
  }

  return (
    <>
      {surfaceEntries.map(([id, surface]) => (
        <A2UISurfaceWrapper key={id} surface={surface} isActive={isActive} />
      ))}
    </>
  );
});
