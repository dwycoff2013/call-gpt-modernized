import { getEnv, getEnvOptional, getEnvNumber, getEnvBoolean } from '../src/config/env.js';

describe('Environment Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getEnv', () => {
    it('should return value when variable exists', () => {
      process.env.TEST_VAR = 'test_value';
      expect(getEnv('TEST_VAR')).toBe('test_value');
    });

    it('should return default when variable does not exist', () => {
      delete process.env.TEST_VAR;
      expect(getEnv('TEST_VAR', 'default')).toBe('default');
    });

    it('should throw when variable does not exist and no default', () => {
      delete process.env.TEST_VAR;
      expect(() => getEnv('TEST_VAR')).toThrow('Missing required environment variable');
    });
  });

  describe('getEnvOptional', () => {
    it('should return value when variable exists', () => {
      process.env.TEST_VAR = 'test_value';
      expect(getEnvOptional('TEST_VAR')).toBe('test_value');
    });

    it('should return undefined when variable does not exist', () => {
      delete process.env.TEST_VAR;
      expect(getEnvOptional('TEST_VAR')).toBeUndefined();
    });
  });

  describe('getEnvNumber', () => {
    it('should return number when variable is valid', () => {
      process.env.TEST_NUM = '42';
      expect(getEnvNumber('TEST_NUM')).toBe(42);
    });

    it('should return default when variable does not exist', () => {
      delete process.env.TEST_NUM;
      expect(getEnvNumber('TEST_NUM', 100)).toBe(100);
    });

    it('should throw when variable is not a valid number', () => {
      process.env.TEST_NUM = 'not_a_number';
      expect(() => getEnvNumber('TEST_NUM')).toThrow('must be a valid number');
    });
  });

  describe('getEnvBoolean', () => {
    it('should return true when variable is "true"', () => {
      process.env.TEST_BOOL = 'true';
      expect(getEnvBoolean('TEST_BOOL')).toBe(true);
    });

    it('should return false when variable is "false"', () => {
      process.env.TEST_BOOL = 'false';
      expect(getEnvBoolean('TEST_BOOL')).toBe(false);
    });

    it('should return default when variable does not exist', () => {
      delete process.env.TEST_BOOL;
      expect(getEnvBoolean('TEST_BOOL', true)).toBe(true);
    });
  });
});


describe('session backend config resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SESSION_STORE_BACKEND;
    delete process.env.REDIS_URL;
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadConfigBackend(): Promise<string> {
    const mod = await import('../src/config/index.js');
    return mod.config.session.backend;
  }

  it('matches resolver precedence: explicit backend > redis > firestore > memory', async () => {
    process.env.SESSION_STORE_BACKEND = 'memory';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.GOOGLE_CLOUD_PROJECT = 'project-a';
    await expect(loadConfigBackend()).resolves.toBe('memory');

    jest.resetModules();
    delete process.env.SESSION_STORE_BACKEND;
    await expect(loadConfigBackend()).resolves.toBe('redis');

    jest.resetModules();
    delete process.env.REDIS_URL;
    await expect(loadConfigBackend()).resolves.toBe('firestore');

    jest.resetModules();
    delete process.env.GOOGLE_CLOUD_PROJECT;
    await expect(loadConfigBackend()).resolves.toBe('memory');
  });
});
