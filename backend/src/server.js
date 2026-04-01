import { createApp } from './app.js';
import { env } from './config/env.js';
import { testConnection } from './db/index.js';
import { seedDefaultAdmin } from './controllers/auth.controller.js';

const app = createApp();

async function bootstrap() {
  await testConnection();
  await seedDefaultAdmin();

  app.listen(env.port, () => {
    console.log(`LoopinEdu rodando na porta ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Erro fatal ao iniciar o LoopinEdu:', error);
  process.exit(1);
});
