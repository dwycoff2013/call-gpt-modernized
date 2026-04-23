export type SessionStoreBackend = 'redis' | 'firestore' | 'memory';

function isBackend(value: string): value is SessionStoreBackend {
  return value === 'redis' || value === 'firestore' || value === 'memory';
}

export function resolveSessionBackend(env: NodeJS.ProcessEnv = process.env): SessionStoreBackend {
  const explicitBackend = (env.SESSION_STORE_BACKEND || '').trim().toLowerCase();

  if (isBackend(explicitBackend)) {
    return explicitBackend;
  }

  if (env.REDIS_URL) {
    return 'redis';
  }

  if (env.GOOGLE_CLOUD_PROJECT) {
    return 'firestore';
  }

  return 'memory';
}
