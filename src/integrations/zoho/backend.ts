export type ZohoBackend = 'direct' | 'mcp';

const DEFAULT_BACKEND: ZohoBackend = 'direct';

export function normalizeZohoBackend(value: string | undefined): ZohoBackend {
  if (!value) {
    return DEFAULT_BACKEND;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'mcp' ? 'mcp' : 'direct';
}

export function getZohoBackend(): ZohoBackend {
  return normalizeZohoBackend(process.env.ZOHO_BACKEND);
}

export function isZohoMcpBackend(): boolean {
  return getZohoBackend() === 'mcp';
}
