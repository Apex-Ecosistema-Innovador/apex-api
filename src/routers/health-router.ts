import { Router } from 'express';
import Database from '../lib/database';

function healthRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    await Database.query('SELECT 1', [], { queryId: 'health.ping' });
    res.json({ status: 'ok' });
  });

  return router;
}

export default healthRouter;
