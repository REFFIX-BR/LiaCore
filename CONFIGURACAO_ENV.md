# 📝 Guia de Configuração do .env

Este guia explica o que você precisa configurar no arquivo `.env` para o projeto funcionar.

## 🚀 Configuração Rápida (Mínimo Necessário)

### **1. Variáveis OBRIGATÓRIAS (Precisa preencher)**

#### **OpenAI API Key**
```env
OPENAI_API_KEY=sk-proj-sua-chave-aqui
```
- Onde conseguir: https://platform.openai.com/api-keys
- Sem isso, a aplicação não funciona

#### **Upstash Vector (RAG - Obrigatório)**
```env
UPSTASH_VECTOR_URL=https://sua-instancia.upstash.io
UPSTASH_VECTOR_TOKEN=seu-token-aqui
```
- Onde conseguir: https://console.upstash.com/
- Crie uma instância Vector Database
- Sem isso, o sistema de RAG não funciona

#### **Session Secret (Segurança)**
```env
SESSION_SECRET=gerar-string-aleatoria-aqui
```
- **Como gerar:**
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- Ou use qualquer string longa e aleatória
- **IMPORTANTE:** Mude isso em produção!

#### **Assistant IDs do OpenAI (7 assistentes)**
```env
CORTEX_ASSISTANT_ID=asst_xxxxx
OPENAI_APRESENTACAO_ASSISTANT_ID=asst_xxxxx
OPENAI_COMMRCIAL_ASSISTANT_ID=asst_xxxxx
OPENAI_FINANCEIRO_ASSISTANT_ID=asst_xxxxx
OPENAI_SUPORTE_ASSISTANT_ID=asst_xxxxx
OPENAI_OUVIDOIRA_ASSISTANT_ID=asst_xxxxx
OPENAI_CANCELAMENTO_ASSISTANT_ID=asst_xxxxx
```
- Onde conseguir: https://platform.openai.com/assistants
- Crie 7 assistentes no OpenAI Dashboard
- **ATENÇÃO:** Os nomes têm typos propositais (`COMMRCIAL` e `OUVIDOIRA`)

---

### **2. Variáveis JÁ CONFIGURADAS (Não precisa mudar)**

Estas já estão corretas para Docker local:

```env
# Banco de dados (já configurado para Docker)
DATABASE_URL=postgresql://postgres:lia_dev_2024@postgres:5432/lia_cortex_dev

# Redis local (já configurado para Docker)
REDIS_HOST=redis
REDIS_PORT=6379
UPSTASH_REDIS_HOST=redis
UPSTASH_REDIS_PORT=6379
UPSTASH_REDIS_PASSWORD=

# Porta da aplicação
PORT=5000
NODE_ENV=production
```

---

### **3. Variáveis OPCIONAIS (Dependem do seu uso)**

#### **Evolution API (WhatsApp)**
```env
EVOLUTION_API_URL=https://evolutionapi.trtelecom.net
EVOLUTION_API_KEY=sua-chave-aqui
EVOLUTION_INSTANCE=Leads
```
- Só precisa se for usar WhatsApp
- Se não usar, pode deixar como está ou remover

#### **Comercial API**
```env
COMERCIAL_API_URL=https://comercial.trtelecom.net
COMERCIAL_VENDEDOR_CODIGO=LIA
WHATSAPP_COLLECTION_DELAY_MS=120000
```
- Só precisa se integrar com API comercial
- Se não usar, pode deixar como está

#### **Frontend URL**
```env
VITE_API_URL=http://localhost:5000
```
- Para acesso local, deixe como está
- Se for acessar de outro lugar, use o IP do servidor:
  ```env
  VITE_API_URL=http://192.168.1.100:5000
  ```
- Ou se tiver domínio:
  ```env
  VITE_API_URL=https://app.seudominio.com
  ```

#### **Twilio (Opcional)**
```env
# Descomente se usar Twilio
# TWILIO_ACCOUNT_SID=ACxxxxx
# TWILIO_AUTH_TOKEN=xxxxx
# TWILIO_PHONE_NUMBER=+5524999999999
```

---

## 📋 Checklist de Configuração

Antes de rodar o deploy, verifique:

- [ ] `OPENAI_API_KEY` preenchido
- [ ] `UPSTASH_VECTOR_URL` preenchido
- [ ] `UPSTASH_VECTOR_TOKEN` preenchido
- [ ] `SESSION_SECRET` gerado e preenchido
- [ ] Todos os 7 Assistant IDs preenchidos
- [ ] `DATABASE_URL` configurado (já vem correto para Docker)
- [ ] `REDIS_HOST` e `UPSTASH_REDIS_HOST` configurados (já vem correto para Docker)
- [ ] `VITE_API_URL` ajustado se necessário

---

## 🔍 Como Verificar se Está Correto

Após configurar, você pode testar:

```bash
# Verificar se as variáveis estão sendo carregadas
docker compose exec app env | grep OPENAI_API_KEY

# Verificar health check
curl http://localhost:5000/api/health
```

---

## 💡 Dicas

1. **Não commite o .env no Git!** Ele já deve estar no `.gitignore`

2. **Para produção:** Use secrets management (Docker Secrets, Kubernetes Secrets, etc.)

3. **Se usar Redis Upstash (cloud) em vez de local:**
   - Comente as linhas do Redis local
   - Descomente e preencha as do Upstash

4. **Se usar PostgreSQL externo (não Docker):**
   - Altere o `DATABASE_URL` para sua URL externa

---

## 🆘 Problemas Comuns

### "OPENAI_API_KEY não encontrado"
- Verifique se preencheu no `.env`
- Verifique se não tem espaços extras
- Execute: `docker compose restart app`

### "Assistant ID não encontrado"
- Verifique se criou os 7 assistentes no OpenAI
- Verifique se os nomes estão corretos (com os typos!)
- Verifique se copiou os IDs corretos

### "Upstash Vector não configurado"
- Crie uma instância Vector no Upstash
- Copie a URL e o Token
- Verifique se não tem espaços extras

---

**Última atualização:** 2025-01-27

