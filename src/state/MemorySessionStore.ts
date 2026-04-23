import type { ISessionStore, SessionState } from '../types/index';

export class MemorySessionStore implements ISessionStore {
  public enabled = true;
  private sessions = new Map<string, SessionState>();

  async setSessionValue(sessionId: string | null, data: SessionState): Promise<void> {
    if (!sessionId) {
      return;
    }
    this.sessions.set(sessionId, data);
  }

  async getSessionValue(sessionId: string | null): Promise<SessionState | null> {
    if (!sessionId) {
      return null;
    }

    return this.sessions.get(sessionId) ?? null;
  }

  async deleteSessionValue(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }

    this.sessions.delete(sessionId);
  }

  async listSessionIds(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }
}

export default MemorySessionStore;
