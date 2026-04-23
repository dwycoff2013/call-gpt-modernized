import type { WebSocket } from 'ws';
import type EventEmitter from 'events';
import type OpenAI from 'openai';

// =============================================================================
// Configuration Types
// =============================================================================

export interface ServerConfig {
  port: number;
  host: string;
}

export interface OpenAIConfig {
  model: string;
}

export interface DeepgramConfig {
  apiKey: string;
  voiceModel: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  recordingEnabled: boolean;
}

export interface SessionConfig {
  backend: 'redis' | 'firestore' | 'memory';
}

export interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  appointmentTypesRaw: string;
  staffMembersRaw: string;
}

export interface Config {
  server: ServerConfig;
  openai: OpenAIConfig;
  deepgram: DeepgramConfig;
  twilio: TwilioConfig;
  zoho: ZohoConfig;
  session: SessionConfig;
}

// =============================================================================
// Tool Types (OpenAI compatible)
// =============================================================================

export interface ToolParameterProperty {
  type: string;
  description: string;
  [key: string]: unknown;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolReturns {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
}

export interface ToolDefinition {
  name: string;
  handlerPath: string;
  say: string;
  description: string;
  parameters: ToolParameters;
  returns: ToolReturns;
}

export interface ToolManifestFunction {
  name: string;
  say: string;
  description: string;
  parameters: ToolParameters;
  returns: ToolReturns;
}

export interface ToolManifest {
  type: 'function';
  function: ToolManifestFunction;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
export type ToolRegistry = Record<string, ToolHandler>;

// =============================================================================
// CRM Types
// =============================================================================

export interface LeadDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface EventDetails {
  event_title: string;
  start_datetime: string;
  end_datetime: string;
  lead_id?: string;
  appointment_type?: string;
  staff_member?: string;
}

export interface CrmLead {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Email?: string;
  Phone?: string;
}

export interface AppointmentType {
  id?: string;
  resource_id?: string;
  name?: string;
}

export interface StaffMember {
  id?: string;
  staff_id?: string;
  name?: string;
}

// =============================================================================
// Session Types
// =============================================================================

export interface SessionState {
  callSid: string | null;
  streamSid: string | null;
  status: 'started' | 'active' | 'ended';
  interactionCount: number;
  updatedAt: string;
}

// =============================================================================
// GPT Service Types
// =============================================================================

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'function';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  name?: string;
}

export interface GptReply {
  partialResponseIndex: number | null;
  partialResponse: string;
}

// =============================================================================
// Twilio/WebSocket Message Types
// =============================================================================

export interface TwilioStartMessage {
  event: 'start';
  start: {
    streamSid: string;
    callSid: string;
  };
}

export interface TwilioMediaMessage {
  event: 'media';
  media: {
    payload: string;
  };
  sequenceNumber?: string;
}

export interface TwilioMarkMessage {
  event: 'mark';
  mark: {
    name: string;
  };
  sequenceNumber?: string;
}

export interface TwilioStopMessage {
  event: 'stop';
  streamSid?: string;
}

export type TwilioMessage = 
  | TwilioStartMessage 
  | TwilioMediaMessage 
  | TwilioMarkMessage 
  | TwilioStopMessage;

// =============================================================================
// Service Interfaces
// =============================================================================

export interface IGptService extends EventEmitter {
  userContext: ChatMessage[];
  partialResponseIndex: number;
  openai: OpenAI;
  setCallSid(callSid: string): void;
  completion(text: string, interactionCount: number, role?: ChatMessageRole, name?: string, skipContextUpdate?: boolean): Promise<void>;
  on(event: 'gptreply', listener: (reply: GptReply, count: number) => void): this;
  emit(event: 'gptreply', reply: GptReply, count: number): boolean;
}

export interface IStreamService extends EventEmitter {
  ws: WebSocket;
  expectedAudioIndex: number;
  audioBuffer: Record<number, string>;
  streamSid: string;
  setStreamSid(streamSid: string): void;
  buffer(index: number | null, audio: string): void;
  on(event: 'audiosent', listener: (markLabel: string) => void): this;
  emit(event: 'audiosent', markLabel: string): boolean;
}

export interface ITranscriptionService extends EventEmitter {
  send(payload: string): void;
  on(event: 'transcription' | 'utterance', listener: (text: string) => void): this;
  emit(event: 'transcription' | 'utterance', text: string): boolean;
}

export interface ITextToSpeechService extends EventEmitter {
  generate(gptReply: GptReply, interactionCount: number): Promise<void>;
  on(event: 'speech', listener: (index: number | null, audio: string, text: string, count: number) => void): this;
  emit(event: 'speech', index: number | null, audio: string, text: string, count: number): boolean;
}

export interface ISessionStore {
  enabled: boolean;
  setSessionValue(sessionId: string | null, data: SessionState, ttlSeconds?: number): Promise<void>;
  getSessionValue?(sessionId: string | null): Promise<SessionState | null>;
  deleteSessionValue?(sessionId: string | null): Promise<void>;
  listSessionIds?(): Promise<string[]>;
}

// Recording service is a function
export type RecordingServiceFn = (ttsService: ITextToSpeechService, callSid: string) => Promise<void>;
