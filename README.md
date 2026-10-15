# Stakeholder Virtual

Plataforma de apoio ao ensino de engenharia de requisitos. O aluno conversa com um **stakeholder virtual** (IA) que responde com base em relatórios (PDFs) cadastrados pelos professores. Perguntas que a IA não sabe responder ficam registradas para que professores e gestores respondam depois.

- Site: https://stackholdervirtual.online
- API: https://api.stackholdervirtual.online

## Funcionalidades

- Chat por projeto/relatório, com histórico persistente por projeto (reiniciar o chat apaga as mensagens daquele chat).
- Respostas baseadas nos relatórios, com agente verificador para evitar respostas inventadas.
- Perguntas não respondidas salvas no banco e respondidas pelo hub de administração.
- Hub de administração: upload de PDFs, projetos cadastrados (com exclusão confirmada por texto), perguntas não respondidas e dashboard de logs das conversas com busca e filtros combináveis (turma, prompt, resposta).
- Autenticação com access token e refresh token em cookies `httpOnly`.
- Cadastro com escolha de turma.

## Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| Aluno (`USER`) | Usar o chat |
| Gestor | Acessar o hub, responder e deletar perguntas não respondidas (sem acesso ao dashboard de logs) |
| Professor | Tudo do hub, incluindo logs de todas as turmas (não promove ninguém) |
| Superadmin | Tudo; único que cria turmas e promove professores e gestores |

O superadmin inicial é criado pelo seed (`backend/src/seed.ts`). **Troque a senha logo após o primeiro deploy**: o repositório é público e o seed está nele (ver [Senha do superadmin](#senha-do-superadmin)).

## Arquitetura

```
Navegador
   │ HTTPS
   ▼
Caddy (80/443, certificados automáticos)
   ├── stackholdervirtual.online      → frontend (arquivos estáticos)
   ├── www.stackholdervirtual.online  → redireciona para o domínio raiz
   └── api.stackholdervirtual.online  → backend :3000
                                          ├── adk-service :8000  (agentes de IA)
                                          ├── postgres    :5432  (banco)
                                          └── volume uploads     (PDFs)
```

Somente o Caddy publica portas. Backend, adk-service e Postgres ficam acessíveis apenas pela rede interna do Docker.

## Stack

| Parte | Tecnologias |
|---|---|
| Frontend | Vite, React, TypeScript, React Router, Zustand, TanStack Query, Axios, Tailwind CSS |
| Backend | Node.js 22, Express, TypeScript, Prisma, Zod, JWT, bcryptjs |
| adk-service | Python 3.12, FastAPI, Google ADK, LiteLLM (modelo da OpenAI) |
| Banco | PostgreSQL 16 |
| Infra | Docker Compose, Caddy, VPS Hostinger (Ubuntu 24.04), GitHub Actions |

## Estrutura do repositório

```
backend/            API (Node/Express/Prisma)
  prisma/           schema.prisma (e migrations, quando existirem)
  src/              código-fonte (env.ts, seed.ts, services, ...)
  Dockerfile
adk-service/        microserviço Python com os agentes
  main.py
  agents/
  Dockerfile
frontend/           aplicação React
  Dockerfile        build + servidor estático
  Caddyfile         config do servidor estático (SPA)
pdfs/               relatórios de exemplo
docker-compose.yml  orquestra postgres, adk-service, backend, frontend e caddy
Caddyfile           domínios, HTTPS e proxy reverso
.github/workflows/deploy.yml   deploy automático
```

## Variáveis de ambiente

Nenhum arquivo `.env` vai para o Git. Em produção existem três, na raiz do projeto, com `chmod 600`.

### `.env` (usado só pelo Docker Compose, para o Postgres)

| Variável | Exemplo |
|---|---|
| `POSTGRES_USER` | `app` |
| `POSTGRES_PASSWORD` | senha forte (`openssl rand -hex 24`) |
| `POSTGRES_DB` | `stakeholder` |

### `backend.env`

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | `postgresql://USUARIO:SENHA@postgres:5432/BANCO` (igual ao `.env`) |
| `JWT_ACCESS_SECRET` | sim | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | sim | `openssl rand -hex 32` |
| `ADK_SERVICE_URL` | sim | `http://adk-service:8000` |
| `CORS_ORIGIN` | sim | `https://stackholdervirtual.online` (sem barra no final) |
| `COOKIE_SECURE` | recomendada | `true` em produção |
| `STORAGE_DRIVER` | recomendada | `local` (PDFs em disco, no volume `uploads`) |
| `PORT` | não | `3000` (padrão do código é 4000) |
| `ACCESS_TOKEN_TTL_MIN` | não | padrão 15 |
| `REFRESH_TOKEN_TTL_DAYS` | não | padrão 7 |

Com `STORAGE_DRIVER` diferente de `local`, o backend exige as variáveis do Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`); em produção usamos o modo local.

### `adk.env`

| Variável | Descrição |
|---|---|
| `OPENAI_API_KEY` | chave da OpenAI (fica só aqui, nunca no frontend) |

Confira em `adk-service/` se o código lê outras variáveis (modelo, porta etc.) e acrescente conforme necessário.

### Frontend

A URL da API é embutida no build pelo Vite (`VITE_API_URL`), passada como `build.args` no `docker-compose.yml`. Variáveis `VITE_*` ficam públicas no JavaScript: nunca coloque segredos nelas.

## Desenvolvimento local

Pré-requisitos: Node 22, Python 3.12, PostgreSQL local (ou um container).

```bash
# 1. Backend
cd backend
npm install
# crie backend/.env com as variáveis da tabela acima (STORAGE_DRIVER=local)
npx prisma migrate dev      # ou: npx prisma db push
npm run seed
npm run dev                 # http://localhost:4000

# 2. adk-service
cd adk-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# defina OPENAI_API_KEY no ambiente ou em um .env local
uvicorn main:app --reload --port 8000

# 3. Frontend
cd frontend
npm install
npm run dev                 # confira o .env.example para a URL da API
```

## Deploy em produção (VPS Hostinger)

### 1. DNS (hPanel > Domínios > DNS)

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | IPv4 da VPS |
| A | `api` | IPv4 da VPS |
| AAAA | `@` e `api` | IPv6 da VPS (opcional; só se o valor estiver correto) |
| CNAME | `www` | `stackholdervirtual.online` |

Remova registros de "parking" que conflitem. Confira com `dig +short A stackholdervirtual.online @1.1.1.1`.

### 2. Preparar a VPS

- Firewall do hPanel e `ufw`: liberar TCP 22, 80 e 443 (e UDP 443 se quiser HTTP/3).
- Docker e Docker Compose instalados (template da Hostinger).
- Usuário `deploy` no grupo `docker`, login por chave SSH, sem login de root nem por senha.

### 3. Clonar e configurar

```bash
mkdir -p ~/apps && cd ~/apps
git clone git@github.com:MaironLima/StackHolderTeste.git
cd StackHolderTeste
nano .env backend.env adk.env      # conforme a seção de variáveis
chmod 600 .env backend.env adk.env
```

### 4. Subir

```bash
docker compose config > /dev/null && echo "YAML ok"
docker compose up -d --build
docker compose ps
```

### 5. Banco de dados

```bash
docker compose exec backend npm run prisma:migrate   # aplica migrations
docker compose exec backend npm run seed             # cria o superadmin
```

Enquanto o repositório não tiver `backend/prisma/migrations`, as tabelas são criadas com `docker compose exec backend npx prisma db push`. O passo para gerar a migration inicial (`0_init`) está em `commands.txt`.

### Senha do superadmin

O comando completo está em `commands.txt` (seção 5). Ele gera o hash bcrypt dentro do container e atualiza o usuário, sem expor a senha no histórico do terminal. Não rode `npm run seed` de novo sem antes verificar se o seed sobrescreve a senha.

### 6. PDFs

Com `STORAGE_DRIVER=local`, os PDFs ficam no volume Docker `uploads` (montado em `/app/uploads` no backend). Reenvie os relatórios pelo hub de administração após um banco novo.

## Deploy automático (GitHub Actions)

A cada push na `main`, o workflow `.github/workflows/deploy.yml` conecta na VPS por SSH e executa: `git reset --hard origin/main`, build das imagens, migrations, `docker compose up -d` e limpeza de imagens antigas.

Configuração única:

1. Criar uma chave SSH exclusiva para o CI e instalar a parte pública no `~/.ssh/authorized_keys` do usuário `deploy`.
2. Em **Settings > Secrets and variables > Actions**, criar:
   - `VPS_HOST`: IP da VPS
   - `VPS_USER`: `deploy`
   - `VPS_SSH_KEY`: chave privada completa (com as linhas BEGIN e END)
3. Fazer push do workflow e acompanhar na aba **Actions**. Também é possível rodar manualmente em **Run workflow**.

Os arquivos `.env`, `backend.env` e `adk.env` existem só na VPS e nunca são tocados pelo deploy (estão no `.gitignore`).

## Operação do dia a dia

```bash
docker compose ps                      # estado dos serviços
docker compose logs -f backend         # logs
docker compose up -d --build           # atualizar manualmente
docker compose up -d --force-recreate backend   # após editar backend.env
```

Mais comandos em `commands.txt`. Regra de ouro: **nunca** use `docker compose down -v`, pois remove os volumes (banco e PDFs).

## Backup e restauração

- Banco: `pg_dump` diário (cron) e cópia para fora da VPS.
- PDFs: backup do volume `uploads` e/ou guardar os originais fora da VPS.
- Snapshots da Hostinger antes de mudanças grandes.

Comandos de backup e restauração estão em `commands.txt` (seção 6). Teste uma restauração pelo menos uma vez.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Backend reiniciando em loop | variável obrigatória ausente | `docker compose logs backend` e conferir `backend/src/env.ts` |
| `relation "..." does not exist` | tabelas não criadas | `prisma migrate deploy` ou `prisma db push` e reiniciar o backend |
| 502 no site ou na API | serviço de destino parado | `docker compose ps` e logs do serviço |
| Certificado HTTPS não emitido | DNS ainda não aponta para a VPS ou 80/443 bloqueadas | `dig`, firewall do hPanel e `ufw`; depois `docker compose restart caddy` |
| Erro de CORS no navegador | `CORS_ORIGIN` diferente da origem real | ajustar e recriar o backend com `--force-recreate` |
| Login não mantém sessão | cookies sem `Secure`/`SameSite` corretos, ou front sem `withCredentials` | revisar configuração de cookies e do cliente HTTP |
| Build do frontend com `Killed` | memória insuficiente | criar swap (ver `commands.txt`) |
| Falha de autenticação no Postgres após trocar a senha | o Postgres só lê as credenciais na criação do volume | restaurar a senha antiga ou recriar o volume (apaga os dados) |
| `Could not find Prisma Schema` no build | `prisma/` não copiado antes do `npm ci` | manter `COPY prisma ./prisma` antes do `npm ci` no Dockerfile |

## Segurança

- O repositório é público: não faça commit de `.env`, chaves ou senhas.
- Troque a senha do superadmin após o seed.
- A chave da OpenAI fica apenas em `adk.env`.
- Acesso à VPS somente por chave SSH; chave do CI exclusiva e sem uso pessoal.
- Mantenha o sistema atualizado (`apt update && apt upgrade`) e monitore a API com um serviço de uptime.

## Pendências

- Gerar e commitar a migration inicial do Prisma (`0_init`).
- Configurar backup automático do banco e dos PDFs.
- Remover a dependência `@supabase/supabase-js` se o modo `supabase` não for mais usado.
