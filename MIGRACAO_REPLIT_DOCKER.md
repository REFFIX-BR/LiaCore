# 🐳 Guia de Migração: Replit → Docker (Servidor Local)

Este guia explica como migrar o projeto HealthLinkConnect do Replit para um servidor local usando Docker.

## 📋 Índice

1. [Alterações Realizadas](#alterações-realizadas)
2. [Pré-requisitos](#pré-requisitos)
3. [Passo a Passo da Migração](#passo-a-passo-da-migração)
4. [Configuração de Variáveis de Ambiente](#configuração-de-variáveis-de-ambiente)
5. [Diferenças entre Replit e Docker](#diferenças-entre-replit-e-docker)
6. [Troubleshooting](#troubleshooting)

---

## 🔄 Alterações Realizadas

### 1. **Dockerfile Criado**
- Multi-stage build para otimizar tamanho da imagem
- Build da aplicação e instalação de dependências
- Usuário não-root para segurança
- Healthcheck configurado

### 2. **docker-compose.yml Atualizado**
- Adicionado serviço `app` para a aplicação
- Configurado network para comunicação entre containers
- Dependências configuradas (app depende de postgres e redis)
- Variáveis de ambiente configuradas

### 3. **Dependências da Replit Removidas**
- Removidos plugins do Vite específicos da Replit:
  - `@replit/vite-plugin-cartographer`
  - `@replit/vite-plugin-dev-banner`
  - `@replit/vite-plugin-runtime-error-modal`
- `vite.config.ts` atualizado para funcionar sem Replit

### 4. **Configuração Redis Adaptada**
- Suporte para Redis local (sem TLS) e Upstash (com TLS)
- Detecção automática do ambiente
- Wrapper compatível para usar IORedis quando Redis local

### 5. **Arquivo env.example Criado**
- Template completo com todas as variáveis necessárias
- Comentários explicativos
- Exemplos para Redis local e Upstash

---

## ✅ Pré-requisitos

### No Servidor Local

1. **Docker e Docker Compose**
   ```bash
   docker --version      # Docker 20.10+
   docker-compose --version  # Docker Compose 2.0+
   ```

2. **Portas Disponíveis**
   - `5000` - Aplicação principal
   - `5432` - PostgreSQL (opcional, pode ser mapeado para outra porta)
   - `6379` - Redis (opcional, pode ser mapeado para outra porta)
   - `8080` - Adminer (opcional, interface PostgreSQL)
   - `8081` - Redis Commander (opcional, interface Redis)

3. **Recursos do Servidor**
   - Mínimo: 2GB RAM, 2 vCPU
   - Recomendado: 4GB RAM, 4 vCPU
   - Espaço em disco: 10GB+ (para imagens Docker e volumes)

---

## 🚀 Passo a Passo da Migração

### **Passo 1: Preparar o Ambiente**

```bash
# 1. Clonar/copiar o projeto para o servidor
cd /caminho/do/projeto

# 2. Verificar se os arquivos estão presentes
ls -la Dockerfile docker-compose.yml env.example
```

### **Passo 2: Configurar Variáveis de Ambiente**

```bash
# 1. Copiar o arquivo de exemplo
cp env.example .env

# 2. Editar o arquivo .env com suas configurações
nano .env  # ou seu editor preferido
```

**Variáveis Obrigatórias:**
- `DATABASE_URL` - URL do PostgreSQL
- `OPENAI_API_KEY` - Chave da API OpenAI
- `UPSTASH_VECTOR_URL` e `UPSTASH_VECTOR_TOKEN` - Para RAG
- `SESSION_SECRET` - String aleatória segura
- Assistant IDs do OpenAI

**Para Redis Local (Docker):**
```env
REDIS_HOST=redis
REDIS_PORT=6379
UPSTASH_REDIS_HOST=redis
UPSTASH_REDIS_PORT=6379
UPSTASH_REDIS_PASSWORD=
```

**Para Upstash (Cloud):**
```env
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxYYY...
UPSTASH_REDIS_HOST=xxxxx.upstash.io
UPSTASH_REDIS_PORT=6379
UPSTASH_REDIS_PASSWORD=xxxxx
```

### **Passo 3: Construir e Iniciar os Containers**

```bash
# 1. Construir a imagem da aplicação
docker-compose build

# 2. Iniciar todos os serviços
docker-compose up -d

# 3. Verificar status
docker-compose ps
```

Você deve ver:
```
NAME          STATUS          PORTS
lia-app        Up (healthy)    0.0.0.0:5000->5000/tcp
lia-postgres   Up (healthy)    0.0.0.0:5432->5432/tcp
lia-redis      Up (healthy)    0.0.0.0:6379->6379/tcp
```

### **Passo 4: Verificar Logs**

```bash
# Logs da aplicação
docker-compose logs -f app

# Logs do PostgreSQL
docker-compose logs -f postgres

# Logs do Redis
docker-compose logs -f redis
```

### **Passo 5: Aplicar Schema do Banco de Dados**

```bash
# Entrar no container da aplicação
docker-compose exec app sh

# Dentro do container, aplicar schema
npm run db:push

# Sair do container
exit
```

### **Passo 6: Testar a Aplicação**

```bash
# Verificar health check
curl http://localhost:5000/api/health

# Acessar no navegador
# http://seu-servidor:5000
```

---

## 🔧 Configuração de Variáveis de Ambiente

### **Opção 1: Arquivo .env (Recomendado)**

Crie um arquivo `.env` na raiz do projeto:

```bash
cp env.example .env
nano .env
```

### **Opção 2: docker-compose.override.yml**

Para desenvolvimento local, você pode criar `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  app:
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:lia_dev_2024@postgres:5432/lia_cortex_dev
```

### **Opção 3: Variáveis de Ambiente do Sistema**

```bash
export DATABASE_URL="postgresql://..."
export OPENAI_API_KEY="sk-proj-..."
docker-compose up -d
```

---

## 🔀 Diferenças entre Replit e Docker

### **1. Banco de Dados**

| Aspecto | Replit | Docker |
|---------|--------|--------|
| **Tipo** | Neon (serverless) | PostgreSQL 15 (container) |
| **Conexão** | WebSocket via `@neondatabase/serverless` | TCP direto |
| **URL** | `postgresql://...@ep-xxx.neon.tech` | `postgresql://postgres:senha@postgres:5432/db` |

**Nota:** O código já suporta ambos os tipos de conexão.

### **2. Redis**

| Aspecto | Replit | Docker |
|---------|--------|--------|
| **Tipo** | Upstash (cloud) | Redis local (container) |
| **TLS** | Sim (obrigatório) | Não (local) |
| **REST API** | Sim (Upstash) | Não (usa IORedis direto) |

**Nota:** A configuração foi adaptada para detectar automaticamente o ambiente.

### **3. Portas**

| Serviço | Replit | Docker |
|---------|--------|--------|
| **Aplicação** | 5000 (interno) → 80 (externo) | 5000 (configurável) |
| **PostgreSQL** | Gerenciado pelo Replit | 5432 (configurável) |
| **Redis** | Gerenciado pelo Replit | 6379 (configurável) |

### **4. Variáveis de Ambiente**

| Replit | Docker |
|--------|--------|
| Configuradas na aba "Secrets" | Arquivo `.env` ou `docker-compose.yml` |
| `REPL_ID` disponível | Não disponível (removido do código) |

### **5. Build e Deploy**

| Replit | Docker |
|--------|--------|
| Build automático no deploy | `docker-compose build` manual |
| Hot reload em desenvolvimento | Precisa rebuild para mudanças |

---

## 🛠️ Troubleshooting

### **Problema: Container não inicia**

```bash
# Verificar logs
docker-compose logs app

# Verificar se as variáveis estão corretas
docker-compose exec app env | grep DATABASE_URL
```

### **Problema: Erro de conexão com PostgreSQL**

```bash
# Verificar se o PostgreSQL está rodando
docker-compose ps postgres

# Testar conexão
docker-compose exec postgres psql -U postgres -d lia_cortex_dev -c "SELECT 1;"
```

### **Problema: Erro de conexão com Redis**

```bash
# Verificar se o Redis está rodando
docker-compose ps redis

# Testar conexão
docker-compose exec redis redis-cli ping
```

### **Problema: Aplicação não responde**

```bash
# Verificar health check
curl http://localhost:5000/api/health

# Verificar se a porta está exposta
docker-compose ps app
# Deve mostrar: 0.0.0.0:5000->5000/tcp
```

### **Problema: Erro "Module not found"**

```bash
# Rebuild da imagem
docker-compose build --no-cache app
docker-compose up -d app
```

### **Problema: Permissões de arquivo**

```bash
# Ajustar permissões (se necessário)
sudo chown -R $USER:$USER .
```

---

## 📝 Comandos Úteis

### **Gerenciamento de Containers**

```bash
# Iniciar todos os serviços
docker-compose up -d

# Parar todos os serviços
docker-compose stop

# Parar e remover containers
docker-compose down

# Parar e remover containers + volumes (CUIDADO!)
docker-compose down -v

# Reiniciar um serviço específico
docker-compose restart app

# Ver logs em tempo real
docker-compose logs -f app

# Executar comando no container
docker-compose exec app npm run db:push
```

### **Banco de Dados**

```bash
# Acessar PostgreSQL via Adminer
# http://localhost:8080
# Sistema: PostgreSQL
# Servidor: postgres
# Usuário: postgres
# Senha: lia_dev_2024
# Base de dados: lia_cortex_dev

# Acessar via CLI
docker-compose exec postgres psql -U postgres -d lia_cortex_dev

# Backup do banco
docker-compose exec postgres pg_dump -U postgres lia_cortex_dev > backup.sql

# Restaurar backup
docker-compose exec -T postgres psql -U postgres -d lia_cortex_dev < backup.sql
```

### **Redis**

```bash
# Acessar Redis Commander
# http://localhost:8081

# Acessar via CLI
docker-compose exec redis redis-cli

# Limpar todo o Redis (CUIDADO!)
docker-compose exec redis redis-cli FLUSHALL
```

### **Aplicação**

```bash
# Rebuild após mudanças no código
docker-compose build app
docker-compose up -d app

# Ver logs da aplicação
docker-compose logs -f app

# Executar script dentro do container
docker-compose exec app npm run db:push
```

---

## 🔒 Segurança

### **1. Variáveis Sensíveis**

- **NUNCA** commite o arquivo `.env` no Git
- Use secrets management em produção (ex: Docker Secrets, Kubernetes Secrets)
- Gere `SESSION_SECRET` único e seguro:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

### **2. Firewall**

Configure o firewall para expor apenas as portas necessárias:

```bash
# Exemplo com UFW (Ubuntu)
sudo ufw allow 5000/tcp  # Aplicação
sudo ufw allow 22/tcp   # SSH
```

### **3. Reverse Proxy (Recomendado)**

Use Traefik ou Nginx como reverse proxy:

```yaml
# Exemplo com Traefik (conforme memória do usuário)
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.seudominio.com`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
```

---

## 📚 Próximos Passos

1. **Configurar Reverse Proxy** (Traefik/Nginx)
2. **Configurar SSL/TLS** (Let's Encrypt)
3. **Configurar Backup Automático** do PostgreSQL
4. **Configurar Monitoramento** (Prometheus, Grafana)
5. **Configurar Logs Centralizados** (ELK, Loki)
6. **Otimizar Performance** (cache, CDN, etc.)

---

## ✅ Checklist de Migração

- [ ] Docker e Docker Compose instalados
- [ ] Arquivo `.env` configurado com todas as variáveis
- [ ] Imagem da aplicação construída (`docker-compose build`)
- [ ] Todos os containers rodando (`docker-compose ps`)
- [ ] Schema do banco aplicado (`npm run db:push`)
- [ ] Health check funcionando (`curl http://localhost:5000/api/health`)
- [ ] Aplicação acessível no navegador
- [ ] Logs sem erros críticos
- [ ] Testes básicos realizados (login, funcionalidades principais)

---

## 🆘 Suporte

Se encontrar problemas durante a migração:

1. Verifique os logs: `docker-compose logs -f app`
2. Verifique as variáveis de ambiente: `docker-compose exec app env`
3. Verifique a conectividade entre containers: `docker-compose exec app ping postgres`
4. Consulte a seção [Troubleshooting](#troubleshooting)

---

**Última atualização:** 2025-01-27

