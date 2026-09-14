# StakeholderVirtual


### BASH

## *INSTALANDO DEPENDÊNCIAS*
# raiz do projeto
cp .env.example .env   # preencha OPENAI_API_KEY
pip install -r requirements.txt

# frontend
cd frontend
cp .env.example .env # não precisa alterar nada
npm install


## *INICIALIZANDO*
# TERMINAL 1
python main.py

# TERMINAL 2
cd frontend
npm run dev




### **POWERSHELL**

## *INSTALANDO DEPENDÊNCIAS*
# raiz
Copy-Item .env.example .env  # preencha OPENAI_API_KEY
pip install -r requirements.txt

# frontend
cd frontend
Copy-Item .env.example .env  # não precisa alterar nada
npm install


## *INICIALIZANDO*
# TERMINAL 1
python main.py

# TERMINAL 2
cd frontend
npm run dev