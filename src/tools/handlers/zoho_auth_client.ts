import axios from 'axios';

const ZOHO_ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const ZOHO_TOKEN_URL = `${ZOHO_ACCOUNTS_URL.replace(/\/$/, '')}/oauth/v2/token`; 
const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `[Zoho Auth] Missing required environment variable ${name}. ` +
      `Set ${name} in your environment or .env file before starting the service.`
    );
  }
  return value.trim();
}

export function validateZohoEnv(): void {
  const requiredVariables = [
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_REFRESH_TOKEN',
  ];

  const missing = requiredVariables.filter((name) => {
    const value = process.env[name];
    return !value || !value.trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `[Zoho Auth] Missing required Zoho credentials: ${missing.join(', ')}. ` +
      'Update your .env with valid Zoho OAuth values. ' +
      'Expected keys: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN.'
    );
  }
}

export class ZohoAuthClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string | null = null;
  private expiresAt: number = 0;
  private refreshInFlight: Promise<string> | null = null;

  constructor() {
    validateZohoEnv();
    this.clientId = getRequiredEnv('ZOHO_CLIENT_ID');
    this.clientSecret = getRequiredEnv('ZOHO_CLIENT_SECRET');
    this.refreshToken = getRequiredEnv('ZOHO_REFRESH_TOKEN');
  }

  private isAccessTokenValid(): boolean {
    if (!this.accessToken || !this.expiresAt) {
      return false;
    }
    return Date.now() + ACCESS_TOKEN_EXPIRY_BUFFER_MS < this.expiresAt;
  }

  async getAccessToken(): Promise<string> {
    if (this.isAccessTokenValid()) {
      return this.accessToken!;
    }
    return this.refreshAccessToken();
  }

  async refreshAccessToken(force = false): Promise<string> {
    if (!force && this.isAccessTokenValid()) {
      return this.accessToken!;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.requestNewAccessToken()
      .then((token) => {
        this.refreshInFlight = null;
        return token;
      })
      .catch((error) => {
        this.refreshInFlight = null;
        throw error;
      });

    return this.refreshInFlight;
  }

  private async requestNewAccessToken(): Promise<string> {
    try {
      const response = await axios.post(ZOHO_TOKEN_URL, null, {
        params: {
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        },
      });

      const { access_token, expires_in } = response.data || {};

      if (!access_token) {
        throw new Error('Zoho token response did not include access_token.');
      }

      const expiresInSeconds = Number(expires_in);
      const ttlMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? expiresInSeconds * 1000
        : 55 * 60 * 1000;

      this.accessToken = access_token;
      this.expiresAt = Date.now() + ttlMs;

      return this.accessToken!;
    } catch (error) {
      const axiosError = error as { response?: { data: unknown }; message: string };
      const detail = axiosError.response ? JSON.stringify(axiosError.response.data) : axiosError.message;
      throw new Error(
        `[Zoho Auth] Failed to refresh access token. ` +
        `Verify ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET/ZOHO_REFRESH_TOKEN. Details: ${detail}`
      );
    }
  }

  async executeWithAuthRetry<T>(requestFn: (token: string) => Promise<T>): Promise<T> {
    const token = await this.getAccessToken();

    try {
      return await requestFn(token);
    } catch (error) {
      const axiosError = error as { response?: { status: number } };
      if (!axiosError.response || axiosError.response.status !== 401) {
        throw error;
      }

      const refreshedToken = await this.refreshAccessToken(true);
      return requestFn(refreshedToken);
    }
  }
}

export const zohoAuthClient = new ZohoAuthClient();
