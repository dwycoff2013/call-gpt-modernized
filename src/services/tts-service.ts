import { Buffer } from 'node:buffer';
import EventEmitter from 'events';
import { config } from '../config/index';
import type { ITextToSpeechService, GptReply } from '../types/index';

export class TextToSpeechService extends EventEmitter implements ITextToSpeechService {
  async generate(gptReply: GptReply, interactionCount: number): Promise<void> {
    const { partialResponseIndex, partialResponse } = gptReply;
    if (!partialResponse) return;

    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${config.deepgram.voiceModel}&encoding=mulaw&sample_rate=8000&container=none`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${config.deepgram.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: partialResponse }),
      }
    );

    if (response.status !== 200) return;
    
    const blob = await response.blob();
    const audioArrayBuffer = await blob.arrayBuffer();
    const base64String = Buffer.from(audioArrayBuffer).toString('base64');
    this.emit('speech', partialResponseIndex, base64String, partialResponse, interactionCount);
  }
}

export default TextToSpeechService;
