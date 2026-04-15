import { SessionExpiredError } from '../services/api-client';

export type AzureUiErrorScope =
  | 'auth-config'
  | 'auth-session'
  | 'auth-signin'
  | 'auth-signout'
  | 'target-load'
  | 'target-save'
  | 'resource-load'
  | 'deployment-start'
  | 'deployment-status'
  | 'deployment-failed'
  | 'cost-gate';

const SAFE_UI_MESSAGES = new Set([
  'Azure sign-in is not configured on the server.',
  'Azure sign-in is unavailable in this environment.',
  'Azure target discovery is not available yet. Enter the deployment target manually.',
  'No Azure subscriptions were returned for this Microsoft account.',
  'Choose a subscription, resource group, and region before continuing.',
  'Sign in to Azure before continuing.',
  'Sign in to Azure before choosing a deployment target.',
  'This chat session is not ready to deploy yet. Send a message first so Kickstart can create a backend session.',
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractAzureErrorText(error: unknown): string | undefined {
  if (error instanceof Error) {
    return readString(error.message);
  }

  if (typeof error === 'string') {
    return readString(error);
  }

  const record = asRecord(error);
  if (!record) {
    return undefined;
  }

  const nestedError = asRecord(record.error);

  return readString(record.message)
    ?? readString(record.error)
    ?? readString(record.error_description)
    ?? readString(nestedError?.message)
    ?? readString(nestedError?.error_description)
    ?? readString(nestedError?.code);
}

function isSessionExpired(error: unknown, normalized: string): boolean {
  return error instanceof SessionExpiredError
    || normalized.includes('session has expired')
    || normalized.includes('sign in again')
    || normalized.includes('login page');
}

function isNetworkIssue(normalized: string): boolean {
  return normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('network request failed')
    || normalized.includes('network error')
    || normalized.includes('load failed')
    || normalized.includes('fetcherror');
}

function isCancellation(normalized: string): boolean {
  return normalized.includes('cancel')
    || normalized.includes('popup window closed')
    || normalized.includes('popup_window_error')
    || normalized.includes('monitor_window_timeout')
    || normalized.includes('user_cancelled');
}

function isPermissionIssue(normalized: string): boolean {
  return normalized.includes('authorizationfailed')
    || normalized.includes('forbidden')
    || normalized.includes('permission')
    || normalized.includes('unauthorized')
    || normalized.includes('access denied')
    || normalized.includes('aadsts65001')
    || normalized.includes('aadsts65004')
    || normalized.includes('unauthorized_client')
    || normalized.includes('consent');
}

function isTargetNotFound(normalized: string): boolean {
  return normalized.includes('resourcegroupnotfound')
    || normalized.includes('resource group not found')
    || normalized.includes('subscription not found')
    || normalized.includes('invalidsubscription')
    || normalized.includes('missingsubscription')
    || normalized.includes('invalid subscription');
}

function isQuotaIssue(normalized: string): boolean {
  return normalized.includes('quota')
    || normalized.includes('skunotavailable')
    || normalized.includes('capacity')
    || normalized.includes('insufficient')
    || normalized.includes('operationnotallowed');
}

function isTimeoutIssue(normalized: string): boolean {
  return normalized.includes('timed out')
    || normalized.includes('timeout')
    || normalized.includes('deadline exceeded');
}

function isConfigurationIssue(normalized: string): boolean {
  return normalized.includes('validation')
    || normalized.includes('invalidtemplate')
    || normalized.includes('invalidparameter')
    || normalized.includes('badrequest')
    || normalized.includes('requestdisallowedbypolicy')
    || normalized.includes('policy')
    || normalized.includes('template');
}

function containsSensitiveToken(text: string): boolean {
  return /\b(?:access[_ -]?token|refresh[_ -]?token|id[_ -]?token)\b/i.test(text)
    || /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text);
}

function looksLikeStructuredPayload(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{')
    || trimmed.startsWith('[')
    || /^<!doctype/i.test(trimmed)
    || /^<html/i.test(trimmed);
}

function containsDiagnosticMarkers(text: string): boolean {
  return /(stdout|stderr|traceback|stack\s*trace|exception|innererror|request id|correlation id|activity id|x-ms-|management\.azure\.com)/i.test(text)
    || /\bat [A-Za-z0-9_$./<>:-]+\(/.test(text);
}

function hasUnsafeText(text: string, maxLength = 180): boolean {
  return text.length > maxLength
    || /[\r\n]/.test(text)
    || containsSensitiveToken(text)
    || looksLikeStructuredPayload(text)
    || containsDiagnosticMarkers(text);
}

function defaultStatusMessage(status: unknown): string | undefined {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';

  switch (normalized) {
    case 'queued':
    case 'pending':
      return 'Preparing the Azure deployment…';
    case 'running':
    case 'in_progress':
    case 'active':
      return 'Azure deployment is in progress.';
    case 'succeeded':
    case 'success':
    case 'completed':
    case 'complete':
      return 'Azure deployment completed successfully.';
    default:
      return undefined;
  }
}

function isProgressCopy(normalized: string): boolean {
  return /(prepar|start|validat|deploy|provision|wait|check|creat|configur|connect|queue|run|ready|complete|finish|save)/.test(normalized);
}

function isFailureCopy(normalized: string): boolean {
  return /(fail|error|forbidden|unauthor|denied|quota|policy|timeout|exception|cancel)/.test(normalized);
}

export function sanitizeAzureUiErrorMessage(error: unknown, scope: AzureUiErrorScope): string {
  const raw = extractAzureErrorText(error);
  if (raw && SAFE_UI_MESSAGES.has(raw)) {
    return raw;
  }

  const normalized = normalizeWhitespace(raw ?? '').toLowerCase();

  if (scope.startsWith('auth')) {
    if (isSessionExpired(error, normalized)) {
      return 'Your Azure session expired. Sign in again to continue.';
    }
    if (normalized.includes('not configured') || normalized.includes('auth configuration')) {
      return 'Azure sign-in is not configured on the server.';
    }
    if (normalized.includes('no active account')
      || normalized.includes('no account')
      || normalized.includes('login required')
      || normalized.includes('interaction required')
      || normalized.includes('not signed in')) {
      return 'Sign in to Azure before continuing.';
    }
    if (isCancellation(normalized)) {
      return 'Azure sign-in was cancelled before completion.';
    }
    if (isPermissionIssue(normalized)) {
      return 'Azure sign-in needs additional permissions before Kickstart can continue.';
    }
    if (isNetworkIssue(normalized)) {
      return 'Kickstart could not reach Azure sign-in right now. Check your connection and try again.';
    }
    return scope === 'auth-signout'
      ? 'Azure sign-out could not be completed. Try again.'
      : scope === 'auth-config'
        ? 'Unable to load Azure sign-in configuration.'
        : 'Azure sign-in could not be completed. Try again.';
  }

  if (isSessionExpired(error, normalized)) {
    return scope === 'deployment-start' || scope === 'deployment-status' || scope === 'deployment-failed'
      ? 'Your Azure session expired. Sign in again before retrying the deployment.'
      : 'Your Azure session expired. Sign in again to continue.';
  }

  if (normalized.includes('not configured')) {
    return 'Azure sign-in is not configured on the server.';
  }

  if (normalized.includes('sign in to azure')) {
    return scope === 'deployment-start' || scope === 'deployment-status' || scope === 'deployment-failed'
      ? 'Sign in to Azure before retrying the deployment.'
      : 'Sign in to Azure before choosing a deployment target.';
  }

  if (isPermissionIssue(normalized)) {
    return scope === 'deployment-start' || scope === 'deployment-status' || scope === 'deployment-failed'
      ? 'Azure rejected the deployment permissions for this session. Reconnect Azure or confirm access to the target subscription.'
      : 'Kickstart does not have access to the selected Azure subscription or resource group.';
  }

  if (isTargetNotFound(normalized)) {
    return 'Kickstart could not find the selected subscription or resource group. Re-select the Azure target and try again.';
  }

  if (isQuotaIssue(normalized)) {
    return 'Azure could not allocate capacity for this deployment in the selected region. Try another region or retry later.';
  }

  if (isTimeoutIssue(normalized)) {
    return 'The deployment timed out before Azure reported success. Check Azure and retry if needed.';
  }

  if (isConfigurationIssue(normalized)) {
    return scope === 'deployment-start' || scope === 'deployment-status' || scope === 'deployment-failed'
      ? 'Azure rejected the deployment configuration. Review the selected target and try again.'
      : 'Kickstart could not use the selected Azure target. Review it and try again.';
  }

  if (normalized.includes('runid') || normalized.includes('run identifier')) {
    return 'Kickstart did not receive a valid deployment run identifier. Retry the deployment.';
  }

  if (isNetworkIssue(normalized)) {
    switch (scope) {
      case 'cost-gate':
        return 'Kickstart could not record cost approval right now. Try again.';
      case 'target-save':
        return 'Kickstart could not save the Azure deployment target right now. Try again.';
      case 'resource-load':
        return 'Kickstart could not load Azure resources right now. Try again.';
      case 'deployment-start':
        return 'Kickstart could not start the Azure deployment right now. Check your connection and try again.';
      case 'deployment-status':
        return 'Kickstart could not refresh Azure deployment status right now.';
      default:
        return 'Kickstart could not load Azure deployment targets right now. Try again.';
    }
  }

  switch (scope) {
    case 'cost-gate':
      return 'Kickstart could not record cost approval right now. Try again.';
    case 'target-save':
      return 'Kickstart could not save the Azure deployment target. Try again.';
    case 'resource-load':
      return 'Kickstart could not load Azure resources right now. Try again.';
    case 'deployment-start':
      return 'Kickstart could not start the Azure deployment. Try again.';
    case 'deployment-status':
      return 'Kickstart could not refresh Azure deployment status right now.';
    case 'deployment-failed':
      return 'Azure reported a deployment failure. Review the deployment target and retry when ready.';
    default:
      return 'Kickstart could not load Azure deployment targets right now. Try again.';
  }
}

export function sanitizeAzureDeploymentStatusMessage(message: unknown, status?: unknown): string | undefined {
  const raw = readString(message);
  const fallback = defaultStatusMessage(status);

  if (!raw) {
    return fallback;
  }

  const normalized = normalizeWhitespace(raw).toLowerCase();
  if (hasUnsafeText(raw, 120) || isFailureCopy(normalized)) {
    return fallback;
  }

  return isProgressCopy(normalized) ? raw : fallback;
}

export function sanitizeAzureDeploymentStepLabel(label: unknown, fallback: string): string {
  const raw = readString(label);
  if (!raw || hasUnsafeText(raw, 80)) {
    return fallback;
  }

  return raw;
}

export function sanitizeAzureDeploymentStepDetail(detail: unknown): string | undefined {
  const raw = readString(detail);
  if (!raw) {
    return undefined;
  }

  const normalized = normalizeWhitespace(raw).toLowerCase();
  if (hasUnsafeText(raw, 120) || isFailureCopy(normalized) || !isProgressCopy(normalized)) {
    return undefined;
  }

  return raw;
}

export function sanitizeAzureDeploymentErrorMessage(errorCode: unknown, errorMessage: unknown): string | undefined {
  const normalized = normalizeWhitespace(`${readString(errorCode) ?? ''} ${readString(errorMessage) ?? ''}`).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (isPermissionIssue(normalized)) {
    return 'Azure rejected the deployment permissions for this session. Reconnect Azure or confirm access to the target subscription.';
  }

  if (isTargetNotFound(normalized)) {
    return 'Kickstart could not find the selected subscription or resource group. Re-select the Azure target and try again.';
  }

  if (isQuotaIssue(normalized)) {
    return 'Azure could not allocate capacity for this deployment in the selected region. Try another region or retry later.';
  }

  if (isTimeoutIssue(normalized)) {
    return 'The deployment timed out before Azure reported success. Check Azure and retry if needed.';
  }

  if (isConfigurationIssue(normalized)) {
    return 'Azure rejected the deployment configuration. Review the selected target and try again.';
  }

  return 'Azure reported a deployment failure. Review the deployment target and retry when ready.';
}

export function sanitizeAzureExternalUrl(
  value: unknown,
  kind: 'app' | 'portal',
): string | undefined {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = new URL(raw);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    if (!isHttp || parsed.username || parsed.password) {
      return undefined;
    }

    if (kind === 'portal') {
      const host = parsed.hostname.toLowerCase();
      const allowedPortalHosts = new Set([
        'portal.azure.com',
        'ms.portal.azure.com',
        'portal.azure.us',
        'portal.azure.cn',
        'portal.azure.de',
      ]);
      if (!allowedPortalHosts.has(host)) {
        return undefined;
      }
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}
