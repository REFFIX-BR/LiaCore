# 🚀 Guia de Configuração: Desenvolvimento Local

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração Rápida (Docker Compose)](#configuração-rápida-docker-compose)
4. [Configuração Manual](#configuração-manual)
5. [Migração de Dados](#migração-de-dados)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [Testes e Validação](#testes-e-validação)
8. [Troubleshooting](#troubleshooting)
9. [Comparação: Local vs Cloud](#comparação-local-vs-cloud)

---

## 🎯 Visão Geral

Este guia explica como configurar **LIA CORTEX** para desenvolvimento local, substituindo:

| Serviço Cloud | Alternativa Local | Status |
|---------------|-------------------|--------|
| **Neon Database** (PostgreSQL) | PostgreSQL 15 (Docker) | ✅ Recomendado |
| **Upstash Redis** | Redis 7 (Docker) | ✅ Recomendado |
| **Upstash Vector** | — | ⚠️ Manter cloud |

### Por que manter Upstash Vector?

- **Complexidade:** Migrar para pgvector requer reescrever queries vetoriais
- **Performance:** Upstash é otimizado para busca semântica em escala
- **Custo:** Tier gratuito suficiente para desenvolvimento
- **Manutenção:** Menos código para gerenciar

---

## 📦 Pré-requisitos

### Opção 1: Docker (Recomendado)

Instalar **Docker Desktop**:
- **Windows/Mac:** [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux:** 
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo systemctl start docker
  sudo usermod -aG docker $USER  # Re-login após esse comando
  ```

Verificar instalação:
```bash
docker --version          # Deve mostrar: Docker version 24.x.x
docker-compose --version  # Deve mostrar: Docker Compose version 2.x.x
```

### Opção 2: Instalação Nativa

**PostgreSQL 15:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15

# Mac (Homebrew)
brew install postgresql@15
brew services start postgresql@15
```

**Redis 7:**
```bash
# Ubuntu/Debian
sudo apt install redis-server

# Mac (Homebrew)
brew install redis
brew services start redis
```

---

## 🐳 Configuração Rápida (Docker Compose)

### **Passo 1: Criar `docker-compose.yml`**

Crie na raiz do projeto:

```yaml
version: '3.8'

services:
  # PostgreSQL 15
  postgres:
    image: postgres:15-alpine
    container_name: lia-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: lia_dev_2024
      POSTGRES_DB: lia_cortex_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 7
  redis:
    image: redis:7-alpine
    container_name: lia-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Redis Commander (Interface Web - Opcional)
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: lia-redis-ui
    restart: unless-stopped
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

  # Adminer (Interface PostgreSQL - Opcional)
  adminer:
    image: adminer:latest
    container_name: lia-adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - postgres

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### **Passo 2: Script de Inicialização do Banco**

Crie `scripts/init-db.sql`:

```sql
-- Script executado na primeira inicialização do PostgreSQL

-- Criar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Verificar conexão
SELECT 'PostgreSQL inicializado com sucesso!' as status;
SELECT version() as postgresql_version;
```

### **Passo 3: Iniciar Serviços**

```bash
# Iniciar todos os containers
docker-compose up -d

# Verificar status
docker-compose ps

# Verificar logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Parar todos os containers
docker-compose down

# Parar E DELETAR dados (cuidado!)
docker-compose down -v
```

### **Passo 4: Acessar Interfaces Web (Opcional)**

- **PostgreSQL (Adminer):** http://localhost:8080
  - Sistema: `PostgreSQL`
  - Servidor: `postgres`
  - Usuário: `postgres`
  - Senha: `lia_dev_2024`
  - Base de dados: `lia_cortex_dev`

- **Redis (Commander):** http://localhost:8081

---

## 🔧 Configuração Manual

### **PostgreSQL (sem Docker)**

```bash
# 1. Instalar PostgreSQL 15
sudo apt install postgresql-15

# 2. Criar usuário e banco
sudo -u postgres psql

# No console do PostgreSQL:
CREATE DATABASE lia_cortex_dev;
CREATE USER lia_user WITH PASSWORD 'lia_dev_2024';
GRANT ALL PRIVILEGES ON DATABASE lia_cortex_dev TO lia_user;
\q

# 3. Testar conexão
psql -h localhost -U lia_user -d lia_cortex_dev
```

### **Redis (sem Docker)**

```bash
# 1. Instalar Redis
sudo apt install redis-server

# 2. Configurar (opcional)
sudo nano /etc/redis/redis.conf
# Ajustar: maxmemory 512mb
# Ajustar: maxmemory-policy allkeys-lru

# 3. Iniciar
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 4. Testar
redis-cli ping  # Deve retornar: PONG
```

---

## 🗄️ Migração de Dados

### **Aplicar Schema Drizzle**

```bash
# 1. Garantir que DATABASE_URL está configurado
echo $DATABASE_URL

# 2. Push schema para banco local
npm run db:push

# Se houver conflitos, forçar:
npm run db:push -- --force
```

### **Copiar Dados de Produção (Opcional)**

⚠️ **ATENÇÃO:** Só faça isso se precisar testar com dados reais. **NÃO copie dados sensíveis!**

```bash
# 1. Exportar de Neon (produção)
pg_dump $PRODUCTION_DATABASE_URL > backup_prod.sql

# 2. Limpar dados sensíveis (LGPD)
# Editar backup_prod.sql e remover/anonimizar:
# - CPF/CNPJ
# - Telefones
# - Endereços
# - Mensagens sensíveis

# 3. Importar para local
psql $LOCAL_DATABASE_URL < backup_prod_sanitized.sql
```

### **Seed de Dados de Teste**

Crie `scripts/seed-dev.ts`:

```typescript
import { db } from '../server/db';
import { users, conversations, contacts } from '../shared/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Iniciando seed...');

  // 1. Criar usuários de teste
  const hashedPassword = await bcrypt.hash('abc123', 10);
  
  await db.insert(users).values([
    {
      username: 'admin_dev',
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Admin Local',
    },
    {
      username: 'supervisor_dev',
      password: hashedPassword,
      role: 'SUPERVISOR',
      name: 'Supervisor Local',
    },
    {
      username: 'agent_dev',
      password: hashedPassword,
      role: 'AGENT',
      name: 'Agente Local',
    },
  ]);

  // 2. Criar contatos de teste
  await db.insert(contacts).values([
    {
      name: 'Cliente Teste 1',
      phone: '5524999999001',
      chatId: 'whatsapp_test_001',
      document: '111.111.111-11',
      evolutionInstance: 'principal',
    },
    {
      name: 'Cliente Teste 2',
      phone: '5524999999002',
      chatId: 'whatsapp_test_002',
      evolutionInstance: 'principal',
    },
  ]);

  console.log('✅ Seed concluído!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
```

Executar:
```bash
npx tsx scripts/seed-dev.ts
```

---

## 🔐 Variáveis de Ambiente

### **Criar `.env.local`**

```bash
# ============================================
# AMBIENTE DE DESENVOLVIMENTO LOCAL
# ============================================

# === BASE DE DADOS ===
# PostgreSQL local (Docker)
DATABASE_URL=postgresql://postgres:lia_dev_2024@localhost:5432/lia_cortex_dev

# === REDIS/QUEUE ===
# Redis local (Docker) - sem TLS
UPSTASH_REDIS_REST_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development

# === UPSTASH VECTOR (manter cloud) ===
UPSTASH_VECTOR_URL=https://your-vector-instance.upstash.io
UPSTASH_VECTOR_TOKEN=your_token_here

# === OPENAI ===
OPENAI_API_KEY=sk-your-key-here

# === EVOLUTION API ===
# Opção 1: Usar instância de produção (cuidado!)
EVOLUTION_API_KEY=your_key_here
EVOLUTION_API_INSTANCE=your_instance_here

# Opção 2: Criar instância separada de testes
# EVOLUTION_API_KEY=test_key_here
# EVOLUTION_API_INSTANCE=test_instance_here

# === SESSION ===
SESSION_SECRET=dev_secret_change_in_production

# === FRONTEND ===
VITE_API_URL=http://localhost:5000
```

### **Carregar variáveis**

Adicione no `package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch server/index.ts",
    "dev:local": "NODE_ENV=development dotenv -e .env.local -- tsx watch server/index.ts"
  }
}
```

Instalar dotenv-cli:
```bash
npm install -D dotenv-cli
```

Iniciar com variáveis locais:
```bash
npm run dev:local
```

---

## ✅ Testes e Validação

### **1. Verificar Conexões**

Crie `scripts/test-connections.ts`:

```typescript
import { db } from '../server/db';
import Redis from 'ioredis';

async function testConnections() {
  console.log('🧪 Testando conexões...\n');

  // 1. PostgreSQL
  try {
    const result = await db.execute('SELECT version() as version');
    console.log('✅ PostgreSQL:', result.rows[0]?.version);
  } catch (err) {
    console.error('❌ PostgreSQL falhou:', err);
  }

  // 2. Redis
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
    
    await redis.set('test_key', 'test_value');
    const value = await redis.get('test_key');
    
    if (value === 'test_value') {
      console.log('✅ Redis: Conectado e funcionando');
    }
    
    await redis.del('test_key');
    await redis.quit();
  } catch (err) {
    console.error('❌ Redis falhou:', err);
  }

  // 3. Upstash Vector
  try {
    const vectorUrl = process.env.UPSTASH_VECTOR_URL;
    const vectorToken = process.env.UPSTASH_VECTOR_TOKEN;
    
    if (vectorUrl && vectorToken) {
      console.log('✅ Upstash Vector: Configurado');
    } else {
      console.log('⚠️ Upstash Vector: Não configurado');
    }
  } catch (err) {
    console.error('❌ Upstash Vector falhou:', err);
  }

  console.log('\n✅ Testes concluídos!');
  process.exit(0);
}

testConnections().catch(err => {
  console.error('❌ Erro nos testes:', err);
  process.exit(1);
});
```

Executar:
```bash
npx tsx scripts/test-connections.ts
```

### **2. Monitorar Performance**

```bash
# PostgreSQL - conexões ativas
docker exec -it lia-postgres psql -U postgres -d lia_cortex_dev -c "SELECT count(*) FROM pg_stat_activity;"

# Redis - info
docker exec -it lia-redis redis-cli INFO stats

# Redis - monitorar comandos em tempo real
docker exec -it lia-redis redis-cli MONITOR
```

---

## 🐛 Troubleshooting

### **Problema: "Connection refused" no PostgreSQL**

```bash
# Verificar se container está rodando
docker ps | grep postgres

# Verificar logs
docker logs lia-postgres

# Reiniciar
docker-compose restart postgres

# Verificar porta
netstat -an | grep 5432  # Linux/Mac
netstat -ano | findstr 5432  # Windows
```

### **Problema: "Connection refused" no Redis**

```bash
# Verificar container
docker ps | grep redis

# Testar conexão
docker exec -it lia-redis redis-cli ping

# Reiniciar
docker-compose restart redis
```

### **Problema: BullMQ não processa jobs**

```bash
# 1. Verificar configuração Redis
# server/queue.ts ou similar

# Garantir que TLS está DESABILITADO para local:
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  // NÃO usar TLS em desenvolvimento:
  // tls: undefined, 
};
```

### **Problema: Drizzle não encontra tabelas**

```bash
# 1. Verificar se schema foi aplicado
npm run db:push

# 2. Verificar manualmente
docker exec -it lia-postgres psql -U postgres -d lia_cortex_dev

# No PostgreSQL:
\dt  # Listar tabelas
\d users  # Descrever tabela users
```

### **Problema: Porta já em uso**

```bash
# Descobrir processo usando porta 5432
lsof -i :5432  # Linux/Mac
netstat -ano | findstr 5432  # Windows

# Matar processo (cuidado!)
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows

# OU mudar porta no docker-compose.yml:
# ports:
#   - "5433:5432"  # Usar 5433 externamente
```

---

## 📊 Comparação: Local vs Cloud

| Aspecto | Cloud (Neon/Upstash) | Local (Docker) |
|---------|---------------------|----------------|
| **Setup inicial** | Zero config | 5-10 minutos |
| **Performance** | Latência de rede (~50-200ms) | Latência local (<5ms) |
| **Custo** | Tier grátis OK | Zero |
| **Dados** | Persistentes | Podem ser apagados |
| **Internet** | Necessária | Opcional |
| **Backup** | Automático | Manual |
| **Escalabilidade** | Automática | Limitada ao seu PC |
| **Debugging** | Limitado | Acesso total |

---

## 🎯 Workflow Recomendado

### **Desenvolvimento Diário:**
```bash
# 1. Iniciar infra local
docker-compose up -d

# 2. Verificar saúde
docker-compose ps

# 3. Rodar aplicação
npm run dev:local

# 4. Ao finalizar
docker-compose stop
```

### **Limpeza Semanal:**
```bash
# Limpar cache Redis
docker exec -it lia-redis redis-cli FLUSHALL

# Resetar banco (cuidado!)
docker-compose down -v
docker-compose up -d
npm run db:push
npx tsx scripts/seed-dev.ts
```

---

## 📚 Próximos Passos

1. ✅ Configurar Docker Compose
2. ✅ Testar conexões
3. ✅ Aplicar schema Drizzle
4. ✅ Popular dados de teste
5. ⏭️ **Opcional:** Configurar pgvector (ver `GUIA_PGVECTOR.md` - em breve)

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:
1. Verificar logs: `docker-compose logs -f`
2. Revisar variáveis de ambiente: `echo $DATABASE_URL`
3. Testar conexões: `npx tsx scripts/test-connections.ts`
4. Consultar documentação oficial:
   - [PostgreSQL](https://www.postgresql.org/docs/15/)
   - [Redis](https://redis.io/docs/)
   - [Drizzle ORM](https://orm.drizzle.team/docs/overview)

---

**Criado em:** Novembro 2025  
**Versão:** 1.0.0  
**Compatível com:** LIA CORTEX v2.x
