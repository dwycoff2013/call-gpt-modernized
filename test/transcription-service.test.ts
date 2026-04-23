import { EventEmitter } from 'events';
import { LiveTranscriptionEvents } from '@deepgram/sdk';
import { TranscriptionService } from '../src/services/transcription-service.js';

class MockConnection extends EventEmitter {
  getReadyState(): number {
    return 1;
  }

  send(): void {
    // no-op
  }
}

describe('TranscriptionService utterance handling', () => {
  it('does not leak previous utterance text into the next one', () => {
    const connection = new MockConnection();

    const service = new TranscriptionService({
      deepgramFactory: (() => ({
        listen: {
          live: () => connection,
        },
      })) as never,
    });

    const outputs: string[] = [];
    service.on('transcription', (text) => outputs.push(text.trim()));

    connection.emit(LiveTranscriptionEvents.Open);
    connection.emit(LiveTranscriptionEvents.Transcript, {
      type: 'Results',
      channel: { alternatives: [{ transcript: 'hello there' }] },
      is_final: true,
      speech_final: false,
    });
    connection.emit(LiveTranscriptionEvents.Transcript, { type: 'UtteranceEnd' });

    connection.emit(LiveTranscriptionEvents.Transcript, {
      type: 'Results',
      channel: { alternatives: [{ transcript: 'second turn' }] },
      is_final: true,
      speech_final: false,
    });
    connection.emit(LiveTranscriptionEvents.Transcript, { type: 'UtteranceEnd' });

    expect(outputs).toEqual(['hello there', 'second turn']);
  });
});
