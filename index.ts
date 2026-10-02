import server from './src/server';
import { env } from './src/config/env';

server.app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
