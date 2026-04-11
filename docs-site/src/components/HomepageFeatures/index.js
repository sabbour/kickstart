"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HomepageFeatures;
const clsx_1 = __importDefault(require("clsx"));
const Heading_1 = __importDefault(require("@theme/Heading"));
const styles_module_css_1 = __importDefault(require("./styles.module.css"));
const FeatureList = [
    {
        title: 'Conversational AI',
        icon: (<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 10a4 4 0 014-4h28a4 4 0 014 4v20a4 4 0 01-4 4H20l-8 6v-6h-2a4 4 0 01-4-4V10z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="18" cy="20" r="2" fill="currentColor"/>
        <circle cx="24" cy="20" r="2" fill="currentColor"/>
        <circle cx="30" cy="20" r="2" fill="currentColor"/>
      </svg>),
        description: (<>
        Describe your app in plain language. Kickstart guides you through
        discovery, architecture, and deployment — all through natural conversation.
      </>),
    },
    {
        title: 'Rich UI Components',
        icon: (<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <rect x="26" y="6" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <rect x="6" y="26" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <rect x="26" y="26" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      </svg>),
        description: (<>
        A2UI v0.9 renders interactive cards, tabs, forms, and code blocks
        inline in the conversation. No more wall-of-text AI responses.
      </>),
    },
    {
        title: 'Real Artifacts',
        icon: (<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 6L40 14v20L24 42 8 34V14L24 6z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <path d="M24 6v36M8 14l16 8 16-8" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      </svg>),
        description: (<>
        Generates production-ready Dockerfiles, Kubernetes manifests, and
        GitHub Actions workflows — ready to deploy to AKS Automatic.
      </>),
    },
];
function Feature({ title, icon, description }) {
    return (<div className={(0, clsx_1.default)('col col--4')}>
      <div className="text--center" style={{ fontSize: '3rem', color: 'var(--ifm-color-primary)' }}>
        {icon}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading_1.default as="h3">{title}</Heading_1.default>
        <p>{description}</p>
      </div>
    </div>);
}
function HomepageFeatures() {
    return (<section className={styles_module_css_1.default.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (<Feature key={idx} {...props}/>))}
        </div>
      </div>
    </section>);
}
//# sourceMappingURL=index.js.map