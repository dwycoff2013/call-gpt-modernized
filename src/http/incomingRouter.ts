import express from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse.js';
import { config } from '../config/index';

const incomingRouter = express.Router();

incomingRouter.post('/incoming', (req: express.Request, res: express.Response) => {
  try {
    const forwardedHost = req.get('x-forwarded-host');
    const host = forwardedHost || req.get('host') || config.server.host;
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${host}/connection` });

    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed_to_generate_twiml' });
  }
});

export { incomingRouter };
