# 🚀 Desenvolvimento Local - Quick Start

Guia rápido para iniciar o LIA CORTEX em ambiente de desenvolvimento local.

## 📖 Documentação Completa

Para instruções detalhadas, consulte: **[GUIA_DESENVOLVIMENTO_LOCAL.md](./GUIA_DESENVOLVIMENTO_LOCAL.md)**

---

## ⚡ Quick Start (5 minutos)

### **1. Pré-requisitos**
```bash
# Verificar se Docker está instalado
docker --version
docker-compose --version
```

Se não tiver Docker: [Instalar Docker Desktop](https://www.docker.com/products/docker-desktop/)

### **2. Configurar Variáveis de Ambiente**
```bash
# Copiar template
cp .env.local.example .env.local

# Editar e preencher as chaves:
# - UPSTASH_VECTOR_URL e TOKEN (obrigatório)
# - OPENAI_API_KEY (obrigatório)
# - EVOLUTION_API_KEY e INSTANCE (opcional para testes locais)
nano .env.local  # ou seu editor preferido
```

### **3. Iniciar Infraestrutura**
```bash
# Subir PostgreSQL + Redis
docker-compose up -d

# Verificar status
docker-compose ps
```

### **4. Preparar Banco de Dados**
```bash
# Aplicar schema
npm run db:push

# Popular dados de teste
npm run seed:dev
```

### **5. Testar Conexões**
```bash
npm run test:connections
```

Você deve ver:
```
✅ PostgreSQL: Conectado!
✅ Redis: Conectado!
✅ Upstash Vector: Configurado
✅ OpenAI: API Key configurada
```

### **6. Iniciar Aplicação**
```bash
npm run dev:local
```

Acesse: **http://localhost:5000**

**Credenciais de teste:**
- Admin: `admin_dev` / `abc123`
- Supervisor: `supervisor_dev` / `abc123`
- Agente: `agent_dev` / `abc123`

---

## 🛠️ Comandos Úteis

### **Infraestrutura**
```bash
# Iniciar containers
docker-compose up -d

# Parar containers
docker-compose stop

# Reiniciar containers
docker-compose restart

# Ver logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Parar e deletar tudo (CUIDADO!)
docker-compose down -v
```

### **Banco de Dados**
```bash
# Aplicar mudanças no schema
npm run db:push

# Forçar aplicar (se houver conflitos)
npm run db:push -- --force

# Recriar dados de teste
npm run seed:dev

# Acessar PostgreSQL via CLI
docker exec -it lia-postgres psql -U postgres -d lia_cortex_dev
```

### **Redis**
```bash
# Acessar Redis CLI
docker exec -it lia-redis redis-cli

# Limpar cache Redis
docker exec -it lia-redis redis-cli FLUSHALL

# Ver estatísticas
docker exec -it lia-redis redis-cli INFO stats
```

---

## 🌐 Interfaces Web

Com os containers rodando:

- **Adminer (PostgreSQL):** http://localhost:8080
  - Servidor: `postgres`
  - Usuário: `postgres`
  - Senha: `lia_dev_2024`
  - Base: `lia_cortex_dev`

- **Redis Commander:** http://localhost:8081

---

## 🐛 Troubleshooting

### Porta 5432 já em uso
```bash
# Descobrir processo
lsof -i :5432  # Mac/Linux
netstat -ano | findstr 5432  # Windows

# Matar processo OU mudar porta no docker-compose.yml
```

### Containers não iniciam
```bash
# Ver logs de erro
docker-compose logs

# Recriar containers
docker-compose down
docker-compose up -d
```

### Banco de dados vazio
```bash
# Verificar se schema foi aplicado
npm run db:push

# Popular dados novamente
npm run seed:dev
```

### BullMQ não processa jobs
```bash
# Verificar se Redis está ok
docker exec -it lia-redis redis-cli ping  # Deve retornar PONG

# Verificar conexão no código
# Garantir que TLS está desabilitado para Redis local
```

---

## 📊 Estrutura de Arquivos

```
├── docker-compose.yml          # Infraestrutura local (PostgreSQL + Redis)
├── .env.local.example          # Template de variáveis de ambiente
├── scripts/
│   ├── init-db.sql            # Script de inicialização do PostgreSQL
│   ├── seed-dev.ts            # Popular banco com dados de teste
│   └── test-connections.ts    # Testar conexões com serviços
└── GUIA_DESENVOLVIMENTO_LOCAL.md  # Documentação completa
```

---

## 🎯 Próximos Passos

1. ✅ Infraestrutura rodando
2. ✅ Banco de dados configurado
3. ⏭️ Começar desenvolvimento!

Para dúvidas ou problemas, consulte **[GUIA_DESENVOLVIMENTO_LOCAL.md](./GUIA_DESENVOLVIMENTO_LOCAL.md)** 📖
