import { EventEmitter } from 'node:events';

class FakeStream extends EventEmitter {
  setEncoding(): void {}
}

type FakeChild = EventEmitter & {
  stdout: FakeStream;
  stderr: FakeStream;
  stdin: {
    write: (chunk: string, cb?: (error?: Error | null) => void) => boolean;
  };
};

function createFakeChild(onWrite: (chunk: string, child: FakeChild) => void): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new FakeStream();
  child.stderr = new FakeStream();
  child.stdin = {
    write: (chunk: string, cb?: (error?: Error | null) => void) => {
      onWrite(chunk, child);
      if (cb) {
        cb(null);
      }
      return true;
    },
  };
  return child;
}

describe('Zoho MCP protocol lifecycle', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('sends notifications/initialized before tools/call', async () => {
    const writes: string[] = [];

    jest.doMock('node:child_process', () => ({
      spawn: jest.fn(() => createFakeChild((chunk, child) => {
        writes.push(chunk.trim());
        const payload = JSON.parse(chunk) as { method?: string; id?: number };

        if (payload.method === 'initialize' && payload.id) {
          setImmediate(() => {
            child.stdout.emit('data', `${JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: { ok: true } })}\n`);
          });
        }

        if (payload.method === 'tools/call' && payload.id) {
          setImmediate(() => {
            child.stdout.emit('data', `${JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: { content: [{ type: 'text', text: '{"id":"x"}' }] } })}\n`);
          });
        }
      })),
    }));

    const module = await import('../src/integrations/zoho/mcpClient.js');
    await module.callZohoMcpTool('createLead', { leadDetails: { first_name: 'A' } });

    const methods = writes.map((line) => JSON.parse(line).method);
    expect(methods.slice(0, 3)).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
  });

  it('rejects gracefully when spawn emits error', async () => {
    jest.doMock('node:child_process', () => ({
      spawn: jest.fn(() => {
        const child = createFakeChild(() => {
          // no-op
        });

        setImmediate(() => {
          child.emit('error', new Error('ENOENT'));
        });

        return child;
      }),
    }));

    const module = await import('../src/integrations/zoho/mcpClient.js');

    await expect(module.callZohoMcpTool('createLead', { leadDetails: {} })).rejects.toThrow('Unable to start MCP server process');
  });
});
