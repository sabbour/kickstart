/**
 * fluent-icons.ts — Fluent UI React icon registry for A2UI Icon components.
 *
 * Registers the top ~30 most useful Fluent UI icons so they can be used
 * by name in A2UI Icon components: { "component": "Icon", "name": "document" }
 *
 * These live alongside Material Symbols (used via the material-symbols-outlined
 * CSS font class in the vendor A2UI renderer).
 */
import React from 'react';
import type { FluentIcon } from '@fluentui/react-icons';

import {
  DocumentRegular,
  FolderRegular,
  CodeRegular,
  SettingsRegular,
  HomeRegular,
  PersonRegular,
  SearchRegular,
  AddRegular,
  DeleteRegular,
  EditRegular,
  SaveRegular,
  SendRegular,
  StarRegular,
  CloudRegular,
  GlobeRegular,
  LockClosedRegular,
  KeyRegular,
  TagRegular,
  ChatRegular,
  ClockRegular,
  FilterRegular,
  ArrowLeftRegular,
  ChevronDownRegular,
  LinkRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  InfoRegular,
  DismissRegular,
  CopyRegular,
  ArrowUploadRegular,
  ArrowDownloadRegular,
} from '@fluentui/react-icons';

/** Map of icon name → Fluent UI React icon component. */
export const FLUENT_REACT_ICON_REGISTRY: Record<string, FluentIcon> = {
  // Documents & files
  document: DocumentRegular,
  folder: FolderRegular,
  code: CodeRegular,
  save: SaveRegular,
  copy: CopyRegular,

  // Navigation
  home: HomeRegular,
  arrowLeft: ArrowLeftRegular,
  chevronDown: ChevronDownRegular,
  link: LinkRegular,

  // Actions
  add: AddRegular,
  delete: DeleteRegular,
  edit: EditRegular,
  send: SendRegular,
  dismiss: DismissRegular,
  filter: FilterRegular,
  search: SearchRegular,
  upload: ArrowUploadRegular,
  download: ArrowDownloadRegular,

  // Status & info
  checkmarkCircle: CheckmarkCircleRegular,
  warning: WarningRegular,
  info: InfoRegular,
  star: StarRegular,

  // People & identity
  person: PersonRegular,
  key: KeyRegular,
  lock: LockClosedRegular,

  // System & cloud
  settings: SettingsRegular,
  cloud: CloudRegular,
  globe: GlobeRegular,

  // Communication
  chat: ChatRegular,
  clock: ClockRegular,
  tag: TagRegular,
};

export type FluentIconName = keyof typeof FLUENT_REACT_ICON_REGISTRY;

/**
 * Looks up a Fluent UI React icon component by name.
 * Returns null if the name is not registered.
 */
export function getFluentIcon(name: string): FluentIcon | null {
  return FLUENT_REACT_ICON_REGISTRY[name] ?? null;
}

/**
 * Renders a Fluent UI React icon as a React element.
 * Returns null if the name is not registered.
 */
export function renderFluentIcon(
  name: string,
  props?: { className?: string; style?: React.CSSProperties },
): React.ReactElement | null {
  const Icon = getFluentIcon(name);
  if (!Icon) return null;
  return React.createElement(Icon, { fontSize: 24, ...props });
}
