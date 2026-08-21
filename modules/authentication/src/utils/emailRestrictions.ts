import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
// Vendored from https://github.com/disposable-email-domains/disposable-email-domains (blocklist) and ivolo wildcard.json
import disposableEmailDomains from '../data/disposable-email-domains.json' with { type: 'json' };

export interface EmailRestrictionsConfig {
  enabled: boolean;
  blockDisposableEmails: boolean;
  blockPlusAddressing: boolean;
  blockedAddresses: string[];
  blockedDomains: string[];
  allowedAddresses: string[];
  allowedDomains: string[];
}

export interface DisposableEmailSets {
  domains: Set<string>;
  wildcards: Set<string>;
}

export type EmailRestrictionResult =
  | { allowed: true }
  | { allowed: false; reason: string };

const disposableSets: DisposableEmailSets = {
  domains: new Set(disposableEmailDomains.domains),
  wildcards: new Set(disposableEmailDomains.wildcards),
};

function normalizeList(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.toLowerCase().trim())
    .filter(Boolean);
}

function isReservedAnonymousDomain(domain: string): boolean {
  return domain === 'anonymous.com' || domain.endsWith('.anonymous.com');
}

function matchesDomainSuffix(domain: string, suffixes: string[]): boolean {
  for (const suffix of suffixes) {
    if (!suffix.includes('.')) continue;
    if (domain === suffix || domain.endsWith(`.${suffix}`)) return true;
  }
  return false;
}

function isDisposableDomain(domain: string, sets: DisposableEmailSets): boolean {
  if (sets.domains.has(domain) || sets.wildcards.has(domain)) {
    return true;
  }
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    if (sets.wildcards.has(labels.slice(i).join('.'))) {
      return true;
    }
  }
  return false;
}

export function evaluateEmailRestrictions(
  email: string,
  config: EmailRestrictionsConfig,
  disposable: DisposableEmailSets,
): EmailRestrictionResult {
  const normalized = email.toLowerCase().trim();
  const at = normalized.lastIndexOf('@');
  const localPart = at === -1 ? normalized : normalized.slice(0, at);
  const domain = at === -1 ? '' : normalized.slice(at + 1);

  if (domain && isReservedAnonymousDomain(domain)) {
    return { allowed: false, reason: 'reserved anonymous domain' };
  }

  if (!config.enabled) {
    return { allowed: true };
  }

  const allowedAddresses = normalizeList(config.allowedAddresses);
  const allowedDomains = normalizeList(config.allowedDomains);
  const blockedAddresses = normalizeList(config.blockedAddresses);
  const blockedDomains = normalizeList(config.blockedDomains);

  if (allowedAddresses.includes(normalized)) {
    return { allowed: true };
  }

  if (matchesDomainSuffix(domain, allowedDomains)) {
    return { allowed: true };
  }

  if (config.blockPlusAddressing && localPart.includes('+')) {
    return { allowed: false, reason: 'plus addressing' };
  }

  if (blockedAddresses.includes(normalized)) {
    return { allowed: false, reason: 'blocked address' };
  }

  if (matchesDomainSuffix(domain, blockedDomains)) {
    return { allowed: false, reason: 'blocked domain' };
  }

  if (config.blockDisposableEmails && isDisposableDomain(domain, disposable)) {
    return { allowed: false, reason: 'disposable domain' };
  }

  return { allowed: true };
}

export function assertEmailAllowed(
  email: string,
  errorType: 'grpc' | 'module' = 'grpc',
): void {
  const result = evaluateEmailRestrictions(
    email,
    ConfigController.getInstance().config.emailRestrictions,
    disposableSets,
  );
  if (result.allowed) return;

  ConduitGrpcSdk.Logger.warn(`Email address not allowed: ${result.reason}`);
  if (errorType === 'module') {
    throw new ModuleError(errors.EMAIL_NOT_ALLOWED, result.reason);
  }
  throw new GrpcError(status.INVALID_ARGUMENT, errors.EMAIL_NOT_ALLOWED.message);
}
