# Exportação de Banco de Dados e Replicação da Plataforma LIA CORTEX

## Visão Geral

Este documento descreve como exportar o banco de dados PostgreSQL (Neon) e replicar a plataforma LIA CORTEX completa em um novo ambiente, seja para backup, disaster recovery, staging, ou implantação para novo cliente.

## Cenários de Uso

1. **Backup Regular**: Exportação periódica para segurança
2. **Migração de Ambiente**: Dev → Staging → Production
3. **Disaster Recovery**: Restauração após falha
4. **Novo Cliente**: Deploy completo da plataforma
5. **Clone para Testes**: Ambiente de teste isolado

---

## 1. EXPORTAÇÃO DO BANCO DE DADOS

### 1.1 Exportar Apenas Schema (Estrutura)

**Quando usar:** Novo cliente ou ambiente limpo sem dados históricos.

```bash
# Conectar ao banco de dados Neon
# Substituir valores pelos seus dados reais

export DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Exportar apenas a estrutura (schema)
pg_dump $DATABASE_URL \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=exports/lia-cortex-schema-$(date +%Y%m%d).sql

# Resultado: lia-cortex-schema-20251118.sql
```

**O que está incluído:**
- ✅ Todas as tabelas
- ✅ Índices
- ✅ Foreign keys
- ✅ Constraints
- ✅ Enums (tipos personalizados)
- ❌ Dados (registros)

---

### 1.2 Exportar Schema + Dados Essenciais

**Quando usar:** Migração completa preservando configurações e dados operacionais.

```bash
# Exportar schema + dados de tabelas específicas
pg_dump $DATABASE_URL \
  --no-owner \
  --no-privileges \
  --file=exports/lia-cortex-full-$(date +%Y%m%d).sql

# Resultado: lia-cortex-full-20251118.sql (inclui TODOS os dados)
```

**⚠️ ATENÇÃO - LGPD/GDPR:**
Este arquivo conterá:
- ✅ Configurações de sistema
- ✅ Usuários e permissões
- ⚠️ **Dados de clientes (CPF, conversas, etc.)**
- ⚠️ **Informações sensíveis**

**Proteção obrigatória:**
```bash
# Criptografar o arquivo
gpg --symmetric --cipher-algo AES256 exports/lia-cortex-full-20251118.sql

# Resultado: lia-cortex-full-20251118.sql.gpg
# Deletar arquivo original
rm exports/lia-cortex-full-20251118.sql
```

---

### 1.3 Exportar Tabelas Seletivas

**Quando usar:** Exportar apenas dados de configuração, sem dados de clientes.

```bash
# Exportar apenas tabelas de configuração (sem dados sensíveis)
pg_dump $DATABASE_URL \
  --no-owner \
  --no-privileges \
  --table=users \
  --table=prompt_templates \
  --table=sales_plans \
  --table=announcements \
  --table=massive_failures \
  --table=whatsapp_instances \
  --file=exports/lia-cortex-config-$(date +%Y%m%d).sql

# Resultado: lia-cortex-config-20251118.sql
```

**Tabelas seguras (SEM dados de clientes):**
- ✅ `users` - Usuários do sistema
- ✅ `prompt_templates` - Prompts dos assistentes
- ✅ `sales_plans` - Planos comerciais
- ✅ `announcements` - Comunicados internos
- ✅ `massive_failures` - Registro de falhas
- ✅ `whatsapp_instances` - Configurações WhatsApp

**Tabelas sensíveis (COM dados de clientes - LGPD):**
- ❌ `conversations` - Conversas
- ❌ `messages` - Mensagens
- ❌ `contacts` - Contatos
- ❌ `voice_collection_targets` - Dados de cobrança
- ❌ `context_quality_logs` - Logs com dados
- ❌ `activity_logs` - Logs de atividade

---

### 1.4 Script Automatizado de Backup

```bash
#!/bin/bash
# backup-database.sh

set -e

# Configurações
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="${DATABASE_URL}"

# Criar diretório se não existir
mkdir -p $BACKUP_DIR

echo "🔄 Iniciando backup do banco de dados LIA CORTEX..."

# 1. Schema apenas (sempre)
echo "📋 Exportando schema..."
pg_dump $DATABASE_URL \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=$BACKUP_DIR/schema-$DATE.sql

# 2. Dados de configuração (sem LGPD)
echo "⚙️  Exportando configurações..."
pg_dump $DATABASE_URL \
  --no-owner \
  --no-privileges \
  --data-only \
  --table=users \
  --table=prompt_templates \
  --table=sales_plans \
  --table=announcements \
  --table=massive_failures \
  --file=$BACKUP_DIR/config-$DATE.sql

# 3. Backup completo (OPCIONAL - criptografado)
if [ "$FULL_BACKUP" = "true" ]; then
  echo "💾 Exportando backup completo (LGPD - será criptografado)..."
  pg_dump $DATABASE_URL \
    --no-owner \
    --no-privileges \
    --file=$BACKUP_DIR/full-$DATE.sql
  
  # Criptografar
  echo "🔒 Criptografando backup completo..."
  gpg --batch --yes --passphrase="$BACKUP_PASSWORD" \
    --symmetric --cipher-algo AES256 \
    $BACKUP_DIR/full-$DATE.sql
  
  # Deletar arquivo não criptografado
  rm $BACKUP_DIR/full-$DATE.sql
  
  echo "✅ Backup completo criptografado: full-$DATE.sql.gpg"
fi

# 4. Compactar backups
echo "📦 Compactando backups..."
tar -czf $BACKUP_DIR/lia-cortex-backup-$DATE.tar.gz \
  $BACKUP_DIR/schema-$DATE.sql \
  $BACKUP_DIR/config-$DATE.sql

# Limpar arquivos temporários
rm $BACKUP_DIR/schema-$DATE.sql
rm $BACKUP_DIR/config-$DATE.sql

echo "✅ Backup concluído: lia-cortex-backup-$DATE.tar.gz"
echo "📊 Tamanho: $(du -h $BACKUP_DIR/lia-cortex-backup-$DATE.tar.gz | cut -f1)"

# 5. Upload para cloud (opcional)
if [ "$UPLOAD_TO_S3" = "true" ]; then
  echo "☁️  Fazendo upload para S3..."
  aws s3 cp $BACKUP_DIR/lia-cortex-backup-$DATE.tar.gz \
    s3://$S3_BUCKET/backups/
  echo "✅ Upload concluído"
fi

# 6. Limpar backups antigos (manter últimos 30 dias)
find $BACKUP_DIR -name "lia-cortex-backup-*.tar.gz" -mtime +30 -delete
echo "🧹 Backups antigos removidos (>30 dias)"

echo "✅ Processo de backup finalizado com sucesso!"
```

**Agendar backup diário:**
```bash
# Crontab - executar todo dia às 3h da manhã
0 3 * * * /path/to/backup-database.sh >> /var/log/lia-backup.log 2>&1
```

---

## 2. IMPORTAÇÃO DO BANCO DE DADOS

### 2.1 Importar em Novo Ambiente (Limpo)

```bash
# Pré-requisitos:
# 1. Criar novo banco de dados Neon
# 2. Obter connection string

export NEW_DATABASE_URL="postgresql://user:password@ep-yyyy.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 1. Descompactar backup
tar -xzf backups/lia-cortex-backup-20251118.tar.gz -C backups/

# 2. Importar schema
echo "📋 Importando schema..."
psql $NEW_DATABASE_URL -f backups/schema-20251118.sql

# 3. Importar configurações
echo "⚙️  Importando configurações..."
psql $NEW_DATABASE_URL -f backups/config-20251118.sql

echo "✅ Importação concluída!"
```

### 2.2 Importar Backup Completo (Criptografado)

```bash
# 1. Descriptografar
gpg --decrypt backups/full-20251118.sql.gpg > backups/full-20251118.sql

# 2. Importar
psql $NEW_DATABASE_URL -f backups/full-20251118.sql

# 3. Deletar arquivo descriptografado (segurança)
rm backups/full-20251118.sql

echo "✅ Importação completa concluída!"
```

### 2.3 Restauração Seletiva (Apenas uma Tabela)

```bash
# Restaurar apenas usuários, por exemplo
pg_restore $NEW_DATABASE_URL \
  --table=users \
  --data-only \
  backups/config-20251118.sql
```

---

## 3. REPLICAÇÃO COMPLETA DA PLATAFORMA

### 3.1 Checklist Completo

#### **Fase 1: Preparação (30 min)**

- [ ] Criar novo projeto no Replit
- [ ] Clonar repositório Git (se aplicável)
- [ ] Criar banco de dados Neon novo
- [ ] Criar conta Upstash Redis
- [ ] Criar conta Upstash Vector
- [ ] Configurar Evolution API (3 instâncias)
- [ ] Obter chaves OpenAI

#### **Fase 2: Configuração de Variáveis (15 min)**

- [ ] Copiar `.env.example` → `.env`
- [ ] Configurar todas as variáveis (ver seção 3.2)
- [ ] Validar conexões

#### **Fase 3: Banco de Dados (10 min)**

- [ ] Importar schema
- [ ] Importar dados de configuração
- [ ] Executar migrations (se necessário)
- [ ] Validar tabelas criadas

#### **Fase 4: Instalação de Pacotes (5 min)**

- [ ] `npm install` (executado automaticamente no Replit)
- [ ] Verificar `package.json`

#### **Fase 5: Inicialização (10 min)**

- [ ] Executar `npm run dev`
- [ ] Verificar logs de inicialização
- [ ] Validar assistentes OpenAI configurados
- [ ] Testar conexão com Redis
- [ ] Testar conexão com PostgreSQL

#### **Fase 6: Validação (30 min)**

- [ ] Criar usuário admin
- [ ] Fazer login no sistema
- [ ] Testar recebimento de mensagem WhatsApp
- [ ] Validar resposta da IA
- [ ] Testar transferência para humano
- [ ] Verificar dashboard de monitoramento

**Tempo Total Estimado:** ~1h40min

---

### 3.2 Variáveis de Ambiente Necessárias

```bash
# .env - Template Completo

# ==========================================
# DATABASE
# ==========================================
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# ==========================================
# OPENAI
# ==========================================
OPENAI_API_KEY="sk-proj-xxxxx"

# IDs dos Assistants (criar novos ou usar existentes)
ASSISTANT_ID_CORTEX="asst_xxxxx"           # Recepcionista
ASSISTANT_ID_APRESENTACAO="asst_xxxxx"    # Apresentação
ASSISTANT_ID_COMERCIAL="asst_xxxxx"       # Comercial
ASSISTANT_ID_FINANCEIRO="asst_xxxxx"      # Financeiro
ASSISTANT_ID_SUPORTE="asst_xxxxx"         # Suporte
ASSISTANT_ID_OUVIDORIA="asst_xxxxx"       # Ouvidoria
ASSISTANT_ID_CANCELAMENTO="asst_xxxxx"    # Cancelamento
ASSISTANT_ID_COBRANCA="asst_xxxxx"        # Cobrança

# ==========================================
# UPSTASH REDIS
# ==========================================
UPSTASH_REDIS_REST_URL="https://xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AxxxYYY..."

# ==========================================
# UPSTASH VECTOR (RAG)
# ==========================================
UPSTASH_VECTOR_REST_URL="https://xxxxx.upstash.io"
UPSTASH_VECTOR_REST_TOKEN="AxxxYYY..."

# ==========================================
# EVOLUTION API - Instância 1 (Leads)
# ==========================================
EVOLUTION_API_URL_LEADS="https://evolutionapi.trtelecom.net"
EVOLUTION_API_KEY_LEADS="xxxxx"
EVOLUTION_WEBHOOK_URL="https://seu-replit.replit.dev/webhook/evolution/Leads"

# ==========================================
# EVOLUTION API - Instância 2 (Cobrança)
# ==========================================
EVOLUTION_API_URL_COBRANCA="https://evolutionapi.trtelecom.net"
EVOLUTION_API_KEY_COBRANCA="xxxxx"

# ==========================================
# EVOLUTION API - Instância 3 (Principal)
# ==========================================
EVOLUTION_API_URL_PRINCIPAL="https://evolutionapi.trtelecom.net"
EVOLUTION_API_KEY_PRINCIPAL="xxxxx"

# ==========================================
# FALLBACK (instância padrão)
# ==========================================
EVOLUTION_API_URL="https://evolutionapi.trtelecom.net"
EVOLUTION_API_KEY="xxxxx"
EVOLUTION_API_INSTANCE="Leads"

# ==========================================
# CRM / ERP INTEGRATION
# ==========================================
CRM_API_URL="https://crm.trtelecom.net/api"
CRM_API_KEY="xxxxx"

# ==========================================
# TWILIO (SMS/WhatsApp Templates)
# ==========================================
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxxx"
TWILIO_PHONE_NUMBER="+5524999999999"

# ==========================================
# SESSION / SECURITY
# ==========================================
SESSION_SECRET="gerar-string-aleatoria-segura-aqui"

# ==========================================
# NODE ENVIRONMENT
# ==========================================
NODE_ENV="production"  # ou "development"
PORT=5000
```

**Como gerar secrets seguros:**
```bash
# Gerar SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 3.3 Script de Validação Pós-Deploy

```bash
#!/bin/bash
# validate-deployment.sh

set -e

echo "🔍 Validando deployment da plataforma LIA CORTEX..."

# 1. Testar conexão com banco de dados
echo "📊 Testando PostgreSQL..."
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;" > /dev/null
if [ $? -eq 0 ]; then
  echo "  ✅ PostgreSQL OK"
else
  echo "  ❌ PostgreSQL FALHOU"
  exit 1
fi

# 2. Testar Redis
echo "📦 Testando Upstash Redis..."
curl -s -X GET "$UPSTASH_REDIS_REST_URL/ping" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" | grep -q "PONG"
if [ $? -eq 0 ]; then
  echo "  ✅ Redis OK"
else
  echo "  ❌ Redis FALHOU"
  exit 1
fi

# 3. Testar OpenAI
echo "🤖 Testando OpenAI..."
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | grep -q "gpt-4"
if [ $? -eq 0 ]; then
  echo "  ✅ OpenAI OK"
else
  echo "  ❌ OpenAI FALHOU"
  exit 1
fi

# 4. Testar Evolution API
echo "📱 Testando Evolution API (Leads)..."
curl -s "$EVOLUTION_API_URL_LEADS/instance/connectionState/Leads" \
  -H "apikey: $EVOLUTION_API_KEY_LEADS" | grep -q "open"
if [ $? -eq 0 ]; then
  echo "  ✅ Evolution API OK"
else
  echo "  ⚠️  Evolution API não conectado (pode ser normal)"
fi

# 5. Testar aplicação web
echo "🌐 Testando aplicação web..."
curl -s http://localhost:5000/api/health | grep -q "ok"
if [ $? -eq 0 ]; then
  echo "  ✅ Aplicação Web OK"
else
  echo "  ❌ Aplicação Web FALHOU"
  exit 1
fi

echo ""
echo "✅ Todas as validações passaram com sucesso!"
echo "🚀 Plataforma LIA CORTEX está pronta para uso"
```

---

## 4. MIGRAÇÃO USANDO DRIZZLE ORM

### 4.1 Gerar Schema do Zero

Se você tem acesso ao código fonte:

```bash
# 1. Instalar dependências
npm install

# 2. Gerar schema automaticamente
npm run db:push

# Isso criará todas as tabelas automaticamente
# baseado no arquivo shared/schema.ts
```

### 4.2 Sincronizar Schema Existente

```bash
# Se já tem dados e quer apenas ajustar schema:
npm run db:push --force

# CUIDADO: --force pode sobrescrever dados
# Use apenas se tiver backup!
```

---

## 5. DADOS INICIAIS (SEED)

### 5.1 Criar Usuário Admin

```sql
-- Executar no banco de dados novo

-- 1. Criar usuário admin
INSERT INTO users (id, username, password_hash, name, role, created_at)
VALUES (
  gen_random_uuid(),
  'admin',
  '$2a$10$YourBcryptHashHere',  -- Gerar com bcrypt
  'Administrador',
  'ADMIN',
  NOW()
);

-- 2. Criar planos padrão
INSERT INTO sales_plans (name, price, description, features, created_at)
VALUES
  ('Básico 50MB', 79.90, 'Plano básico para uso residencial', '["50MB de velocidade", "Suporte 24h"]', NOW()),
  ('Intermediário 100MB', 99.90, 'Plano intermediário', '["100MB de velocidade", "WiFi grátis"]', NOW()),
  ('Premium 200MB', 149.90, 'Plano premium', '["200MB de velocidade", "Instalação grátis"]', NOW());
```

**Gerar hash de senha com bcrypt:**
```javascript
// Node.js
const bcrypt = require('bcryptjs');
const password = 'SuaSenhaSegura123!';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

### 5.2 Script de Seed Automatizado

```typescript
// scripts/seed-database.ts

import { db } from '../server/db';
import { users, salesPlans } from '../shared/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...');
  
  // 1. Criar usuário admin
  const adminPassword = bcrypt.hashSync('Admin@123', 10);
  
  await db.insert(users).values({
    username: 'admin',
    passwordHash: adminPassword,
    name: 'Administrador',
    role: 'ADMIN',
  });
  
  console.log('✅ Usuário admin criado');
  
  // 2. Criar planos
  await db.insert(salesPlans).values([
    {
      name: 'Básico 50MB',
      price: 79.90,
      description: 'Plano básico para uso residencial',
      features: ['50MB de velocidade', 'Suporte 24h'],
    },
    {
      name: 'Intermediário 100MB',
      price: 99.90,
      description: 'Plano intermediário',
      features: ['100MB de velocidade', 'WiFi grátis'],
    },
    {
      name: 'Premium 200MB',
      price: 149.90,
      description: 'Plano premium',
      features: ['200MB de velocidade', 'Instalação grátis'],
    },
  ]);
  
  console.log('✅ Planos criados');
  console.log('✅ Seed concluído com sucesso!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Erro no seed:', error);
  process.exit(1);
});
```

**Executar:**
```bash
npx tsx scripts/seed-database.ts
```

---

## 6. DISASTER RECOVERY

### 6.1 Plano de Recuperação

**RTO (Recovery Time Objective):** 2 horas  
**RPO (Recovery Point Objective):** 24 horas (backup diário)

#### Etapas de Recuperação:

1. **Identificar Falha** (5 min)
   - Verificar logs
   - Identificar causa raiz

2. **Provisionar Novo Ambiente** (15 min)
   - Criar novo banco Neon
   - Configurar Upstash Redis/Vector

3. **Restaurar Backup** (30 min)
   - Descompactar último backup
   - Importar schema + dados

4. **Validar Sistema** (15 min)
   - Executar testes automatizados
   - Verificar conectividade

5. **Atualizar DNS/Webhooks** (10 min)
   - Apontar Evolution API para novo endpoint
   - Atualizar webhooks

6. **Monitorar** (contínuo)
   - Acompanhar métricas
   - Validar funcionamento

**Tempo Total:** ~1h15min

---

## 7. EXPORTAÇÃO PARA NOVO CLIENTE

### 7.1 Template de Deploy

```yaml
# deploy-template.yaml

client_name: "Nome do Cliente"
date: "2025-11-18"

infrastructure:
  database:
    provider: "Neon PostgreSQL"
    size: "Free Tier / Pro"
    backup_enabled: true
  
  redis:
    provider: "Upstash Redis"
    plan: "Free / Pro"
  
  vector:
    provider: "Upstash Vector"
    plan: "Free / Pro"
  
  hosting:
    provider: "Replit"
    plan: "Core / Teams"

whatsapp:
  instances:
    - name: "Leads"
      phone: "+55 24 99999-0001"
    - name: "Cobranca"
      phone: "+55 24 99999-0002"
    - name: "Principal"
      phone: "+55 24 99999-0003"

openai:
  assistants:
    - id: "asst_xxxxx"
      name: "Cortex (Recepcionista)"
    - id: "asst_yyyyy"
      name: "Comercial"
    # ... outros

customizations:
  - "Alterar logo no frontend"
  - "Customizar cores (index.css)"
  - "Ajustar prompts dos assistentes"
  - "Configurar planos comerciais"
  - "Integrar com CRM do cliente"
```

### 7.2 Checklist de Customização

**Frontend:**
- [ ] Logo da empresa (`attached_assets/logo.png`)
- [ ] Cores do tema (`client/src/index.css`)
- [ ] Nome da empresa (título, meta tags)
- [ ] Favicon

**Backend:**
- [ ] Prompts dos assistentes (adaptar ao negócio)
- [ ] Planos comerciais
- [ ] Números de WhatsApp
- [ ] Integração com CRM/ERP específico

**Configurações:**
- [ ] Timezone (pt-BR já configurado)
- [ ] Moeda (R$ já configurado)
- [ ] Horário de atendimento

---

## 8. SEGURANÇA E COMPLIANCE

### 8.1 LGPD - Anonimização de Dados

Antes de exportar backups para ambientes de teste:

```sql
-- Script de anonimização
-- EXECUTAR APENAS EM AMBIENTES DE TESTE/DEV!

-- Anonimizar CPFs
UPDATE conversations
SET client_document = CONCAT('***', SUBSTRING(client_document FROM 4 FOR 3), '***')
WHERE client_document IS NOT NULL;

-- Anonimizar nomes
UPDATE conversations
SET client_name = CONCAT('Cliente ', id::text)
WHERE client_name IS NOT NULL;

-- Remover mensagens reais (manter estrutura)
UPDATE messages
SET content = 'Mensagem de teste anonimizada'
WHERE role = 'user';

-- Remover logs sensíveis
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE context_quality_logs;
```

### 8.2 Criptografia de Backups

**Sempre** criptografar backups que contenham dados reais:

```bash
# Criptografar com GPG
gpg --symmetric --cipher-algo AES256 backup.sql

# Criptografar com senha específica
gpg --batch --yes \
  --passphrase="SenhaForte123!" \
  --symmetric \
  --cipher-algo AES256 \
  backup.sql

# Descriptografar
gpg --decrypt backup.sql.gpg > backup.sql
```

---

## 9. MONITORAMENTO PÓS-DEPLOY

### 9.1 Health Checks

```bash
# 1. Endpoint de saúde
curl http://localhost:5000/api/health

# Resposta esperada:
# {"status":"ok","database":"connected","redis":"connected"}

# 2. Verificar assistentes OpenAI
curl http://localhost:5000/api/admin/assistants/status

# 3. Verificar filas Redis
curl http://localhost:5000/api/admin/queues/status
```

### 9.2 Métricas Críticas

Monitorar nas primeiras 24h:

- **Taxa de erro:** < 1%
- **Latência P95:** < 30s
- **WhatsApp delivery rate:** > 98%
- **Uptime:** > 99.5%

---

## 10. TROUBLESHOOTING

### Problema: Assistants não encontrados

```bash
# Erro: "Assistant asst_xxxxx not found"

# Solução: Criar novos assistants ou usar IDs existentes
# Ver: docs/OPENAI_ASSISTANTS_SETUP.md (criar este doc se necessário)
```

### Problema: Erro de conexão Redis

```bash
# Erro: "ECONNREFUSED"

# Solução: Verificar variáveis
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# Testar conexão manual
curl "$UPSTASH_REDIS_REST_URL/ping" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

### Problema: WhatsApp não conecta

```bash
# Verificar status da instância
curl "$EVOLUTION_API_URL_LEADS/instance/connectionState/Leads" \
  -H "apikey: $EVOLUTION_API_KEY_LEADS"

# Se necessário, reiniciar instância
curl -X PUT "$EVOLUTION_API_URL_LEADS/instance/restart/Leads" \
  -H "apikey: $EVOLUTION_API_KEY_LEADS"
```

---

## 11. COMANDOS ÚTEIS

```bash
# Verificar tamanho do banco de dados
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('neondb'));"

# Listar todas as tabelas
psql $DATABASE_URL -c "\dt"

# Contar registros em tabela específica
psql $DATABASE_URL -c "SELECT COUNT(*) FROM conversations;"

# Ver últimas 10 conversas
psql $DATABASE_URL -c "SELECT id, client_name, status, created_at FROM conversations ORDER BY created_at DESC LIMIT 10;"

# Exportar query específica para CSV
psql $DATABASE_URL -c "COPY (SELECT * FROM users) TO STDOUT WITH CSV HEADER" > users.csv
```

---

## 12. CONTATOS E SUPORTE

**Documentação:**
- Este arquivo: `docs/DATABASE_EXPORT_AND_REPLICATION.md`
- Schema do banco: `shared/schema.ts`
- Variáveis de ambiente: `.env.example`

**Ferramentas:**
- PostgreSQL Client: `psql`
- Backup tool: `pg_dump`
- Restore tool: `pg_restore`

**Links Externos:**
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [Upstash Redis Docs](https://upstash.com/docs/redis)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

---

**Última Atualização:** 18/11/2025  
**Versão:** 1.0.0  
**Status:** 📝 Documentação Completa
