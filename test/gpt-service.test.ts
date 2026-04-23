process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || 'test-client';
process.env.ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || 'test-secret';
process.env.ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || 'test-refresh';
import { GptService } from '../src/services/gpt-service.js';

function asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

describe('GptService.validateFunctionArgs', () => {
  it('parses valid JSON', () => {
    const service = new GptService();
    expect(service.validateFunctionArgs('{"foo":"bar"}')).toEqual({ foo: 'bar' });
  });

  it('recovers first JSON object from concatenated payload', () => {
    const service = new GptService();
    const payload = '{"first":1}{"second":2}';
    expect(service.validateFunctionArgs(payload)).toEqual({ first: 1 });
  });

  it('returns empty object for malformed payload', () => {
    const service = new GptService();
    expect(service.validateFunctionArgs('not-json')).toEqual({});
  });
});

describe('GptService tool context handling', () => {
  it('adds function context once when tool is called', async () => {
    const service = new GptService();

    const createMock = jest.fn()
      .mockResolvedValueOnce(asAsyncIterable([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    function: {
                      name: 'listAppointmentTypes',
                      arguments: '{}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ]))
      .mockResolvedValueOnce(asAsyncIterable([
        {
          choices: [
            {
              delta: { content: 'Done.' },
              finish_reason: 'stop',
            },
          ],
        },
      ]));

    (service.openai.chat.completions as unknown as { create: jest.Mock }).create = createMock;

    await service.completion('Schedule me', 0);

    const functionMessages = service.userContext.filter((item) => item.role === 'function' && item.name === 'listAppointmentTypes');
    expect(functionMessages).toHaveLength(1);
  });
});
