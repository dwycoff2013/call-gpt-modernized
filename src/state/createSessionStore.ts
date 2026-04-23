import type { ISessionStore } from '../types/index';
import { RedisSessionStore } from './RedisSessionStore';
import { FirestoreSessionStore } from './FirestoreSessionStore';
import { MemorySessionStore } from './MemorySessionStore';
import { resolveSessionBackend } from './resolveSessionBackend';

export function createSessionStore(): ISessionStore {
  const backend = resolveSessionBackend();

  if (backend === 'redis') {
    return new RedisSessionStore();
  }

  if (backend === 'firestore') {
    return new FirestoreSessionStore();
  }

  return new MemorySessionStore();
}
