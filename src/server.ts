import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { buildCorsOrigin } from './lib/cors-origin';
import handleError, { handleNotFound } from './middlewares/handle-error';
import authRouter from './routers/auth-router';
import offeringRouter from './routers/offering-router';
import enrollmentRouter from './routers/enrollment-router';
import polipointRouter from './routers/polipoint-router';
import teacherRouter from './routers/teacher-router';
import adminRouter from './routers/admin-router';
import healthRouter from './routers/health-router';

class Server {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.useMiddleware();
    this.mountRoutes();
    this.app.use(handleNotFound);
    this.app.use(handleError);
  }

  private useMiddleware() {
    this.app.set('trust proxy', 1);
    this.app.use(helmet());
    this.app.use(cors({ origin: buildCorsOrigin(env.corsOrigins, !env.isProduction), credentials: true }));
    if (!env.isTest) this.app.use(morgan('tiny'));
    this.app.use(express.json({ limit: '100kb' }));
    this.app.use(cookieParser());
  }

  private mountRoutes() {
    this.app.use('/health', healthRouter());
    this.app.use('/api/v1/auth', authRouter());
    this.app.use('/api/v1/offerings', offeringRouter());
    this.app.use('/api/v1/enrollments', enrollmentRouter());
    this.app.use('/api/v1/polipoints', polipointRouter());
    this.app.use('/api/v1/teacher', teacherRouter());
    this.app.use('/api/v1/admin', adminRouter());
  }
}

export default new Server();
