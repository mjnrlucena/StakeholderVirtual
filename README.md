# StakeholderVirtual

## Instalação

### Bash

#### 1. Raiz do projeto

```bash
cp .env.example .env
# Preencha OPENAI_API_KEY no arquivo .env

pip install -r requirements.txt
```

#### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Não é necessário alterar este arquivo

npm install
```

---

### PowerShell

#### 1. Raiz do projeto

```powershell
Copy-Item .env.example .env
# Preencha OPENAI_API_KEY no arquivo .env

pip install -r requirements.txt
```

#### 2. Frontend

```powershell
cd frontend
Copy-Item .env.example .env
# Não é necessário alterar este arquivo

npm install
```

---

## Inicialização

Após instalar as dependências, são necessários **dois terminais** para executar o projeto.

### Bash

#### Terminal 1 — Backend

Na raiz do projeto:

```bash
python main.py
```

#### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

---

### PowerShell

#### Terminal 1 — Backend

Na raiz do projeto:

```powershell
python main.py
```

#### Terminal 2 — Frontend

```powershell
cd frontend
npm run dev
```
