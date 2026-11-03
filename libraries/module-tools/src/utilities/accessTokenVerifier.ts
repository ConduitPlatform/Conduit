import { AccessTokenClaims, ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { createPublicKey } from 'node:crypto';
import {
  AccessTokenSigningKeys,
  AccessTokenVerifyOptions,
  verifyAccessToken,
} from './accessTokenVerifier.logic.js';

export type AccessTokenMode = 'session' | 'jwt';

export interface AccessTokenVerifierSnapshot {
  mode: AccessTokenMode;
  strictRevocation: boolean;
  ready: boolean;
  tokenVersion: number;
  /** Current signing key id, if keys are loaded. */
  kid?: string;
}

export const AUTHENTICATION_CONFIG_UPDATE_CHANNEL = 'authentication:config:update';

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const UNKNOWN_KID_REFETCH_MIN_MS = 10 * 1000;
const SUBSCRIBER_ID = 'access-token-verifier';

/**
 * In-process verifier for "jwt" session mode access tokens. Holds the authentication
 * module's public signing keys, kept fresh through the config bus channel.
 */
function isConfigWithAccessTokens(
  config: unknown,
): config is { accessTokens: Record<string, any> } {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof (config as { accessTokens?: unknown }).accessTokens === 'object' &&
    (config as { accessTokens?: unknown }).accessTokens !== null
  );
}

export class AccessTokenVerifier {
  private static instance?: AccessTokenVerifier;

  private _mode: AccessTokenMode = 'session';
  private _strictRevocation = false;
  private _tokenVersion = 0;
  private _signing?: AccessTokenSigningKeys;
  private _loaded = false;
  private _subscribed = false;
  private _generation = 0;
  private _running = false;
  private _retryTimer?: NodeJS.Timeout;
  private _refreshTimer?: NodeJS.Timeout;
  private _lastRefetch = 0;
  private _refetching = false;
  private _warned = new Set<string>();
  private _listeners = new Set<(state: AccessTokenVerifierSnapshot) => void>();

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  static getInstance(grpcSdk: ConduitGrpcSdk): AccessTokenVerifier {
    if (!AccessTokenVerifier.instance) {
      AccessTokenVerifier.instance = new AccessTokenVerifier(grpcSdk);
    }
    return AccessTokenVerifier.instance;
  }

  /**
   * Internal, for tests only: stops the verifier, clears all state and drops the singleton.
   */
  static resetForTests(): void {
    AccessTokenVerifier.instance?.stop();
    AccessTokenVerifier.instance?.resetState();
    AccessTokenVerifier.instance = undefined;
  }

  private resetState() {
    this._mode = 'session';
    this._strictRevocation = false;
    this._tokenVersion = 0;
    this._signing = undefined;
    this._loaded = false;
    this._lastRefetch = 0;
    this._warned.clear();
    this._listeners.clear();
  }

  /** Snapshot of the verifier's observable state. */
  get state(): AccessTokenVerifierSnapshot {
    return {
      mode: this._mode,
      strictRevocation: this._strictRevocation,
      ready: this.ready,
      tokenVersion: this._tokenVersion,
      kid: this._signing?.kid,
    };
  }

  /**
   * Registers a listener fired synchronously at the end of every applyConfig that changed
   * anything (including the first successful load). Returns an unsubscribe function.
   */
  onChange(listener: (state: AccessTokenVerifierSnapshot) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private fingerprint(): string {
    return JSON.stringify([this._loaded, this._signing, this.state]);
  }

  get mode(): AccessTokenMode {
    return this._mode;
  }

  get strictRevocation(): boolean {
    return this._strictRevocation;
  }

  /** True once signing keys have been loaded. */
  get ready(): boolean {
    return !!this._signing?.publicKey;
  }

  get tokenVersion(): number {
    return this._tokenVersion;
  }

  /**
   * Loads the authentication config, subscribes to its updates and starts a slow periodic
   * refresh. The first attempt is awaited; if it fails, retries continue in the background
   * with capped backoff until the config is loaded and the subscription is acknowledged.
   * Idempotent while running; never throws.
   */
  async start(): Promise<void> {
    if (this._running) return;
    this._running = true;
    const generation = ++this._generation;
    await this.attempt(generation, INITIAL_RETRY_MS);
    if (generation !== this._generation) return;
    this._refreshTimer = setInterval(() => void this.refetch(true), REFRESH_INTERVAL_MS);
    this._refreshTimer.unref?.();
  }

  stop(): void {
    this._running = false;
    this._generation++;
    if (this._retryTimer) clearTimeout(this._retryTimer);
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._retryTimer = undefined;
    this._refreshTimer = undefined;
    if (this._subscribed) {
      try {
        this.grpcSdk.bus?.unsubscribe(SUBSCRIBER_ID);
      } catch {
        // ignore
      }
      this._subscribed = false;
    }
  }

  private async attempt(generation: number, delay: number): Promise<void> {
    if (generation !== this._generation) return;
    try {
      await this.subscribe(generation);
      if (!this._loaded) {
        this.applyConfig(await this.grpcSdk.config.get('authentication'));
      }
    } catch {
      // authentication or the bus may not be up yet; retry below
    }
    if (generation !== this._generation) return;
    if (this._subscribed && this._loaded) return;
    this._retryTimer = setTimeout(
      () => void this.attempt(generation, Math.min(delay * 2, MAX_RETRY_MS)),
      delay,
    );
    this._retryTimer.unref?.();
  }

  private async subscribe(generation: number) {
    if (this._subscribed) return;
    const bus = this.grpcSdk.bus;
    if (!bus) return;
    await bus.subscribeAck(
      AUTHENTICATION_CONFIG_UPDATE_CHANNEL,
      (message: string) => {
        try {
          this.applyConfig(JSON.parse(message));
        } catch {
          // ignore malformed update, keep previous state
        }
      },
      SUBSCRIBER_ID,
    );
    if (generation !== this._generation) {
      bus.unsubscribe(SUBSCRIBER_ID);
      return;
    }
    this._subscribed = true;
  }

  /** Refetches the config from the authentication module; failures keep the previous state. */
  private async refetch(force = false): Promise<void> {
    const now = Date.now();
    if (this._refetching) return;
    if (!force && now - this._lastRefetch < UNKNOWN_KID_REFETCH_MIN_MS) return;
    this._lastRefetch = now;
    this._refetching = true;
    try {
      this.applyConfig(await this.grpcSdk.config.get('authentication'));
    } catch {
      // keep previous state
    } finally {
      this._refetching = false;
    }
  }

  private warnOnce(key: string, message: string) {
    if (this._warned.has(key)) return;
    this._warned.add(key);
    ConduitGrpcSdk.Logger.warn(`AccessTokenVerifier: ${message}`);
  }

  private static validPem(pem: unknown): pem is string {
    if (typeof pem !== 'string' || !pem) return false;
    try {
      createPublicKey(pem);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates and normalizes the signing keys. Returns undefined when no signing block is
   * configured, null when the public key is invalid (the caller keeps the previous state).
   */
  private normalizeSigning(
    s: AccessTokenSigningKeys | undefined,
  ): AccessTokenSigningKeys | undefined | null {
    if (!(s && typeof s.kid === 'string' && s.kid && s.publicKey)) return undefined;
    if (!AccessTokenVerifier.validPem(s.publicKey)) {
      this.warnOnce('publicKey', 'invalid signing public key, keeping previous state');
      return null;
    }
    const previousPublicKey = this.validPreviousKey(s.previousPublicKey);
    return {
      kid: s.kid,
      publicKey: s.publicKey,
      previousKid: previousPublicKey ? s.previousKid || undefined : undefined,
      previousPublicKey,
      previousRetiredAt: Number(s.previousRetiredAt ?? 0),
    };
  }

  private validPreviousKey(pem: string | undefined): string | undefined {
    if (!pem) return undefined;
    if (AccessTokenVerifier.validPem(pem)) return pem;
    this.warnOnce('previousPublicKey', 'invalid previous public key, ignoring it');
    return undefined;
  }

  private parseTokenVersion(raw: unknown): number {
    const version = Number(raw ?? 0);
    if (Number.isNaN(version)) {
      this.warnOnce('tokenVersion', 'invalid tokenVersion, all tokens will be rejected');
    }
    return version;
  }

  private notifyListeners(): void {
    const state = this.state;
    for (const listener of [...this._listeners]) {
      try {
        listener(state);
      } catch (e) {
        ConduitGrpcSdk.Logger.warn(
          `AccessTokenVerifier: change listener failed: ${(e as Error)?.message}`,
        );
      }
    }
  }

  /**
   * Applies an authentication module config object (full config). Invalid input is ignored
   * and the previous state is kept; invalid keys are logged once.
   */
  applyConfig(config: unknown): void {
    if (!isConfigWithAccessTokens(config)) return;
    const tokens = config.accessTokens;
    const before = this.fingerprint();
    const signing = this.normalizeSigning(tokens.signing);
    if (signing === null) return;
    const version = this.parseTokenVersion(tokens.tokenVersion);
    this._mode = tokens.mode === 'jwt' ? 'jwt' : 'session';
    this._tokenVersion = version; // NaN never equals a claim's tv: fails closed
    this._strictRevocation = tokens.strictRevocation === true;
    this._signing = signing;
    this._loaded = true;
    if (this.fingerprint() !== before) this.notifyListeners();
  }

  /**
   * Verifies an access token, throwing GrpcError(UNAUTHENTICATED) with a short reason on failure.
   * `options.now` is epoch milliseconds. An `unknown kid` triggers a throttled (at most once
   * per 10 s) background refetch of the config, to pick up a rotation sooner.
   */
  verify(token: string, options?: AccessTokenVerifyOptions): AccessTokenClaims {
    if (!this._signing) {
      throw new GrpcError(status.UNAUTHENTICATED, 'verifier not ready');
    }
    try {
      return verifyAccessToken(
        token,
        { tokenVersion: this._tokenVersion, signing: this._signing },
        options,
      );
    } catch (e) {
      if ((e as Error).message === 'unknown kid') void this.refetch();
      throw e;
    }
  }
}
