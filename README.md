# StakeholderVirtual

Chatbot com IA que representa um stakeholder virtual (cliente) em entrevistas de
levantamento de requisitos, para estudantes de Engenharia de Software praticarem.
Cada projeto tem um relatório (PDF) diferente por trás da persona.

## Arquitetura (3 serviços)

```
frontend/     React + Vite + TS         → deploy na Vercel
backend/      Node + Express + Prisma   → deploy no Render
adk-service/  Python + FastAPI + ADK    → deploy no Render (serviço separado)
```

- **frontend**: interface do estudante (login, seleção de projeto, chat) e do
  admin (upload de PDFs, fila de perguntas não respondidas).
- **backend**: dono da verdade — autenticação (JWT access+refresh em cookies
  httpOnly), Postgres via Prisma (Supabase), upload de PDF pro Supabase
  Storage, e quem chama o `adk-service` a cada pergunta.
- **adk-service**: microserviço stateless com um pipeline de 2 agentes do
  Google ADK — um responde como o stakeholder, outro verifica se a resposta
  é fundamentada no relatório antes de deixar passar. Modelo usado:
  OpenAI GPT-4o-mini via adaptador LiteLLM do ADK.

Banco de dados: PostgreSQL (Supabase). Armazenamento de PDFs: Supabase Storage.

## Rodando localmente

### 1. Banco local

O `DATABASE_URL` do `.env.example` já vem pronto pra usar um Postgres local
via Docker (não precisa de Supabase pra isso):
```bash
docker compose up -d postgres
```
Isso sobe um Postgres em `localhost:5432` com usuário/senha/banco
`stakeholder`/`stakeholder`/`stakeholder_virtual`. Se preferir, pode usar
qualquer outro Postgres local (instalado direto na máquina) — só ajustar a
`DATABASE_URL`.

Os PDFs também podem ficar 100% locais em dev: com `STORAGE_DRIVER=local`
(padrão do `.env.example`) eles são salvos em `backend/uploads/reports`,
sem precisar de conta no Supabase. Em produção, troque para
`STORAGE_DRIVER=supabase` e preencha `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`
com os dados de *Project Settings → API* do seu projeto Supabase, e crie um
bucket privado chamado `reports` no Storage.

### 2. backend/
```bash
cd backend
cp .env.example .env   # preencha DATABASE_URL, JWT secrets, Supabase, etc.
npm install
npx prisma migrate dev --name init
npm run dev             # http://localhost:4000
```

### 3. adk-service/
```bash
cd adk-service
cp .env.example .env    # preencha OPENAI_API_KEY
python -m venv .venv 
source .venv/Scripts/activate
python -m pip install -r requirements.txt
python main.py          # http://localhost:8000
```

### 4. frontend/
```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:4000
npm install
npm run dev              # http://localhost:5173
```

### 5. (opcional) popular projetos com os PDFs antigos
Os PDFs que estavam em `/pdfs` (do protótipo antigo em Flask) podem ser
importados como projetos de uma vez com:
```bash
cd backend && npm run seed
```

## Deploy

- **Vercel**: aponta pra pasta `frontend/`. Variável de ambiente:
  `VITE_API_URL` = URL pública do backend no Render.
- **Render (backend)**: aponta pra pasta `backend/`. Build: `npm install &&
  npm run build && npx prisma migrate deploy`. Start: `npm start`. Variáveis:
  ver `backend/.env.example` (`COOKIE_SECURE=true` em produção).
- **Render (adk-service)**: aponta pra pasta `adk-service/`. Build: `pip
  install -r requirements.txt`. Start: `uvicorn main:app --host 0.0.0.0 --port
  $PORT`. Variável: `OPENAI_API_KEY`.

Como Vercel e Render são domínios diferentes, os cookies de sessão usam
`SameSite=None; Secure` — por isso `COOKIE_SECURE=true` é obrigatório em
produção, e o CORS do backend precisa do domínio exato da Vercel em
`CORS_ORIGIN` (não puder usar `*` com `credentials: true`).

## O que mudou em relação ao protótipo anterior

- Antes: um único deploy na Vercel, Flask serverless, sessão em cookie sem
  banco, PDF sorteado aleatoriamente, sem login.
- Agora: 3 serviços separados, autenticação real (usuários comuns e admins),
  chat persistido por usuário+projeto no Postgres, hub de admin para subir
  novos relatórios e revisar perguntas sem fundamento no relatório, e um
  agente verificador (ADK) que reduz alucinação do stakeholder.
- **Não migrado**: a funcionalidade antiga de digitar "sair" para receber um
  feedback pedagógico da entrevista não faz parte deste escopo — pode ser
  reintroduzida depois como um terceiro agente no pipeline, se fizer sentido.
