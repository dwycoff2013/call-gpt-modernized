import net from 'node:net';
import type { ISessionStore, SessionState } from '../types/index';

const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

function encodeCommand(args: string[]): string {
  const chunks = [`*${args.length}\r\n`];
  args.forEach((arg) => {
    const value = String(arg);
    chunks.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
  });
  return chunks.join('');
}

interface ParsedRedisUrl {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
}

export function parseRedisUrl(redisUrlRaw: string): ParsedRedisUrl {
  const redisUrl = new URL(redisUrlRaw);
  const username = redisUrl.username ? decodeURIComponent(redisUrl.username) : null;
  const password = redisUrl.password ? decodeURIComponent(redisUrl.password) : null;

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username,
    password,
  };
}

export function getAuthArgs(username: string | null, password: string | null): string[] | null {
  if (!password) {
    return null;
  }

  if (username) {
    return ['AUTH', username, password];
  }

  return ['AUTH', password];
}

export class RedisSessionStore implements ISessionStore {
  public enabled: boolean;
  private socketOptions: net.NetConnectOpts | null = null;
  private authArgs: string[] | null = null;

  constructor() {
    this.enabled = Boolean(process.env.REDIS_URL);

    if (this.enabled && process.env.REDIS_URL) {
      const parsedRedis = parseRedisUrl(process.env.REDIS_URL);
      this.socketOptions = {
        host: parsedRedis.host,
        port: parsedRedis.port,
      };
      this.authArgs = getAuthArgs(parsedRedis.username, parsedRedis.password);
    }
  }

  async setSessionValue(sessionId: string | null, data: SessionState, ttlSeconds = 3600): Promise<void> {
    if (!this.enabled || !sessionId || !this.socketOptions) {
      return;
    }

    const commands: string[] = [];

    if (this.authArgs) {
      commands.push(encodeCommand(this.authArgs));
    }

    commands.push(encodeCommand([
      'SET',
      `session:${sessionId}`,
      JSON.stringify(data),
      'EX',
      String(ttlSeconds),
    ]));

    await this.send(commands.join(''));
  }

  private async send(payload: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let responseBuffer = '';

      const finish = (handler: (value: string) => void, value: string | Error) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.end();
        if (value instanceof Error) {
          reject(value);
        } else {
          handler(value);
        }
      };

      const socket = net.createConnection(this.socketOptions!, () => {
        socket.setTimeout(DEFAULT_CONNECT_TIMEOUT_MS);
        socket.write(payload);
      });

      socket.on('data', (buffer) => {
        responseBuffer += buffer.toString();

        if (responseBuffer.startsWith('-')) {
          finish(reject, new Error(`Redis error response: ${responseBuffer.trim()}`));
          return;
        }

        const lines = responseBuffer.split('\r\n').filter(Boolean);
        const hasErrorReply = lines.some((line) => line.startsWith('-'));
        if (hasErrorReply) {
          const errorLine = lines.find((line) => line.startsWith('-'));
          finish(reject, new Error(`Redis error response: ${errorLine}`));
          return;
        }

        const expectedReplies = this.authArgs ? 2 : 1;
        const completeReplies = lines.filter((line) => line.startsWith('+') || line.startsWith('-')).length;

        if (completeReplies >= expectedReplies) {
          finish(resolve, responseBuffer);
        }
      });

      socket.on('timeout', () => {
        finish(reject, new Error(`Redis connection timeout after ${DEFAULT_CONNECT_TIMEOUT_MS}ms`));
      });

      socket.on('error', (error) => {
        finish(reject, error);
      });

      socket.on('close', () => {
        if (!settled) {
          finish(reject, new Error('Redis connection closed before response was received'));
        }
      });
    });
  }
}

export default RedisSessionStore;
