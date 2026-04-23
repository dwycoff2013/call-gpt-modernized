import { getZohoBackend, normalizeZohoBackend } from '../src/integrations/zoho/backend.js';

describe('Zoho backend selection', () => {
  const originalBackend = process.env.ZOHO_BACKEND;

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.ZOHO_BACKEND;
      return;
    }
    process.env.ZOHO_BACKEND = originalBackend;
  });

  it('defaults to direct when unset', () => {
    delete process.env.ZOHO_BACKEND;
    expect(getZohoBackend()).toBe('direct');
  });

  it('accepts mcp explicitly', () => {
    process.env.ZOHO_BACKEND = 'mcp';
    expect(getZohoBackend()).toBe('mcp');
  });

  it('normalizes invalid values to direct', () => {
    expect(normalizeZohoBackend('custom')).toBe('direct');
  });
});
