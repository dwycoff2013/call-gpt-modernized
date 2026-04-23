import type { ISessionStore, SessionState } from '../types/index';

interface FirestoreWrite {
  fields: Record<string, { stringValue?: string; integerValue?: string; nullValue?: null }>;
}

export class FirestoreSessionStore implements ISessionStore {
  public enabled: boolean;
  private projectId: string;
  private collection: string;
  private databaseId: string;
  private accessToken: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
    this.collection = process.env.FIRESTORE_COLLECTION || 'call_sessions';
    this.databaseId = process.env.FIRESTORE_DATABASE || '(default)';
    this.accessToken = process.env.GCP_ACCESS_TOKEN || '';
    this.enabled = Boolean(this.projectId && this.accessToken);
  }

  private getDocumentUrl(sessionId: string): string {
    const encodedDatabaseId = encodeURIComponent(this.databaseId);
    const encodedCollection = encodeURIComponent(this.collection);
    const encodedSessionId = encodeURIComponent(sessionId);

    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${encodedDatabaseId}/documents/${encodedCollection}/${encodedSessionId}`;
  }

  private mapSessionToFirestore(data: SessionState): FirestoreWrite {
    return {
      fields: {
        callSid: data.callSid ? { stringValue: data.callSid } : { nullValue: null },
        streamSid: data.streamSid ? { stringValue: data.streamSid } : { nullValue: null },
        status: { stringValue: data.status },
        interactionCount: { integerValue: String(data.interactionCount) },
        updatedAt: { stringValue: data.updatedAt },
      },
    };
  }

  async setSessionValue(sessionId: string | null, data: SessionState): Promise<void> {
    if (!this.enabled || !sessionId) {
      return;
    }

    const response = await fetch(this.getDocumentUrl(sessionId), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.mapSessionToFirestore(data)),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`FirestoreSessionStore write failed (${response.status}): ${detail}`);
    }
  }
}

export default FirestoreSessionStore;
