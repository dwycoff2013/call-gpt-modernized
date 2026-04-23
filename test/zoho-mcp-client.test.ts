import { normalizeMcpToolResult } from '../src/integrations/zoho/mcpClient.js';

jest.mock('../src/tools/handlers/zoho_auth.js', () => ({
  executeWithAuthRetry: jest.fn(),
}));

jest.mock('../src/integrations/zoho/mcpClient.js', () => {
  const actual = jest.requireActual('../src/integrations/zoho/mcpClient.js');
  return {
    ...actual,
    callZohoMcpTool: jest.fn(),
  };
});

describe('Zoho MCP helpers', () => {
  it('parses MCP text content payloads', () => {
    const parsed = normalizeMcpToolResult<{ id: string }>({
      content: [
        {
          type: 'text',
          text: '{"id":"lead_123"}',
        },
      ],
    });

    expect(parsed).toEqual({ id: 'lead_123' });
  });
});

describe('ZdkZohoClient MCP mode return shape parity', () => {
  const originalBackend = process.env.ZOHO_BACKEND;

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.ZOHO_BACKEND;
    } else {
      process.env.ZOHO_BACKEND = originalBackend;
    }
    jest.resetModules();
  });

  it('returns same public shapes as direct adapter contract', async () => {
    process.env.ZOHO_BACKEND = 'mcp';

    const mcpModule = await import('../src/integrations/zoho/mcpClient.js');
    const mockCall = jest.mocked(mcpModule.callZohoMcpTool);

    mockCall.mockImplementation(async (name) => {
      if (name === 'createLead') {
        return { content: [{ type: 'text', text: '{"id":"lead_1"}' }] };
      }
      if (name === 'createEvent') {
        return { content: [{ type: 'text', text: '{"id":"event_1"}' }] };
      }
      if (name === 'findLeadByEmail') {
        return { content: [{ type: 'text', text: '{"lead":{"id":"lead_1","Email":"a@b.com"}}' }] };
      }
      return { content: [{ type: 'text', text: '{"events":[{"id":"event_1"}]}' }] };
    });

    const { ZdkZohoClient } = await import('../src/integrations/zoho/zdkClient.js');
    const client = new ZdkZohoClient();

    await expect(client.createLead({ first_name: 'A', last_name: 'B', email: 'a@b.com', phone: '555' })).resolves.toBe('lead_1');
    await expect(client.createEvent({ event_title: 'Consult', start_datetime: '2026-01-01T10:00:00Z', end_datetime: '2026-01-01T10:30:00Z' })).resolves.toBe('event_1');
    await expect(client.findLeadByEmail('a@b.com')).resolves.toEqual({ id: 'lead_1', Email: 'a@b.com' });
    await expect(client.getEventsByTimeRange('2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z')).resolves.toEqual([{ id: 'event_1' }]);
  });
});
