import express from 'express';
import { CallSessionManager } from '../session/CallSessionManager';

export function registerConnectionRoute(app: express.Application, expressWsInstance: { applyTo: (router: express.Router) => void }): void {
  const connectionRouter = express.Router();
  expressWsInstance.applyTo(connectionRouter);

  connectionRouter.ws('/connection', (ws) => {
    const sessionManager = new CallSessionManager(ws);
    sessionManager.initialize().catch((error) => {
      console.error('Failed to initialize call session:', error);
      ws.close();
    });
  });

  app.use(connectionRouter);
}
