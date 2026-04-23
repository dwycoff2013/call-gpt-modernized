import { zohoAuthClient, validateZohoEnv } from './zoho_auth_client';

export function getAccessToken(): Promise<string> {
  return zohoAuthClient.getAccessToken();
}

export function executeWithAuthRetry<T>(requestFn: (token: string) => Promise<T>): Promise<T> {
  return zohoAuthClient.executeWithAuthRetry(requestFn);
}

export { validateZohoEnv };
