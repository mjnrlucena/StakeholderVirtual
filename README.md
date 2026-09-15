# Stakeholder Virtual — Frontend

Front-end em Vite + React + TypeScript para o projeto StakeholderVirtual.
Sempre fala com o backend Flask real (sem modo mock) — a IA é sempre a de
verdade, tanto em desenvolvimento quanto em produção.

## Stack

- Vite + React + TypeScript
- React Router (`RouterProvider` em `main.tsx`, `Outlet` em `App.tsx`)
- Zustand (`store/useChatStore.ts`, `store/useThemeStore.ts`)
- TanStack React Query (`QueryClientProvider` em `main.tsx`) + Axios
- Tailwind CSS (v4), com tema claro/escuro em `src/styles/global.css`
  (claro é o padrão). Visual inspirado no ChatGPT: sem header tradicional
  (só uma barra fixa e minimalista com ícones), mensagens do assistente
  em texto corrido (sem balão) e composer fixo no rodapé. Fonte é a
  padrão do sistema (sem webfont customizada).

## Como rodar em desenvolvimento

O backend Flask (`python main.py`, na raiz do projeto) precisa estar
rodando **também**, já que este front chama a IA de verdade.

```bash
# 1. Backend (na raiz do projeto)
pip install -r requirements.txt
cp .env.example .env        # preencha com sua OPENAI_API_KEY
python main.py               # sobe em http://localhost:5000

# 2. Frontend (nesta pasta)
cd frontend
cp .env.example .env         # ajuste PORT/VITE_API_URL se precisar
npm install
npm run dev                  # sobe em http://localhost:5173 (ou o PORT do .env)
```

Em dev, o Vite faz proxy de `/pergunta` para o Flask local
(configurado em `vite.config.ts`, usando `VITE_API_URL` do `.env`), então
não há problema de CORS.

## Sobre a `OPENAI_API_KEY`

Ela **nunca** deve entrar em nenhum `.env` desta pasta (`frontend/`).
Qualquer variável aqui (prefixo `VITE_`) é embutida no JavaScript enviado
ao navegador — ou seja, ficaria pública. A chave continua exclusivamente
no `.env` da raiz do projeto, lido pelo `chatbot.py`.

## Persistência e expiração do chat

As mensagens ficam salvas em `localStorage` (chave
`stakeholder-virtual:chat`), junto com o horário da última atividade.
Se o usuário ficar mais de 30 minutos sem interagir, o chat é limpo
automaticamente — isso é checado ao carregar a página, periodicamente
(a cada 1 min) e quando a aba volta a ficar visível
(`hooks/useChatExpirationWatcher.ts`).

## Estrutura de pastas

```
src/
  main.tsx              # QueryClientProvider + RouterProvider
  App.tsx                # ThemeProvider + Outlet + Header
  router/                 # definição das rotas
  pages/
    ChatPage/             # página principal, em uso
    Feedback/              # reservada (quando o botão Sair ganhar função)
    Login/                  # reservada (caso entre autenticação)
    NotFound/
  components/
    chat/                  # ChatWindow, MessageBubble, ChatInput
    layout/                # Header, NewChatButton, SairButton, ThemeToggle
    theme/                  # ThemeProvider
    ui/                     # reservada (botões/inputs genéricos futuros)
  store/                   # Zustand: chat e tema
  services/                # Axios + chamadas à API do Flask
  utils/                   # persistência do chat no localStorage
  hooks/                   # useChatExpirationWatcher
  types/                   # tipos do chat
  styles/                  # global.css (tokens de cor claro/escuro)
```

## Botões

- **Novo chat**: reinicia a conversa (limpa mensagens e o localStorage).
- **Sair**: existe na interface, mas está desabilitado por enquanto — no
  futuro deve chamar `solicitarFeedback()` (já implementado em
  `services/api.ts`) para pedir a avaliação pedagógica da entrevista.
