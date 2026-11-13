import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const CJ_API_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
export const CJ_GET_ACCESS_TOKEN_URL = `${CJ_API_BASE_URL}/authentication/getAccessToken`;
export const CJ_REFRESH_ACCESS_TOKEN_URL = `${CJ_API_BASE_URL}/authentication/refreshAccessToken`;
export const CJ_SETTING_GET_URL = `${CJ_API_BASE_URL}/setting/get`;

export type CjConnectionStatus =
  | 'Connected'
  | 'Authentication failed'
  | 'Connection unavailable';

export interface CjStoredTokenRecord {
  apiKeyFingerprint: string;
  openId: string | number | null;
  accessToken: string;
  accessTokenExpiryDate: string;
  refreshToken: string;
  refreshTokenExpiryDate: string;
  createDate: string;
  lastRefreshedAt: string;
}

export interface CjAccountInfo {
  openId?: string | number | null;
  isSandbox?: boolean;
  qpsLimit?: number;
}

export interface CjPublicStatus {
  status: CjConnectionStatus;
  message: string;
  configured: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastTestedAt: string | null;
  lastRefreshedAt: string | null;
  accountInfo: CjAccountInfo | null;
}

interface EncryptedTokenEnvelope {
  version: 1;
  apiKeyFingerprint: string;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt: string;
}

interface CjApiEnvelope<T = any> {
  code?: number;
  result?: boolean;
  message?: string;
  data?: T;
  requestId?: string;
  success?: boolean;
}

export class CjAuthError extends Error {
  public readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'CjAuthError';
    this.code = code;
  }
}

export class CjConnectionUnavailableError extends Error {
  public readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'CjConnectionUnavailableError';
    this.code = code;
  }
}

export interface CjServiceOptions {
  tokenFilePath?: string;
  getApiKey?: () => string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  refreshBufferMs?: number;
  minRequestSpacingMs?: number;
  requestTimeoutMs?: number;
  encryptionSecret?: string;
}

const DEFAULT_REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000; // Refresh 24 hours before token expiry
const REFRESH_TOKEN_SAFETY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before refresh token expiry
const DEFAULT_MIN_REQUEST_SPACING_MS = 1100; // Respect CJ API 2.0 QPS = 1 limit
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fingerprintSecret(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function sanitizeCjErrorMessage(
  rawMessage: string | undefined | null,
  secrets: Array<string | undefined | null> = []
): string {
  let msg = String(rawMessage || '').trim();
  if (!msg) return 'Unexpected error communicating with CJ Dropshipping API.';

  for (const secret of secrets) {
    if (secret && secret.length >= 6) {
      msg = msg.split(secret).join('[REDACTED]');
    }
  }

  // Scrub CJ API key pattern (e.g. CJ12345@api@abcdef...) and bearer/token strings
  msg = msg.replace(/CJ[A-Za-z0-9_-]*@api@[A-Za-z0-9_-]+/gi, '[REDACTED_API_KEY]');
  msg = msg.replace(/(CJ-Access-Token|accessToken|refreshToken|apiKey)\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/gi, '$1=[REDACTED]');

  return msg;
}

function isCjAuthCode(httpStatus: number, cjCode?: number, message?: string): boolean {
  if (httpStatus === 401 || httpStatus === 403) return true;
  if (cjCode === 1600001 || cjCode === 1600002 || cjCode === 1600003) return true;
  const lower = String(message || '').toLowerCase();
  return (
    lower.includes('invalid api key') ||
    lower.includes('apikey') ||
    lower.includes('api key') ||
    lower.includes('access token') ||
    lower.includes('refresh token') ||
    lower.includes('token expired') ||
    lower.includes('token is invalid') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication failed')
  );
}

function isCjRateLimitCode(httpStatus: number, cjCode?: number, message?: string): boolean {
  if (httpStatus === 429) return true;
  if (cjCode === 1600200 || cjCode === 1600100) return true;
  const lower = String(message || '').toLowerCase();
  return (
    lower.includes('qps') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('frequency') ||
    lower.includes('every 5 minutes')
  );
}

export class CjDropshippingService {
  private readonly tokenFilePath: string;
  private readonly getApiKeyFn: () => string;
  private readonly fetchImpl: typeof fetch;
  private readonly nowFn: () => number;
  private readonly refreshBufferMs: number;
  private readonly minRequestSpacingMs: number;
  private readonly requestTimeoutMs: number;
  private readonly encryptionSecretOverride?: string;

  private memoryTokenCache: CjStoredTokenRecord | null = null;
  private inFlightTokenPromise: Promise<CjStoredTokenRecord> | null = null;
  private inFlightTestPromise: Promise<CjPublicStatus> | null = null;
  private lastUpstreamCallAt = 0;
  private lastStatus: CjPublicStatus | null = null;
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: CjServiceOptions = {}) {
    this.tokenFilePath = options.tokenFilePath || path.resolve(process.cwd(), 'data', 'cj_tokens.json');
    this.getApiKeyFn = options.getApiKey || (() => (process.env.CJ_API_KEY || '').trim());
    this.fetchImpl = options.fetchImpl || fetch;
    this.nowFn = options.now || (() => Date.now());
    this.refreshBufferMs = options.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;
    this.minRequestSpacingMs = options.minRequestSpacingMs ?? DEFAULT_MIN_REQUEST_SPACING_MS;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.encryptionSecretOverride = options.encryptionSecret;
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKeyFn());
  }

  private getEncryptionMaterial(apiKey: string): string {
    return (
      this.encryptionSecretOverride ||
      process.env.CJ_TOKEN_SECRET ||
      process.env.SESSION_SECRET ||
      apiKey ||
      'vantera-cj-server-vault'
    );
  }

  private collectKnownSecrets(): string[] {
    const secrets: string[] = [];
    const apiKey = this.getApiKeyFn();
    if (apiKey) secrets.push(apiKey);
    if (this.memoryTokenCache?.accessToken) secrets.push(this.memoryTokenCache.accessToken);
    if (this.memoryTokenCache?.refreshToken) secrets.push(this.memoryTokenCache.refreshToken);
    return secrets;
  }

  private encryptRecord(record: CjStoredTokenRecord, apiKey: string): EncryptedTokenEnvelope {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(this.getEncryptionMaterial(apiKey), salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = JSON.stringify(record);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      version: 1,
      apiKeyFingerprint: record.apiKeyFingerprint,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      updatedAt: new Date(this.nowFn()).toISOString(),
    };
  }

  private decryptEnvelope(envelope: EncryptedTokenEnvelope, apiKey: string): CjStoredTokenRecord | null {
    try {
      if (!envelope || envelope.version !== 1) return null;
      const expectedFingerprint = fingerprintSecret(apiKey);
      if (envelope.apiKeyFingerprint !== expectedFingerprint) {
        return null;
      }
      const salt = Buffer.from(envelope.salt, 'hex');
      const iv = Buffer.from(envelope.iv, 'hex');
      const authTag = Buffer.from(envelope.authTag, 'hex');
      const ciphertext = Buffer.from(envelope.ciphertext, 'hex');
      const key = crypto.scryptSync(this.getEncryptionMaterial(apiKey), salt, 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      const parsed = JSON.parse(decrypted) as CjStoredTokenRecord;
      if (!parsed.accessToken || !parsed.refreshToken) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private loadStoredTokens(apiKey: string): CjStoredTokenRecord | null {
    const expectedFingerprint = fingerprintSecret(apiKey);

    if (this.memoryTokenCache && this.memoryTokenCache.apiKeyFingerprint === expectedFingerprint) {
      return this.memoryTokenCache;
    }

    try {
      if (!fs.existsSync(this.tokenFilePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.tokenFilePath, 'utf8');
      const parsed = JSON.parse(raw) as EncryptedTokenEnvelope;
      const decrypted = this.decryptEnvelope(parsed, apiKey);
      if (decrypted) {
        this.memoryTokenCache = decrypted;
        return decrypted;
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveStoredTokens(record: CjStoredTokenRecord, apiKey: string): void {
    this.memoryTokenCache = record;
    const dir = path.dirname(this.tokenFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const envelope = this.encryptRecord(record, apiKey);
    const tempPath = `${this.tokenFilePath}.tmp.${process.pid}.${this.nowFn()}`;
    fs.writeFileSync(tempPath, JSON.stringify(envelope, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, this.tokenFilePath);
    try {
      fs.chmodSync(this.tokenFilePath, 0o600);
    } catch {
      // Ignore chmod errors on platforms that do not support POSIX file modes
    }
  }

  public clearStoredTokens(): void {
    this.memoryTokenCache = null;
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
      }
    } catch {
      // Ignore unlink error
    }
  }

  private isAccessTokenFresh(record: CjStoredTokenRecord): boolean {
    const expiryMs = Date.parse(record.accessTokenExpiryDate);
    if (Number.isNaN(expiryMs)) return false;
    return expiryMs - this.nowFn() > this.refreshBufferMs;
  }

  private isAccessTokenUsable(record: CjStoredTokenRecord): boolean {
    const expiryMs = Date.parse(record.accessTokenExpiryDate);
    if (Number.isNaN(expiryMs)) return false;
    return expiryMs > this.nowFn() + 30_000;
  }

  private isRefreshTokenValid(record: CjStoredTokenRecord): boolean {
    const expiryMs = Date.parse(record.refreshTokenExpiryDate);
    if (Number.isNaN(expiryMs)) return false;
    return expiryMs - this.nowFn() > REFRESH_TOKEN_SAFETY_BUFFER_MS;
  }

  private async waitForRateLimitSlot(): Promise<void> {
    if (this.minRequestSpacingMs <= 0) return;
    const elapsed = this.nowFn() - this.lastUpstreamCallAt;
    if (this.lastUpstreamCallAt > 0 && elapsed < this.minRequestSpacingMs) {
      await sleep(this.minRequestSpacingMs - elapsed);
    }
    this.lastUpstreamCallAt = this.nowFn();
  }

  private async callCjJson<T>(
    url: string,
    init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
    extraSecrets: string[] = []
  ): Promise<{ httpStatus: number; payload: CjApiEnvelope<T> }> {
    await this.waitForRateLimitSlot();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: init.method,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
        body: init.body,
        signal: controller.signal,
      });

      const rawText = await response.text();
      let payload: CjApiEnvelope<T> = {};
      if (rawText && rawText.trim()) {
        try {
          payload = JSON.parse(rawText) as CjApiEnvelope<T>;
        } catch {
          throw new CjConnectionUnavailableError(
            `CJ Dropshipping returned an unexpected non-JSON response (HTTP ${response.status}).`
          );
        }
      }

      return { httpStatus: response.status, payload };
    } catch (err: any) {
      if (err instanceof CjConnectionUnavailableError || err instanceof CjAuthError) {
        throw err;
      }
      if (err?.name === 'AbortError') {
        throw new CjConnectionUnavailableError(
          'CJ Dropshipping API request timed out. Please verify network connectivity and retry.'
        );
      }
      const clean = sanitizeCjErrorMessage(err?.message, [...this.collectKnownSecrets(), ...extraSecrets]);
      throw new CjConnectionUnavailableError(`Unable to reach CJ Dropshipping API servers: ${clean}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseTokenPayload(
    apiKey: string,
    httpStatus: number,
    payload: CjApiEnvelope<any>,
    fallbackMessage: string
  ): CjStoredTokenRecord {
    const isOk =
      httpStatus >= 200 &&
      httpStatus < 300 &&
      payload.result !== false &&
      payload.success !== false &&
      (payload.code === 200 || payload.result === true || payload.success === true);
    const data = payload?.data;

    if (!isOk || !data?.accessToken || !data?.refreshToken) {
      const msg = sanitizeCjErrorMessage(
        payload?.message || fallbackMessage,
        this.collectKnownSecrets()
      );
      if (isCjRateLimitCode(httpStatus, payload?.code, msg)) {
        throw new CjConnectionUnavailableError(
          `CJ Dropshipping rate limit reached (code ${payload?.code ?? httpStatus}): ${msg}. Please wait a moment and try again.`,
          payload?.code
        );
      }
      if (isCjAuthCode(httpStatus, payload?.code, msg) || httpStatus >= 400 && httpStatus < 500) {
        throw new CjAuthError(
          `CJ authentication rejected${payload?.code ? ` (code ${payload.code})` : ''}: ${msg}`,
          payload?.code
        );
      }
      throw new CjConnectionUnavailableError(
        `CJ authentication service unavailable${payload?.code ? ` (code ${payload.code})` : ''}: ${msg}`,
        payload?.code
      );
    }

    const nowIso = new Date(this.nowFn()).toISOString();
    const record: CjStoredTokenRecord = {
      apiKeyFingerprint: fingerprintSecret(apiKey),
      openId: data.openId ?? null,
      accessToken: String(data.accessToken),
      accessTokenExpiryDate: String(
        data.accessTokenExpiryDate || new Date(this.nowFn() + 180 * 24 * 60 * 60 * 1000).toISOString()
      ),
      refreshToken: String(data.refreshToken),
      refreshTokenExpiryDate: String(
        data.refreshTokenExpiryDate || new Date(this.nowFn() + 180 * 24 * 60 * 60 * 1000).toISOString()
      ),
      createDate: String(data.createDate || nowIso),
      lastRefreshedAt: nowIso,
    };

    this.saveStoredTokens(record, apiKey);
    return record;
  }

  private async exchangeApiKeyForTokens(apiKey: string): Promise<CjStoredTokenRecord> {
    const { httpStatus, payload } = await this.callCjJson(
      CJ_GET_ACCESS_TOKEN_URL,
      {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      },
      [apiKey]
    );

    return this.parseTokenPayload(apiKey, httpStatus, payload, 'Failed to exchange CJ_API_KEY for access token.');
  }

  private async refreshStoredTokens(apiKey: string, refreshToken: string): Promise<CjStoredTokenRecord> {
    const { httpStatus, payload } = await this.callCjJson(
      CJ_REFRESH_ACCESS_TOKEN_URL,
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      },
      [apiKey, refreshToken]
    );

    return this.parseTokenPayload(apiKey, httpStatus, payload, 'Failed to refresh CJ access token.');
  }

  /**
   * Ensures a valid server-side CJ access token exists, automatically refreshing
   * before expiration or exchanging CJ_API_KEY when no valid token is stored.
   */
  public async ensureValidToken(options: { forceRefresh?: boolean } = {}): Promise<CjStoredTokenRecord> {
    if (this.inFlightTokenPromise) {
      return this.inFlightTokenPromise;
    }

    const run = async (): Promise<CjStoredTokenRecord> => {
      const apiKey = this.getApiKeyFn();
      if (!apiKey) {
        throw new CjAuthError('CJ_API_KEY is not configured in backend environment secrets.');
      }

      const existing = this.loadStoredTokens(apiKey);

      if (!options.forceRefresh && existing && this.isAccessTokenFresh(existing)) {
        return existing;
      }

      if (existing && this.isRefreshTokenValid(existing)) {
        try {
          return await this.refreshStoredTokens(apiKey, existing.refreshToken);
        } catch (err) {
          if (err instanceof CjAuthError) {
            // Refresh token rejected or revoked — fall back to full API key exchange
            return await this.exchangeApiKeyForTokens(apiKey);
          }
          // If network/rate limit happened during proactive pre-expiry refresh and current token is still valid, keep using it
          if (!options.forceRefresh && this.isAccessTokenUsable(existing)) {
            return existing;
          }
          throw err;
        }
      }

      return await this.exchangeApiKeyForTokens(apiKey);
    };

    this.inFlightTokenPromise = run().finally(() => {
      this.inFlightTokenPromise = null;
    });

    return this.inFlightTokenPromise;
  }

  /**
   * Queries CJ's read-only /setting/get endpoint with CJ-Access-Token to confirm live connectivity.
   * Automatically refreshes once if CJ reports an expired or invalid access token.
   */
  public async testConnection(): Promise<CjPublicStatus> {
    if (this.inFlightTestPromise) {
      return this.inFlightTestPromise;
    }

    const runTest = async (): Promise<CjPublicStatus> => {
      const testedAt = new Date(this.nowFn()).toISOString();
      const apiKey = this.getApiKeyFn();

      if (!apiKey) {
        const status: CjPublicStatus = {
          status: 'Authentication failed',
          message: 'CJ_API_KEY is not configured in backend environment secrets.',
          configured: false,
          hasAccessToken: false,
          hasRefreshToken: false,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          lastTestedAt: testedAt,
          lastRefreshedAt: null,
          accountInfo: null,
        };
        this.lastStatus = status;
        return status;
      }

      try {
        let tokenRecord = await this.ensureValidToken();

        let verifyCall = await this.callCjJson<any>(
          CJ_SETTING_GET_URL,
          {
            method: 'GET',
            headers: {
              'CJ-Access-Token': tokenRecord.accessToken,
            },
          },
          [apiKey, tokenRecord.accessToken, tokenRecord.refreshToken]
        );

        // If CJ reports token invalid/expired, clear stale token and force a clean re-auth once
        if (
          isCjAuthCode(verifyCall.httpStatus, verifyCall.payload?.code, verifyCall.payload?.message) &&
          !isCjRateLimitCode(verifyCall.httpStatus, verifyCall.payload?.code, verifyCall.payload?.message)
        ) {
          this.clearStoredTokens();
          tokenRecord = await this.ensureValidToken({ forceRefresh: true });
          verifyCall = await this.callCjJson<any>(
            CJ_SETTING_GET_URL,
            {
              method: 'GET',
              headers: {
                'CJ-Access-Token': tokenRecord.accessToken,
              },
            },
            [apiKey, tokenRecord.accessToken, tokenRecord.refreshToken]
          );
        }

        const { httpStatus, payload } = verifyCall;
        const ok =
          httpStatus >= 200 &&
          httpStatus < 300 &&
          payload.result !== false &&
          payload.success !== false &&
          (payload.code === 200 || payload.result === true || payload.success === true);

        if (ok) {
          const settingData = payload.data || {};
          const accountInfo: CjAccountInfo = {
            openId: settingData.openId ?? tokenRecord.openId ?? null,
            isSandbox: typeof settingData.isSandbox === 'boolean' ? settingData.isSandbox : undefined,
            qpsLimit: typeof settingData.qpsLimit === 'number' ? settingData.qpsLimit : undefined,
          };

          const status: CjPublicStatus = {
            status: 'Connected',
            message: 'CJ Dropshipping API 2.0 authenticated and ready.',
            configured: true,
            hasAccessToken: true,
            hasRefreshToken: true,
            accessTokenExpiresAt: tokenRecord.accessTokenExpiryDate,
            refreshTokenExpiresAt: tokenRecord.refreshTokenExpiryDate,
            lastTestedAt: testedAt,
            lastRefreshedAt: tokenRecord.lastRefreshedAt,
            accountInfo,
          };
          this.lastStatus = status;
          return status;
        }

        const sanitizedMsg = sanitizeCjErrorMessage(
          payload?.message || `Unexpected CJ response (HTTP ${httpStatus})`,
          [apiKey, tokenRecord.accessToken, tokenRecord.refreshToken]
        );

        if (isCjRateLimitCode(httpStatus, payload?.code, sanitizedMsg)) {
          const status: CjPublicStatus = {
            status: 'Connection unavailable',
            message: `CJ Dropshipping rate limit reached (code ${payload?.code ?? httpStatus}). Please wait a moment and re-test.`,
            configured: true,
            hasAccessToken: true,
            hasRefreshToken: true,
            accessTokenExpiresAt: tokenRecord.accessTokenExpiryDate,
            refreshTokenExpiresAt: tokenRecord.refreshTokenExpiryDate,
            lastTestedAt: testedAt,
            lastRefreshedAt: tokenRecord.lastRefreshedAt,
            accountInfo: null,
          };
          this.lastStatus = status;
          return status;
        }

        if (isCjAuthCode(httpStatus, payload?.code, sanitizedMsg)) {
          const status: CjPublicStatus = {
            status: 'Authentication failed',
            message: `CJ authentication failed${payload?.code ? ` (code ${payload.code})` : ''}: ${sanitizedMsg}`,
            configured: true,
            hasAccessToken: false,
            hasRefreshToken: false,
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
            lastTestedAt: testedAt,
            lastRefreshedAt: null,
            accountInfo: null,
          };
          this.lastStatus = status;
          return status;
        }

        const status: CjPublicStatus = {
          status: 'Connection unavailable',
          message: `CJ Dropshipping service returned an error${payload?.code ? ` (code ${payload.code})` : ''}: ${sanitizedMsg}`,
          configured: true,
          hasAccessToken: Boolean(tokenRecord.accessToken),
          hasRefreshToken: Boolean(tokenRecord.refreshToken),
          accessTokenExpiresAt: tokenRecord.accessTokenExpiryDate,
          refreshTokenExpiresAt: tokenRecord.refreshTokenExpiryDate,
          lastTestedAt: testedAt,
          lastRefreshedAt: tokenRecord.lastRefreshedAt,
          accountInfo: null,
        };
        this.lastStatus = status;
        return status;
      } catch (err: any) {
        const stored = this.loadStoredTokens(apiKey);
        const sanitizedMsg = sanitizeCjErrorMessage(err?.message, this.collectKnownSecrets());

        if (err instanceof CjAuthError) {
          const status: CjPublicStatus = {
            status: 'Authentication failed',
            message: sanitizedMsg,
            configured: true,
            hasAccessToken: false,
            hasRefreshToken: false,
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
            lastTestedAt: testedAt,
            lastRefreshedAt: null,
            accountInfo: null,
          };
          this.lastStatus = status;
          return status;
        }

        const status: CjPublicStatus = {
          status: 'Connection unavailable',
          message: sanitizedMsg,
          configured: true,
          hasAccessToken: Boolean(stored?.accessToken),
          hasRefreshToken: Boolean(stored?.refreshToken),
          accessTokenExpiresAt: stored?.accessTokenExpiryDate || null,
          refreshTokenExpiresAt: stored?.refreshTokenExpiryDate || null,
          lastTestedAt: testedAt,
          lastRefreshedAt: stored?.lastRefreshedAt || null,
          accountInfo: null,
        };
        this.lastStatus = status;
        return status;
      }
    };

    this.inFlightTestPromise = runTest().finally(() => {
      this.inFlightTestPromise = null;
    });

    return this.inFlightTestPromise;
  }

  /**
   * Returns current sanitized connection status. If never tested yet, performs
   * an initial backend connection check automatically.
   */
  public async getStatus(): Promise<CjPublicStatus> {
    const apiKey = this.getApiKeyFn();
    if (!apiKey) {
      return {
        status: 'Authentication failed',
        message: 'CJ_API_KEY is not configured in backend environment secrets.',
        configured: false,
        hasAccessToken: false,
        hasRefreshToken: false,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTestedAt: this.lastStatus?.lastTestedAt || null,
        lastRefreshedAt: null,
        accountInfo: null,
      };
    }

    if (this.lastStatus && this.lastStatus.configured) {
      const stored = this.loadStoredTokens(apiKey);
      // If token is entering refresh window, silently refresh before returning status
      if (stored && !this.isAccessTokenFresh(stored)) {
        try {
          const refreshed = await this.ensureValidToken();
          this.lastStatus = {
            ...this.lastStatus,
            hasAccessToken: true,
            hasRefreshToken: true,
            accessTokenExpiresAt: refreshed.accessTokenExpiryDate,
            refreshTokenExpiresAt: refreshed.refreshTokenExpiryDate,
            lastRefreshedAt: refreshed.lastRefreshedAt,
          };
        } catch {
          // Run full testConnection to report accurate error status
          return this.testConnection();
        }
      }
      return this.lastStatus;
    }

    return this.testConnection();
  }

  /**
   * Starts a lightweight background scheduler that refreshes the CJ access token
   * proactively before expiration without preventing clean Node process exit.
   */
  public startAutoRefreshScheduler(intervalMs = 6 * 60 * 60 * 1000): void {
    if (this.autoRefreshTimer) return;
    this.autoRefreshTimer = setInterval(async () => {
      const apiKey = this.getApiKeyFn();
      if (!apiKey) return;
      const stored = this.loadStoredTokens(apiKey);
      if (stored && !this.isAccessTokenFresh(stored)) {
        try {
          await this.ensureValidToken();
        } catch (err: any) {
          console.warn('[CJ Auth Scheduler] Proactive token refresh notice:', sanitizeCjErrorMessage(err?.message, this.collectKnownSecrets()));
        }
      }
    }, intervalMs);

    if (typeof this.autoRefreshTimer.unref === 'function') {
      this.autoRefreshTimer.unref();
    }
  }

  public stopAutoRefreshScheduler(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }
}

export const cjService = new CjDropshippingService();
