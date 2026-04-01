import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Informe o caminho do arquivo SQL.');
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, '../../', fileArg);
const sql = fs.readFileSync(sqlPath, 'utf8');

await query(sql);
console.log(`SQL executado com sucesso: ${sqlPath}`);
process.exit(0);
