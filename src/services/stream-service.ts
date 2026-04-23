import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import type WebSocket from 'ws';
import type { IStreamService } from '../types/index';

export class StreamService extends EventEmitter implements IStreamService {
  public ws: WebSocket;
  public expectedAudioIndex: number;
  public audioBuffer: Record<number, string>;
  public streamSid: string;

  constructor(websocket: WebSocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
  }

  setStreamSid(streamSid: string): void {
    this.streamSid = streamSid;
  }

  buffer(index: number | null, audio: string): void {
    if (index === null) {
      this.sendAudio(audio);
      return;
    }
    
    if (index === this.expectedAudioIndex) {
      this.sendAudio(audio);
      this.expectedAudioIndex += 1;
      while (Object.prototype.hasOwnProperty.call(this.audioBuffer, this.expectedAudioIndex)) {
        this.sendAudio(this.audioBuffer[this.expectedAudioIndex]);
        this.expectedAudioIndex += 1;
      }
    } else {
      this.audioBuffer[index] = audio;
    }
  }

  private sendAudio(audio: string): void {
    this.ws.send(JSON.stringify({
      streamSid: this.streamSid,
      event: 'media',
      media: { payload: audio }
    }));
    
    const markLabel = uuidv4();
    this.ws.send(JSON.stringify({
      streamSid: this.streamSid,
      event: 'mark',
      mark: { name: markLabel }
    }));
    this.emit('audiosent', markLabel);
  }
}

export default StreamService;
