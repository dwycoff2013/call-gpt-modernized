import 'dotenv/config';
import 'colors';
import express from 'express';
import expressWs from 'express-ws';
import { incomingRouter } from './http/incomingRouter';
import { registerConnectionRoute } from './http/connectionRouter';
import { validateEnv } from './config/index';
import { config } from './config/index';

try {
  validateEnv();
} catch (error) {
  console.error(`Configuration error: ${(error as Error).message}`);
  process.exit(1);
}

const app = express();
const wsInstance = expressWs(app);
const PORT = config.server.port;

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.use(incomingRouter);
registerConnectionRoute(app, wsInstance);

app.get('/healthz', (_req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/readyz', (_req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ready' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const shutdown = (): void => {
  console.log('Shutting down server...'.yellow);
  server.close(() => {
    console.log('Server closed.'.yellow);
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
