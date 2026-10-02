import { Router } from 'express';
import database from '../lib/database';

function healthRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    await database.raw('select 1');
    res.json({ status: 'ok' });
  });

  return router;
}

export default healthRouter;
