// Core types
export type {
  APIConnector,
  ConfigurableConnector,
  APIConnectorRequestOptions,
  HttpMethod,
  AuthStrategy,
  OAuth2AuthStrategy,
  APIKeyAuthStrategy,
  ManagedIdentityAuthStrategy,
  NoAuthStrategy,
  TokenInfo,
  TokenProvider,
  AuthProvider,
  OAuth2AuthProvider,
  APIKeyAuthProvider,
  ManagedIdentityAuthProvider,
  RetryConfig,
  CORSProxyConfig,
  ConnectorConfig,
  ConnectorErrorCode,
} from './types.js';
export { ConnectorError, DEFAULT_RETRY_CONFIG } from './types.js';

// Retry utilities
export { withRetry, calculateDelay, parseRetryAfter } from './retry.js';

// Base connector
export { BaseConnector } from './BaseConnector.js';

// Registry
export { APIConnectorRegistry, defaultConnectorRegistry } from './registry.js';

// Concrete connectors
export { AzureARMConnector } from './AzureARMConnector.js';
export type { AzureResource, AzureResourceGroup, AzureSubscription, AzureLocation } from './AzureARMConnector.js';
export { GitHubConnector } from './GitHubConnector.js';
export type {
  GitHubRepo,
  GitHubBranch,
  GitHubRepoOptions,
  GitHubUser,
  GitHubDeviceCodeResponse,
  GitHubPullRequest,
  GitHubCommitFile,
  GitHubCommitPullRequestInput,
  GitHubCommitPullRequestResult,
  GitHubConnectorConfig,
  GitHubTree,
  GitHubTreeEntry,
  GitHubFileContent,
} from './GitHubConnector.js';
export { PricingConnector } from './PricingConnector.js';
export type {
  ResourceCostInput,
  ResourceCostEstimate,
  CostEstimateResult,
  RetailPriceItem,
  RetailPricesResponse,
  RetailPriceQuery,
  VmPriceResult,
} from './PricingConnector.js';

// Rate-limit tracker
export { gitHubRateLimiter } from './github-rate-limit.js';
export type { RateLimitState, RateLimitCheckResult } from './github-rate-limit.js';
