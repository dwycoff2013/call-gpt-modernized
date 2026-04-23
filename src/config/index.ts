import { getEnv, getEnvOptional, getEnvBoolean } from './env';
import type { Config } from '../types/index';
import { resolveSessionBackend } from '../state/resolveSessionBackend';

export const config: Config = {
  server: {
    port: Number(getEnv('PORT', '8080')),
    host: getEnv('SERVER', ''),
  },
  openai: {
    model: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  },
  deepgram: {
    apiKey: getEnv('DEEPGRAM_API_KEY', ''),
    voiceModel: getEnv('VOICE_MODEL', 'aura-asteria-en'),
  },
  twilio: {
    accountSid: getEnvOptional('TWILIO_ACCOUNT_SID') || '',
    authToken: getEnvOptional('TWILIO_AUTH_TOKEN') || '',
    recordingEnabled: getEnvBoolean('RECORDING_ENABLED'),
  },
  zoho: {
    clientId: getEnvOptional('ZOHO_CLIENT_ID') || '',
    clientSecret: getEnvOptional('ZOHO_CLIENT_SECRET') || '',
    refreshToken: getEnvOptional('ZOHO_REFRESH_TOKEN') || '',
    appointmentTypesRaw: getEnvOptional('ZOHO_APPOINTMENT_TYPES') || '[]',
    staffMembersRaw: getEnvOptional('ZOHO_STAFF_MEMBERS') || '[]',
  },
  session: {
    backend: resolveSessionBackend(),
  },
};

export { getEnv, getEnvOptional, getEnvNumber, getEnvBoolean } from './env';
export { validateEnv } from './validateEnv';
