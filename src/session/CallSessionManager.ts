import 'colors';
import type WebSocket from 'ws';
import {
  GptService,
  StreamService,
  TranscriptionService,
  TextToSpeechService,
  recordingService,
} from '../services/index';
import { createSessionStore } from '../state/createSessionStore';
import type { 
  TwilioMessage, 
  SessionState, 
  GptReply,
  ISessionStore
} from '../types/index';

export class CallSessionManager {
  private ws: WebSocket;
  private streamSid: string | null = null;
  private callSid: string | null = null;
  private marks: string[] = [];
  private interactionCount: number = 0;

  private gptService: GptService;
  private streamService: StreamService;
  private transcriptionService: TranscriptionService;
  private ttsService: TextToSpeechService;
  private sessionStore: ISessionStore;

  constructor(ws: WebSocket, sessionStore: ISessionStore = createSessionStore()) {
    this.ws = ws;
    this.gptService = new GptService();
    this.streamService = new StreamService(ws);
    this.transcriptionService = new TranscriptionService();
    this.ttsService = new TextToSpeechService();
    this.sessionStore = sessionStore;
  }

  async initialize(): Promise<void> {
    this.ws.on('error', console.error);

    this.ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as TwilioMessage;
        await this.handleIncomingMessage(msg);
      } catch (error) {
        console.error('Error handling websocket message:', {
          callSid: this.callSid,
          streamSid: this.streamSid,
          error: (error as Error).message,
        });
      }
    });

    this.transcriptionService.on('utterance', async (text: string) => {
      try {
        if (this.marks.length > 0 && text?.length > 5) {
          console.log('Twilio -> Interruption, Clearing stream'.red);
          this.ws.send(
            JSON.stringify({
              streamSid: this.streamSid,
              event: 'clear',
            }),
          );
        }
      } catch (error) {
        console.error('Error handling utterance event:', {
          callSid: this.callSid,
          streamSid: this.streamSid,
          error: (error as Error).message,
        });
      }
    });

    this.transcriptionService.on('transcription', async (text: string) => {
      try {
        if (!text) {
          return;
        }
        console.log(`Interaction ${this.interactionCount} – STT -> GPT: ${text}`.yellow);
        await this.gptService.completion(text, this.interactionCount);
        this.interactionCount += 1;
        await this.saveSessionState('active');
      } catch (error) {
        console.error('Error handling transcription event:', {
          callSid: this.callSid,
          streamSid: this.streamSid,
          error: (error as Error).message,
        });
      }
    });

    this.gptService.on('gptreply', async (gptReply: GptReply, icount: number) => {
      try {
        console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green);
        await this.ttsService.generate(gptReply, icount);
      } catch (error) {
        console.error('Error handling gptreply event:', {
          callSid: this.callSid,
          streamSid: this.streamSid,
          error: (error as Error).message,
        });
      }
    });

    this.ttsService.on('speech', (responseIndex: number | null, audio: string, label: string, icount: number) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
      this.streamService.buffer(responseIndex, audio);
    });

    this.streamService.on('audiosent', (markLabel: string) => {
      this.marks.push(markLabel);
    });
  }

  private async handleIncomingMessage(msg: TwilioMessage): Promise<void> {
    if (msg.event === 'start') {
      await this.handleStart(msg);
      return;
    }

    if (msg.event === 'media') {
      this.transcriptionService.send(msg.media.payload);
      return;
    }

    if (msg.event === 'mark') {
      const label = msg.mark.name;
      console.log(`Twilio -> Audio completed mark (${(msg as { sequenceNumber?: string }).sequenceNumber}): ${label}`.red);
      this.marks = this.marks.filter((mark) => mark !== label);
      return;
    }

    if (msg.event === 'stop') {
      console.log(`Twilio -> Media stream ${this.streamSid} ended.`.underline.red);
      await this.saveSessionState('ended');
    }
  }

  private async handleStart(msg: { event: 'start'; start: { streamSid: string; callSid: string } }): Promise<void> {
    this.streamSid = msg.start.streamSid;
    this.callSid = msg.start.callSid;

    this.streamService.setStreamSid(this.streamSid);
    this.gptService.setCallSid(this.callSid);

    await this.saveSessionState('started');

    await recordingService(this.ttsService, this.callSid);

    console.log(`Twilio -> Starting Media Stream for ${this.streamSid}`.underline.red);
    this.ttsService.generate(
      {
        partialResponseIndex: null,
        partialResponse: 'Hello, and thank you for calling E Orum Young Law, LLC. How may we be of service to you today?',
      },
      0,
    );
  }

  private async saveSessionState(status: SessionState['status']): Promise<void> {
    try {
      await this.sessionStore.setSessionValue(
        this.callSid || this.streamSid,
        {
          callSid: this.callSid,
          streamSid: this.streamSid,
          status,
          interactionCount: this.interactionCount,
          updatedAt: new Date().toISOString(),
        },
        3600,
      );
    } catch (error) {
      console.error('Failed to persist session state:', {
        callSid: this.callSid,
        streamSid: this.streamSid,
        status,
        error: (error as Error).message,
      });
    }
  }
}

export default CallSessionManager;
