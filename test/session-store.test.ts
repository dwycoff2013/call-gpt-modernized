import { createSessionStore } from '../src/state/createSessionStore.js';
import { RedisSessionStore } from '../src/state/RedisSessionStore.js';
import { FirestoreSessionStore } from '../src/state/FirestoreSessionStore.js';
import { MemorySessionStore } from '../src/state/MemorySessionStore.js';
import { resolveSessionBackend } from '../src/state/resolveSessionBackend.js';

describe('session backend resolution', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };
    delete process.env.SESSION_STORE_BACKEND;
    delete process.env.REDIS_URL;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_ACCESS_TOKEN;
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('uses explicit backend when valid', () => {
    process.env.SESSION_STORE_BACKEND = 'memory';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.GOOGLE_CLOUD_PROJECT = 'project-a';

    expect(resolveSessionBackend()).toBe('memory');
  });

  it('falls back to redis when backend is unset and REDIS_URL is present', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    expect(resolveSessionBackend()).toBe('redis');
  });

  it('falls back to firestore when backend is unset and only GOOGLE_CLOUD_PROJECT is present', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'project-a';

    expect(resolveSessionBackend()).toBe('firestore');
  });

  it('falls back to memory when no backend hints are configured', () => {
    expect(resolveSessionBackend()).toBe('memory');
  });
});

describe('createSessionStore', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };
    delete process.env.SESSION_STORE_BACKEND;
    delete process.env.REDIS_URL;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_ACCESS_TOKEN;
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('returns redis store for redis backend', () => {
    process.env.SESSION_STORE_BACKEND = 'redis';
    const store = createSessionStore();
    expect(store).toBeInstanceOf(RedisSessionStore);
  });

  it('returns firestore store for explicit firestore backend', () => {
    process.env.SESSION_STORE_BACKEND = 'firestore';
    const store = createSessionStore();
    expect(store).toBeInstanceOf(FirestoreSessionStore);
  });

  it('defaults to redis backend when REDIS_URL is present', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const store = createSessionStore();
    expect(store).toBeInstanceOf(RedisSessionStore);
  });

  it('defaults to firestore backend when only GOOGLE_CLOUD_PROJECT is present', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'project-a';
    const store = createSessionStore();
    expect(store).toBeInstanceOf(FirestoreSessionStore);
  });

  it('defaults to memory backend with no env configured', () => {
    const store = createSessionStore();
    expect(store).toBeInstanceOf(MemorySessionStore);
  });
});

describe('MemorySessionStore', () => {
  const sessionState = {
    callSid: 'CA123',
    streamSid: 'MZ123',
    status: 'active' as const,
    interactionCount: 2,
    updatedAt: new Date().toISOString(),
  };

  it('supports read/write/delete behavior through optional methods', async () => {
    const store = new MemorySessionStore();

    await store.setSessionValue('session-1', sessionState);

    await expect(store.getSessionValue?.('session-1')).resolves.toEqual(sessionState);
    await expect(store.listSessionIds?.()).resolves.toEqual(['session-1']);

    await store.deleteSessionValue?.('session-1');

    await expect(store.getSessionValue?.('session-1')).resolves.toBeNull();
    await expect(store.listSessionIds?.()).resolves.toEqual([]);
  });

  it('returns null or no-op for null session ids', async () => {
    const store = new MemorySessionStore();

    await expect(store.getSessionValue?.(null)).resolves.toBeNull();
    await expect(store.deleteSessionValue?.(null)).resolves.toBeUndefined();
  });
});
