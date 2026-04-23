import 'colors';
import { createClient, LiveTranscriptionEvents, type DeepgramClient } from '@deepgram/sdk';
import { Buffer } from 'node:buffer';
import EventEmitter from 'events';
import { config } from '../config/index';
import type { ITranscriptionService } from '../types/index';

export class TranscriptionService extends EventEmitter implements ITranscriptionService {
  private dgConnection: ReturnType<DeepgramClient['listen']['live']>;
  private finalResult: string;
  private speechFinal: boolean;

  constructor({ deepgramFactory = createClient }: { deepgramFactory?: (apiKey: string) => DeepgramClient } = {}) {
    super();
    const deepgram = deepgramFactory(config.deepgram.apiKey);
    this.dgConnection = deepgram.listen.live({
      encoding: 'mulaw',
      sample_rate: 8000,
      model: 'nova-2',
      punctuate: true,
      interim_results: true,
      endpointing: 200,
      utterance_end_ms: 1000
    });
    this.finalResult = '';
    this.speechFinal = false;

    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      this.dgConnection.on(LiveTranscriptionEvents.Transcript, (event) => {
        const text = event.channel?.alternatives?.[0]?.transcript || '';
        
        if (event.type === 'UtteranceEnd') {
          if (!this.speechFinal && this.finalResult.trim().length > 0) {
            this.emit('transcription', this.finalResult);
          }
          this.finalResult = '';
          this.speechFinal = false;
          return;
        }
        
        if (event.is_final === true && text.trim().length > 0) {
          this.finalResult += ` ${text}`;
          if (event.speech_final === true) {
            this.speechFinal = true;
            this.emit('transcription', this.finalResult);
            this.finalResult = '';
          } else {
            this.speechFinal = false;
          }
        } else {
          this.emit('utterance', text);
        }
      });
    });
  }

  send(payload: string): void {
    if (this.dgConnection.getReadyState() === 1) {
      const audioBuffer = Buffer.from(payload, 'base64');
      const arrayBuffer = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength);
      this.dgConnection.send(arrayBuffer);
    }
  }
}

export default TranscriptionService;
