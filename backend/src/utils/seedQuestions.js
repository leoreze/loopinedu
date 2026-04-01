import { query } from '../db/index.js';
import { questionsSeed } from './questions.seed.js';

for (const [dimension, pillar_label, prompt, sort_order] of questionsSeed) {
  await query(
    `
      UPDATE questions
         SET sort_order = $4,
             is_active = TRUE,
             pillar_label = $2
       WHERE dimension = $1
         AND pillar_label = $2
         AND prompt = $3
    `,
    [dimension, pillar_label, prompt, sort_order]
  );

  await query(
    `
      INSERT INTO questions (dimension, pillar_label, prompt, sort_order, is_active)
      SELECT $1, $2, $3, $4, TRUE
       WHERE NOT EXISTS (
        SELECT 1
          FROM questions
         WHERE dimension = $1
           AND pillar_label = $2
           AND prompt = $3
      )
    `,
    [dimension, pillar_label, prompt, sort_order]
  );
}

console.log('Perguntas seed inseridas com sucesso.');
process.exit(0);
