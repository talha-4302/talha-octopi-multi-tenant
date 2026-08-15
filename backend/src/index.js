// backend/src/index.js
import { app } from './app.js';
import { env } from './config/env.js';
import { startScheduler } from './jobs/scheduler.js';

startScheduler();

app.listen(env.PORT, () => {
  console.log(`listening on http://localhost:${env.PORT}`);
});
