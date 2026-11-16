import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  parseUsdPriceRangeCents,
  parseUsdPriceToCents,
  parseVariantAttributes,
  stripHtmlDescription,
} from '../src/lib/cjPricing.ts';

export const CJ_API_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
export const CJ_GET_ACCESS_TOKEN_URL = `${CJ_API_BASE_URL}/authentication/getAccessToken`;
export const CJ_REFRESH_ACCESS_TOKEN_URL = `${CJ_API_BASE_URL}/authentication/refreshAccessToken`;
export const CJ_SETTING_GET_URL = `${CJ_API_BASE_URL}/setting/get`;
export const CJ_PRODUCT_LIST_V2_URL = `${CJ_API_BASE_URL}/product/listV2`;
export const CJ_PRODUCT_QUERY_URL = `${CJ_API_BASE_URL}/product/query`;
export const CJ_VARIANT_QUERY_URL = `${CJ_API_BASE_URL}/product/variant/query`;
export const CJ_STOCK_BY_PID_URL = `${CJ_API_BASE_URL}/product/stock/getInventoryByPid`;
export const CJ_STOCK_BY_VID_URL = `${CJ_API_BASE_URL}/product/stock/queryByVid`;
export const CJ_FREIGHT_CALCULATE_URL = `${CJ_API_BASE_URL}/logistic/freightCalculate`;

export interface CjWarehouseInventoryItem {
  countryCode: string;
  areaEn: string;
  totalInventory: number;
  cjInventory: number;
  factoryInventory: number;
  verifiedWarehouse?: number;
}

export interface CjProductSearchItem {
  pid: string;
  productNameEn: string;
  productSku: string;
  spu: string;
  categoryId: string | null;
  categoryName: string | null;
  productImage: string | null;
  sellPriceRaw: string | null;
  supplierPriceCents: number | null;
  supplierPriceMaxCents: number | null;
  warehouseInventoryNum: number | null;
  listedNum: number | null;
}

export interface CjProductSearchResult {
  keyword: string;
  page: number;
  size: number;
  total: number;
  products: CjProductSearchItem[];
}

export interface CjProductVariantDetail {
  vid: string;
  pid: string;
  variantNameEn: string;
  variantSku: string;
  variantKey: string;
  label: string;
  color?: string;
  size?: string;
  variantImage: string | null;
  supplierPriceCents: number | null;
  variantSellPriceRaw: string | null;
  variantStandard: string | null;
  weightGrams: number | null;
  stockQuantity: number | null;
  warehouseStock: CjWarehouseInventoryItem[];
}

export interface CjProductDetail {
  pid: string;
  productNameEn: string;
  productSku: string;
  spu: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string;
  descriptionHtml: string;
  productImage: string | null;
  productImageSet: string[];
  sellPriceRaw: string | null;
  supplierPriceCents: number | null;
  supplierPriceMaxCents: number | null;
  productWeightGrams: number | null;
  materialNameEn: string | null;
  packingNameEn: string | null;
  entryCode: string | null;
  specs: Array<{ label: string; value: string }>;
  variants: CjProductVariantDetail[];
  warehouseStock: CjWarehouseInventoryItem[];
  totalInventory: number | null;
  inventorySynced: boolean;
  inventoryNote?: string;
  retrievedAt: string;
}

export interface CjFreightOption {
  logisticName: string;
  logisticAging: string;
  logisticPriceCents: number;
  taxesFeeCents: number;
  clearanceOperationFeeCents: number;
  totalPostageFeeCents: number;
  channelType: string | null;
}

export class CjApiRequestError extends Error {
  public readonly code?: number;
  public readonly httpStatus: number;
  constructor(message: string, httpStatus = 400, code?: number) {
    super(message);
    this.name = 'CjApiRequestError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

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
const DEFAULT_MIN_REQUEST_SPACING_MS = 350; // Respect CJ API 2.0 rate limits without excessive bulk delay
const DEFAULT_REQUEST_TIMEOUT_MS = 25000;

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

  private rateLimitQueue: Promise<void> = Promise.resolve();

  private async enqueueUpstreamCall<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.rateLimitQueue.then(async () => {
      if (this.minRequestSpacingMs > 0 && this.lastUpstreamCallAt > 0) {
        const elapsed = this.nowFn() - this.lastUpstreamCallAt;
        if (elapsed < this.minRequestSpacingMs) {
          await sleep(this.minRequestSpacingMs - elapsed);
        }
      }
      try {
        return await fn();
      } finally {
        this.lastUpstreamCallAt = this.nowFn();
      }
    });
    this.rateLimitQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async callCjJson<T>(
    url: string,
    init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
    extraSecrets: string[] = []
  ): Promise<{ httpStatus: number; payload: CjApiEnvelope<T> }> {
    return this.enqueueUpstreamCall(async () => {
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
    });
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

        // If CJ reports token invalid/expired, refresh via stored refreshToken first (avoiding getAccessToken 5-min cooldown)
        if (
          isCjAuthCode(verifyCall.httpStatus, verifyCall.payload?.code, verifyCall.payload?.message) &&
          !isCjRateLimitCode(verifyCall.httpStatus, verifyCall.payload?.code, verifyCall.payload?.message)
        ) {
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

          // If the refreshed token was also rejected by CJ, clear the stored tokens and force a clean API key exchange
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
          const rawQps = settingData.qpsLimit ?? settingData.setting?.qpsLimit;
          const accountInfo: CjAccountInfo = {
            openId: settingData.openId ?? tokenRecord.openId ?? null,
            isSandbox: typeof settingData.isSandbox === 'boolean' ? settingData.isSandbox : undefined,
            qpsLimit: typeof rawQps === 'number' ? rawQps : undefined,
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
          this.clearStoredTokens();
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

  private async callAuthenticatedCj<T>(
    url: string,
    init: { method: 'GET' | 'POST'; body?: string }
  ): Promise<T> {
    const apiKey = this.getApiKeyFn();
    if (!apiKey) {
      throw new CjAuthError('CJ_API_KEY is not configured in backend environment secrets.');
    }

    let tokenRecord = await this.ensureValidToken();
    const execute = async (accessToken: string) =>
      this.callCjJson<T>(
        url,
        {
          method: init.method,
          headers: {
            'CJ-Access-Token': accessToken,
          },
          body: init.body,
        },
        [apiKey, accessToken, tokenRecord.refreshToken]
      );

    let call = await execute(tokenRecord.accessToken);

    if (
      isCjAuthCode(call.httpStatus, call.payload?.code, call.payload?.message) &&
      !isCjRateLimitCode(call.httpStatus, call.payload?.code, call.payload?.message)
    ) {
      tokenRecord = await this.ensureValidToken({ forceRefresh: true });
      call = await execute(tokenRecord.accessToken);

      if (
        isCjAuthCode(call.httpStatus, call.payload?.code, call.payload?.message) &&
        !isCjRateLimitCode(call.httpStatus, call.payload?.code, call.payload?.message)
      ) {
        this.clearStoredTokens();
        tokenRecord = await this.ensureValidToken({ forceRefresh: true });
        call = await execute(tokenRecord.accessToken);
      }
    }

    const { httpStatus, payload } = call;
    const isOk =
      httpStatus >= 200 &&
      httpStatus < 300 &&
      payload.result !== false &&
      payload.success !== false &&
      (payload.code === 200 || payload.result === true || payload.success === true);

    if (!isOk) {
      const cleanMsg = sanitizeCjErrorMessage(
        payload?.message || `CJ Dropshipping API error (HTTP ${httpStatus})`,
        this.collectKnownSecrets()
      );
      if (isCjRateLimitCode(httpStatus, payload?.code, cleanMsg)) {
        throw new CjConnectionUnavailableError(
          `CJ Dropshipping rate limit reached (code ${payload?.code ?? httpStatus}): ${cleanMsg}`,
          payload?.code
        );
      }
      if (isCjAuthCode(httpStatus, payload?.code, cleanMsg)) {
        throw new CjAuthError(
          `CJ authentication failed${payload?.code ? ` (code ${payload.code})` : ''}: ${cleanMsg}`,
          payload?.code
        );
      }
      throw new CjApiRequestError(
        `${cleanMsg}${payload?.code ? ` (CJ code ${payload.code})` : ''}`,
        httpStatus >= 400 ? httpStatus : 400,
        payload?.code
      );
    }

    return payload.data as T;
  }

  private normalizeImageUrl(raw: unknown): string | null {
    const val = typeof raw === 'string' ? raw.trim() : '';
    if (!val) return null;
    if (val.startsWith('//')) return `https:${val}`;
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    return null;
  }

  private normalizeImageList(raw: unknown): string[] {
    let candidates: string[] = [];
    if (Array.isArray(raw)) {
      candidates = raw.map((item) => String(item || ''));
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            candidates = parsed.map((item) => String(item || ''));
          }
        } catch {
          candidates = trimmed.split(',');
        }
      } else {
        candidates = trimmed.split(',');
      }
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of candidates) {
      const normalized = this.normalizeImageUrl(c);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    }
    return out;
  }

  private normalizeWarehouseInventories(rawList: unknown): CjWarehouseInventoryItem[] {
    if (!Array.isArray(rawList)) return [];
    const out: CjWarehouseInventoryItem[] = [];
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, any>;
      const total = Number(obj.totalInventoryNum ?? obj.totalInventory ?? obj.inventoryNum ?? obj.storageNum ?? 0);
      const cjInv = Number(obj.cjInventoryNum ?? obj.cjInventory ?? 0);
      const factoryInv = Number(obj.factoryInventoryNum ?? obj.factoryInventory ?? 0);
      out.push({
        countryCode: String(obj.countryCode || obj.areaCountryCode || 'CN'),
        areaEn: String(obj.areaEn || obj.warehouseName || obj.countryCode || 'Global Warehouse'),
        totalInventory: Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0,
        cjInventory: Number.isFinite(cjInv) ? Math.max(0, Math.round(cjInv)) : 0,
        factoryInventory: Number.isFinite(factoryInv) ? Math.max(0, Math.round(factoryInv)) : 0,
        verifiedWarehouse: typeof obj.verifiedWarehouse === 'number' ? obj.verifiedWarehouse : undefined,
      });
    }
    return out;
  }

  /**
   * Searches CJ's real product catalogue using GET /product/listV2.
   */
  public async searchProducts(params: {
    keyword?: string;
    page?: number;
    size?: number;
    categoryId?: string;
    countryCode?: string;
  }): Promise<CjProductSearchResult> {
    const page = Math.max(1, Math.min(1000, Math.floor(params.page || 1)));
    const size = Math.max(1, Math.min(100, Math.floor(params.size || 12)));
    const keyword = (params.keyword || '').trim();

    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (keyword) qs.set('keyWord', keyword);
    if (params.categoryId?.trim()) qs.set('categoryId', params.categoryId.trim());
    if (params.countryCode?.trim()) qs.set('countryCode', params.countryCode.trim().toUpperCase());

    const data = await this.callAuthenticatedCj<any>(`${CJ_PRODUCT_LIST_V2_URL}?${qs.toString()}`, {
      method: 'GET',
    });

    const rawItems: any[] = [];
    if (Array.isArray(data?.content)) {
      for (const block of data.content) {
        if (Array.isArray(block?.productList)) {
          rawItems.push(...block.productList);
        } else if (block?.id || block?.pid) {
          rawItems.push(block);
        }
      }
    } else if (Array.isArray(data?.list)) {
      rawItems.push(...data.list);
    }

    const products: CjProductSearchItem[] = rawItems.map((item) => {
      const sellRaw = item.nowPrice ?? item.sellPrice ?? item.discountPrice ?? null;
      const range = parseUsdPriceRangeCents(sellRaw);
      const rawInv =
        item.warehouseInventoryNum ??
        item.inventoryNum ??
        item.totalInventory ??
        null;

      return {
        pid: String(item.id || item.pid || ''),
        productNameEn: String(item.nameEn || item.productNameEn || item.productName || 'Untitled CJ Item').trim(),
        productSku: String(item.sku || item.productSku || ''),
        spu: String(item.spu || item.sku || ''),
        categoryId: item.categoryId ? String(item.categoryId) : null,
        categoryName: item.threeCategoryName || item.twoCategoryName || item.oneCategoryName || item.categoryName || null,
        productImage: this.normalizeImageUrl(item.bigImage || item.productImage),
        sellPriceRaw: sellRaw !== null && sellRaw !== undefined ? String(sellRaw) : null,
        supplierPriceCents: range.minCents,
        supplierPriceMaxCents: range.maxCents,
        warehouseInventoryNum:
          typeof rawInv === 'number' && Number.isFinite(rawInv) ? Math.max(0, Math.round(rawInv)) : null,
        listedNum:
          typeof item.listedNum === 'number' && Number.isFinite(item.listedNum) ? item.listedNum : null,
      };
    }).filter((p) => Boolean(p.pid));

    const total =
      typeof data?.totalRecords === 'number'
        ? data.totalRecords
        : typeof data?.total === 'number'
        ? data.total
        : products.length;

    return {
      keyword,
      page: typeof data?.pageNumber === 'number' ? data.pageNumber : page,
      size: typeof data?.pageSize === 'number' ? data.pageSize : size,
      total,
      products,
    };
  }

  /**
   * Queries live warehouse stock breakdown for a product by PID via GET /product/stock/getInventoryByPid.
   */
  public async getInventoryByPid(pid: string): Promise<{
    pid: string;
    totalInventory: number;
    inventories: CjWarehouseInventoryItem[];
    variantInventories: Map<string, CjWarehouseInventoryItem[]>;
  }> {
    const cleanPid = pid.trim();
    if (!cleanPid) {
      throw new CjApiRequestError('CJ Product ID (pid) is required for inventory inquiry.', 400);
    }

    const qs = new URLSearchParams({ pid: cleanPid });
    const data = await this.callAuthenticatedCj<any>(`${CJ_STOCK_BY_PID_URL}?${qs.toString()}`, {
      method: 'GET',
    });

    const inventories = this.normalizeWarehouseInventories(
      Array.isArray(data?.inventories) ? data.inventories : Array.isArray(data) ? data : []
    );

    const variantInventories = new Map<string, CjWarehouseInventoryItem[]>();
    if (Array.isArray(data?.variantInventories)) {
      for (const v of data.variantInventories) {
        if (v?.vid) {
          variantInventories.set(String(v.vid), this.normalizeWarehouseInventories(v.inventories || v.inventory || []));
        }
      }
    }

    const totalInventory = inventories.reduce((sum, w) => sum + w.totalInventory, 0);
    return {
      pid: cleanPid,
      totalInventory,
      inventories,
      variantInventories,
    };
  }

  /**
   * Queries live stock breakdown for a specific CJ variant by VID via GET /product/stock/queryByVid.
   */
  public async getVariantInventoryByVid(vid: string): Promise<{
    vid: string;
    totalInventory: number;
    inventories: CjWarehouseInventoryItem[];
  }> {
    const cleanVid = vid.trim();
    if (!cleanVid) {
      throw new CjApiRequestError('CJ Variant ID (vid) is required for stock inquiry.', 400);
    }

    const qs = new URLSearchParams({ vid: cleanVid });
    const data = await this.callAuthenticatedCj<any>(`${CJ_STOCK_BY_VID_URL}?${qs.toString()}`, {
      method: 'GET',
    });

    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.inventories)
      ? data.inventories
      : [];
    const inventories = this.normalizeWarehouseInventories(rawList);
    const totalInventory = inventories.reduce((sum, w) => sum + w.totalInventory, 0);

    return {
      vid: cleanVid,
      totalInventory,
      inventories,
    };
  }

  /**
   * Fetches full CJ product details, specifications, images, variants, and real stock via
   * GET /product/query (+ /product/variant/query and /product/stock/getInventoryByPid as needed).
   */
  public async getProductDetail(
    pid: string,
    options: { countryCode?: string; includeInventory?: boolean } = {}
  ): Promise<CjProductDetail> {
    const cleanPid = pid.trim();
    if (!cleanPid) {
      throw new CjApiRequestError('CJ Product ID (pid) is required.', 400);
    }

    const qs = new URLSearchParams({ pid: cleanPid });
    qs.append('features', 'enable_inventory');
    if (options.countryCode?.trim()) {
      qs.set('countryCode', options.countryCode.trim().toUpperCase());
    }

    const data = await this.callAuthenticatedCj<any>(`${CJ_PRODUCT_QUERY_URL}?${qs.toString()}`, {
      method: 'GET',
    });

    if (!data || typeof data !== 'object' || (!data.pid && !data.id && !data.productNameEn)) {
      throw new CjApiRequestError(`CJ product "${cleanPid}" was not found.`, 404);
    }

    const resolvedPid = String(data.pid || data.id || cleanPid);
    let rawVariants: any[] = Array.isArray(data.variants) ? data.variants : [];
    if (rawVariants.length === 0) {
      try {
        const vQs = new URLSearchParams({ pid: resolvedPid });
        if (options.countryCode?.trim()) vQs.set('countryCode', options.countryCode.trim().toUpperCase());
        const vData = await this.callAuthenticatedCj<any>(`${CJ_VARIANT_QUERY_URL}?${vQs.toString()}`, {
          method: 'GET',
        });
        if (Array.isArray(vData)) {
          rawVariants = vData;
        } else if (Array.isArray(vData?.variants)) {
          rawVariants = vData.variants;
        }
      } catch {
        // Keep whatever variants product/query returned
      }
    }

    // Parse embedded variantInventory if CJ returned it via features=enable_inventory
    const variantInvMap = new Map<string, CjWarehouseInventoryItem[]>();
    if (Array.isArray(data.variantInventory)) {
      for (const entry of data.variantInventory) {
        if (entry?.vid) {
          variantInvMap.set(
            String(entry.vid),
            this.normalizeWarehouseInventories(entry.inventory || entry.inventories || [])
          );
        }
      }
    }

    let productWarehouseStock = this.normalizeWarehouseInventories(data.inventories || data.inventory || []);
    let inventorySynced = productWarehouseStock.length > 0 || variantInvMap.size > 0;
    let inventoryNote: string | undefined;

    if (options.includeInventory !== false && !inventorySynced) {
      try {
        const stockRes = await this.getInventoryByPid(resolvedPid);
        if (stockRes.inventories.length > 0) {
          productWarehouseStock = stockRes.inventories;
        }
        for (const [vid, inv] of stockRes.variantInventories.entries()) {
          if (!variantInvMap.has(vid)) {
            variantInvMap.set(vid, inv);
          }
        }
        inventorySynced = true;
      } catch (err: any) {
        inventoryNote = sanitizeCjErrorMessage(err?.message, this.collectKnownSecrets());
      }
    }

    const mainImage = this.normalizeImageUrl(data.productImage || data.bigImage);
    const gallerySet = new Set<string>();
    if (mainImage) gallerySet.add(mainImage);
    for (const img of this.normalizeImageList(data.productImageSet)) {
      gallerySet.add(img);
    }

    const variants: CjProductVariantDetail[] = rawVariants.map((v) => {
      const vid = String(v.vid || v.id || '');
      const variantImage = this.normalizeImageUrl(v.variantImage);
      if (variantImage) gallerySet.add(variantImage);

      const attrs = parseVariantAttributes(v.variantKey, v.variantNameEn, v.variantStandard);
      const sellRaw = v.variantSellPrice ?? v.variantSugSellPrice ?? v.sellPrice ?? null;
      const supplierPriceCents = parseUsdPriceToCents(sellRaw);
      const wStock = variantInvMap.get(vid) || this.normalizeWarehouseInventories(v.inventories || v.inventory || []);

      let stockQuantity: number | null = null;
      if (wStock.length > 0) {
        stockQuantity = wStock.reduce((sum, w) => sum + w.totalInventory, 0);
      } else if (typeof v.inventoryNum === 'number' && Number.isFinite(v.inventoryNum)) {
        stockQuantity = Math.max(0, Math.round(v.inventoryNum));
      } else if (typeof v.totalInventory === 'number' && Number.isFinite(v.totalInventory)) {
        stockQuantity = Math.max(0, Math.round(v.totalInventory));
      }

      const rawWeight = Number(v.variantWeight ?? v.weight);

      return {
        vid,
        pid: resolvedPid,
        variantNameEn: String(v.variantNameEn || v.variantKey || data.productNameEn || '').trim(),
        variantSku: String(v.variantSku || ''),
        variantKey: String(v.variantKey || attrs.label),
        label: attrs.label,
        color: attrs.color,
        size: attrs.size,
        variantImage,
        supplierPriceCents,
        variantSellPriceRaw: sellRaw !== null && sellRaw !== undefined ? String(sellRaw) : null,
        variantStandard: v.variantStandard ? String(v.variantStandard) : null,
        weightGrams: Number.isFinite(rawWeight) && rawWeight > 0 ? Math.round(rawWeight) : null,
        stockQuantity,
        warehouseStock: wStock,
      };
    });

    const sellPriceRaw = data.sellPrice !== null && data.sellPrice !== undefined ? String(data.sellPrice) : null;
    const priceRange = parseUsdPriceRangeCents(sellPriceRaw);
    const variantCosts = variants
      .map((v) => v.supplierPriceCents)
      .filter((c): c is number => typeof c === 'number' && c >= 0);

    const minSupplierCents =
      variantCosts.length > 0 ? Math.min(...variantCosts) : priceRange.minCents;
    const maxSupplierCents =
      variantCosts.length > 0 ? Math.max(...variantCosts) : priceRange.maxCents;

    let totalInventory: number | null = null;
    if (productWarehouseStock.length > 0) {
      totalInventory = productWarehouseStock.reduce((sum, w) => sum + w.totalInventory, 0);
    } else {
      const vStocks = variants
        .map((v) => v.stockQuantity)
        .filter((s): s is number => typeof s === 'number' && s >= 0);
      if (vStocks.length > 0) {
        totalInventory = vStocks.reduce((sum, s) => sum + s, 0);
      } else if (typeof data.warehouseInventoryNum === 'number') {
        totalInventory = Math.max(0, Math.round(data.warehouseInventoryNum));
      }
    }

    const specs: Array<{ label: string; value: string }> = [];
    const addSpec = (label: string, val: unknown) => {
      if (val === null || val === undefined) return;
      const text = Array.isArray(val) ? val.join(', ') : String(val).trim();
      if (text) specs.push({ label, value: text });
    };

    addSpec('CJ Product ID', resolvedPid);
    addSpec('CJ Product SKU', data.productSku);
    addSpec('Category', data.categoryName);
    addSpec('Product Weight', data.productWeight ? `${data.productWeight}g` : null);
    addSpec('Material', data.materialNameEn || data.materialName);
    addSpec('Packing', data.packingNameEn || data.packingName);
    addSpec('Product Type', data.productType);
    addSpec('Attributes', data.productProEn);
    addSpec('HS / Entry Code', data.entryCode);
    addSpec('Unit', data.productUnit);

    const descriptionHtml = String(data.description || '');
    const description = stripHtmlDescription(descriptionHtml) || String(data.productNameEn || '');

    const rawWeight = Number(data.productWeight);

    return {
      pid: resolvedPid,
      productNameEn: String(data.productNameEn || data.nameEn || 'Untitled CJ Product').trim(),
      productSku: String(data.productSku || data.sku || ''),
      spu: String(data.spu || data.productSku || ''),
      categoryId: data.categoryId ? String(data.categoryId) : null,
      categoryName: data.categoryName ? String(data.categoryName) : null,
      description,
      descriptionHtml,
      productImage: mainImage || Array.from(gallerySet)[0] || null,
      productImageSet: Array.from(gallerySet),
      sellPriceRaw,
      supplierPriceCents: minSupplierCents,
      supplierPriceMaxCents: maxSupplierCents,
      productWeightGrams: Number.isFinite(rawWeight) && rawWeight > 0 ? Math.round(rawWeight) : null,
      materialNameEn: data.materialNameEn ? String(data.materialNameEn) : null,
      packingNameEn: data.packingNameEn ? String(data.packingNameEn) : null,
      entryCode: data.entryCode ? String(data.entryCode) : null,
      specs,
      variants,
      warehouseStock: productWarehouseStock,
      totalInventory,
      inventorySynced,
      inventoryNote,
      retrievedAt: new Date(this.nowFn()).toISOString(),
    };
  }

  /**
   * Calculates real shipping options & costs via POST /logistic/freightCalculate.
   * Never invents shipping prices or delivery estimates.
   */
  public async calculateFreight(params: {
    startCountryCode?: string;
    endCountryCode: string;
    products: Array<{ vid: string; quantity: number }>;
    zip?: string;
  }): Promise<{
    startCountryCode: string;
    endCountryCode: string;
    options: CjFreightOption[];
  }> {
    const startCountryCode = (params.startCountryCode || 'CN').trim().toUpperCase();
    const endCountryCode = (params.endCountryCode || '').trim().toUpperCase();
    if (!endCountryCode || endCountryCode.length !== 2) {
      throw new CjApiRequestError('A valid 2-letter destination countryCode (e.g. NG, US, GB) is required.', 400);
    }

    const cleanProducts = (params.products || [])
      .filter((p) => p && typeof p.vid === 'string' && p.vid.trim().length > 0)
      .map((p) => ({
        vid: p.vid.trim(),
        quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
      }));

    if (cleanProducts.length === 0) {
      throw new CjApiRequestError('At least one valid CJ Variant ID (vid) is required for freight calculation.', 400);
    }

    const requestBody: Record<string, any> = {
      startCountryCode,
      endCountryCode,
      products: cleanProducts,
    };
    if (params.zip?.trim()) {
      requestBody.zip = params.zip.trim();
    }

    const data = await this.callAuthenticatedCj<any>(CJ_FREIGHT_CALCULATE_URL, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const rawOptions = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
    const options: CjFreightOption[] = rawOptions
      .filter((opt: any) => opt && typeof opt === 'object' && opt.logisticName)
      .map((opt: any) => {
        const logisticPriceCents = parseUsdPriceToCents(opt.logisticPrice) ?? 0;
        const taxesFeeCents = parseUsdPriceToCents(opt.taxesFee) ?? 0;
        const clearanceOperationFeeCents = parseUsdPriceToCents(opt.clearanceOperationFee) ?? 0;
        const totalPostageFeeCents =
          parseUsdPriceToCents(opt.totalPostageFee) ??
          logisticPriceCents + taxesFeeCents + clearanceOperationFeeCents;

        return {
          logisticName: String(opt.logisticName),
          logisticAging: String(opt.logisticAging || 'Check CJ carrier schedule'),
          logisticPriceCents,
          taxesFeeCents,
          clearanceOperationFeeCents,
          totalPostageFeeCents,
          channelType: opt.channelType ? String(opt.channelType) : null,
        };
      })
      .sort((a: CjFreightOption, b: CjFreightOption) => a.totalPostageFeeCents - b.totalPostageFeeCents);

    return {
      startCountryCode,
      endCountryCode,
      options,
    };
  }
}

export const cjService = new CjDropshippingService();
