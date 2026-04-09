import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Conversational AI',
    emoji: '💬',
    description: (
      <>
        Describe your app in plain language. Kickstart guides you through
        discovery, architecture, and deployment — all through natural conversation.
      </>
    ),
  },
  {
    title: 'Rich UI Components',
    emoji: '🧩',
    description: (
      <>
        A2UI v0.9 renders interactive cards, tabs, forms, and code blocks
        inline in the conversation. No more wall-of-text AI responses.
      </>
    ),
  },
  {
    title: 'Real Artifacts',
    emoji: '📦',
    description: (
      <>
        Generates production-ready Dockerfiles, Kubernetes manifests, and
        GitHub Actions workflows — ready to deploy to AKS Automatic.
      </>
    ),
  },
];

function Feature({title, emoji, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center" style={{fontSize: '3rem'}}>
        {emoji}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
