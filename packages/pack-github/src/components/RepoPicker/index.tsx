import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  Input,
  Label,
  Switch,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const RepoItemSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  private: z.boolean().optional(),
  defaultBranch: z.string().optional(),
  htmlUrl: z.string().optional(),
});

const RepoPickerSchema = z.object({
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  owner: z.string().optional(),
  mode: z.enum(['pick', 'create']).default('pick'),
  repos: z.array(RepoItemSchema).optional(),
  selectedRepo: z.string().optional(),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RepoPickerProps = z.infer<typeof RepoPickerSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  list: {
    marginTop: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    maxHeight: '320px',
    overflowY: 'auto',
  },
  item: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
  },
  selectedItem: {
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const RepoPickerRenderer: React.FC<{ props: RepoPickerProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;
  const [selectedRepo, setSelectedRepo] = useState(props.selectedRepo);

  useEffect(() => {
    setSelectedRepo(props.selectedRepo);
  }, [props.selectedRepo]);

  const header =
    props.mode === 'create' ? 'Create GitHub Repository' : 'Select GitHub Repository';
  const ownerPrefix = props.owner ? `${props.owner}/` : '';

  return (
    <Card className={containerClass}>
      <CardHeader header={<Text weight="semibold">{header}</Text>} />
      {props.owner && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          Account: {String(props.owner)}
        </Text>
      )}
      {props.status === 'loading' && <Spinner size="small" label="Loading repositories…" />}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
      {props.mode === 'pick' && props.status === 'loaded' && props.repos && (
        <div className={classes.list}>
          {props.repos.map((repo) => {
            const isSelected = repo.name === selectedRepo;
            return (
              <div
                key={repo.name}
                className={`${classes.item} ${isSelected ? classes.selectedItem : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setSelectedRepo(repo.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedRepo(repo.name);
                  }
                }}
              >
                <Text size={300} weight={isSelected ? 'semibold' : 'regular'}>
                  {ownerPrefix}{String(repo.name)}
                </Text>
                {repo.description && (
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                    {String(repo.description)}
                  </Text>
                )}
              </div>
            );
          })}
        </div>
      )}
      {props.mode === 'create' && props.isActive && (
        <div className={classes.createForm}>
          <div>
            <Label htmlFor="repo-name">Repository name</Label>
            <Input id="repo-name" placeholder="my-aks-app" disabled contentBefore={<Text size={200}>{ownerPrefix}</Text>} />
          </div>
          <Switch label="Private repository" defaultChecked disabled />
        </div>
      )}
    </Card>
  );
};

export const repoPickerContribution: ComponentContribution = {
  name: 'github/RepoPicker',
  propertySchema: RepoPickerSchema,
  renderer: RepoPickerRenderer,
};
