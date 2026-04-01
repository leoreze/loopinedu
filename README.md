# LoopinEdu v1.4.7 — GitHub + Render Ready + Seed Showcase 100

Esta versão mantém a base preparada para GitHub e Render e já inclui a seed executiva de demonstração com **100 alunos**, **4 ciclos** e **400 avaliações** para deixar dashboard, relatórios e comparativos muito mais fortes.

## O que a seed showcase entrega
- **100 alunos** distribuídos em **5 séries**: 3º ao 7º ano
- **4 turmas por série**: A, B, C e D
- **4 ciclos diagnósticos**
- **400 avaliações** no total
- histórico completo por ciclo
- perfis pensados para demo e leitura gerencial:
  - `critical`
  - `recovering`
  - `stable`
  - `oscillating`
  - `highlight`
- respondentes 360º por avaliação:
  - aluno
  - professor
  - responsável
  - institucional
- status distribuídos para enriquecer os painéis:
  - `completed`
  - `collecting`
  - `draft`
- dados desenhados para gerar:
  - alertas reais
  - tendências por ciclo
  - comparativos entre respondentes
  - relatórios com casos críticos, estáveis e destaque
  - base forte para dashboard, master admin, relatórios premium, family report e billing demo

## Estrutura
- `backend/` → API Express + PostgreSQL + billing + IA + PDFs
- `frontend/public/` → landing, dashboard e telas do sistema
- `render.yaml` → blueprint do Render para o Web Service
- `.gitignore` → pronto para não subir segredos nem `node_modules`

## Setup local
```bash
cd backend
npm install
npm run db:setup
npm run db:seed
npm run db:seed:full
npm run dev
```

Você também pode usar o alias:
```bash
npm run db:seed:showcase
```

## Publicar no GitHub
```bash
git init
git branch -M main
git remote add origin https://github.com/leoreze/loopinedu.git
git add .
git commit -m "chore: prepare LoopinEdu for GitHub and Render"
git push -u origin main
```

## Deploy no Render
### Opção mais prática
1. No Render, crie um **Web Service** a partir do repositório GitHub.
2. O arquivo `render.yaml` na raiz já define `rootDir`, `buildCommand`, `preDeployCommand`, `startCommand` e `healthCheckPath`.
3. Na criação, preencha os segredos marcados com `sync: false`.

### Environment Variables que você precisa criar no Render
#### Obrigatórias
- `DATABASE_URL`
- `APP_URL`
- `JWT_SECRET`
- `DEFAULT_ADMIN_PASSWORD`

#### Obrigatórias se for usar IA
- `OPENAI_API_KEY`

#### Obrigatórias se for usar Mercado Pago
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`

#### Já definidas no blueprint ou podem ser mantidas com os defaults
- `NODE_ENV=production`
- `PORT=10000`
- `APP_NAME=LoopinEdu`
- `OPENAI_MODEL=gpt-4.1-mini`
- `DEFAULT_ADMIN_NAME=Administrador`
- `DEFAULT_ADMIN_EMAIL=admin@loopinedu.com`
- `DEFAULT_TENANT_NAME=Escola Demo LoopinEdu`
- `DEFAULT_TENANT_SLUG=demo-loopinedu`
- `TRIAL_DAYS=15`
- `MERCADOPAGO_STATEMENT_DESCRIPTOR=LOOPINEDU`
- `MERCADOPAGO_INTEGRATOR_ID` (opcional)

## Valores sugeridos para o seu Render
Use a **External Database URL** no `DATABASE_URL` do Web Service:
```env
DATABASE_URL=postgresql://loopinedu_db_user:GMrxI0EPhH0FQO3ePyCWAhKqUbQLVI0a@dpg-d767o26dqaus73cqtflg-a.virginia-postgres.render.com/loopinedu_db
```

Depois que o serviço tiver a URL pública, defina:
```env
APP_URL=https://SEU-SERVICO.onrender.com
```

## Observações importantes
- O arquivo `backend/.env` foi removido desta versão para evitar subir segredos ao GitHub.
- O `preDeployCommand` roda `db:setup` e `db:seed` no deploy. A seed showcase de 100 alunos deve ser executada manualmente quando você quiser popular a demo.
- O frontend já é servido pelo backend, então basta um único Web Service.

## Rodar a seed showcase no Render
Depois do deploy, execute no Shell do Render:
```bash
cd /opt/render/project/src/backend
npm run db:seed:full
```

## Resultado esperado da seed showcase
- 100 alunos
- 400 avaliações
- 4 ciclos
- distribuição por série e turma
- casos críticos, estáveis, oscilantes, em recuperação e destaque
- dados fortes para demo comercial e apresentação para clientes
