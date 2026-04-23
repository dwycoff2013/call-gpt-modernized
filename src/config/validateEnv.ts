import { getEnvOptional } from './env';

export function validateEnv(): void {
  const missing: string[] = [];

  const requiredVars: string[] = [
    'DEEPGRAM_API_KEY',
    'VOICE_MODEL',
    'OPENAI_API_KEY',
  ];

  for (const key of requiredVars) {
    if (!getEnvOptional(key)) {
      missing.push(key);
    }
  }

  const recordingEnabled = getEnvOptional('RECORDING_ENABLED');
  if (recordingEnabled === 'true') {
    const twilioVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
    for (const key of twilioVars) {
      if (!getEnvOptional(key)) {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
