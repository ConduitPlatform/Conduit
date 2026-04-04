import type { RateLimitOptions } from '@conduitplatform/grpc-sdk';

export const EMAIL_SEND_STRICT: RateLimitOptions = {
  maxRequests: 8,
  resetInterval: 900,
};

export const AUTH_CREDENTIALS: RateLimitOptions = {
  maxRequests: 30,
  resetInterval: 900,
};

export const PASSWORD_RESET_SUBMIT: RateLimitOptions = {
  maxRequests: 25,
  resetInterval: 900,
};

export const EMAIL_CODE_VERIFY: RateLimitOptions = {
  maxRequests: 15,
  resetInterval: 900,
};

export const EMAIL_VERIFY_HOOK: RateLimitOptions = {
  maxRequests: 45,
  resetInterval: 3600,
};

export const OAUTH_CALLBACK: RateLimitOptions = {
  maxRequests: 50,
  resetInterval: 3600,
};

export const OAUTH_INIT: RateLimitOptions = {
  maxRequests: 35,
  resetInterval: 900,
};

export const OAUTH_NATIVE_COMPLETE: RateLimitOptions = {
  maxRequests: 35,
  resetInterval: 900,
};

export const PHONE_SMS_SEND: RateLimitOptions = EMAIL_SEND_STRICT;

export const PHONE_CODE_VERIFY: RateLimitOptions = {
  maxRequests: 25,
  resetInterval: 900,
};

export const MAGIC_LINK_EXCHANGE: RateLimitOptions = AUTH_CREDENTIALS;

export const SERVICE_ACCOUNT: RateLimitOptions = {
  maxRequests: 30,
  resetInterval: 300,
};

export const TWO_FA_CHALLENGE: RateLimitOptions = {
  maxRequests: 20,
  resetInterval: 900,
};

export const ALT_STRATEGY_AUTH: RateLimitOptions = AUTH_CREDENTIALS;
