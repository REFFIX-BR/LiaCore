# 📥 Como Fazer Dump do Banco de Produção

Este guia explica como copiar todos os dados do banco de produção (Neon) para o banco local (Docker).

## 🚀 Método Rápido

### 1. Certifique-se de que o Docker está rodando

```bash
docker compose up -d postgres
```

### 2. Execute o script de sincronização

```bash
# Tornar executável (primeira vez)
chmod +x scripts/sync-from-production.sh

# Executar dump
./scripts/sync-from-production.sh
```

### 3. Confirme a importação

O script vai:
- ✅ Exportar todos os dados de produção (somente leitura)
- ⚠️  Pedir confirmação antes de substituir dados locais
- ✅ Importar no banco local
- ✅ Criar backup automático em `backups/`

## 🔧 Modo Automático (sem confirmação)

Se você quer fazer o dump sem precisar confirmar:

```bash
./scripts/sync-from-production.sh --auto
# ou
./scripts/sync-from-production.sh -y
```

## ⚙️ Configuração

### Opção 1: Usar variável de ambiente

Adicione no seu `.env`:

```bash
PRODUCTION_DATABASE_URL=postgresql://usuario:senha@host:porta/database?sslmode=require
```

### Opção 2: Passar URL diretamente

```bash
PRODUCTION_DATABASE_URL="sua-url-aqui" ./scripts/sync-from-production.sh
```

## 📋 O que o Script Faz

1. **Validação**: Verifica Docker e conexões
2. **Exportação**: Faz dump do banco de produção (somente leitura)
3. **Backup**: Salva arquivo SQL em `backups/production-backup-YYYYMMDD_HHMMSS.sql`
4. **Confirmação**: Pede confirmação antes de substituir dados locais
5. **Importação**: Importa dados no banco local
6. **Limpeza**: Remove backups antigos (mantém últimos 5)

## 🔒 Segurança

⚠️ **IMPORTANTE**: O script **NUNCA modifica** o banco de produção!

- `pg_dump` é uma operação **somente leitura**
- Apenas **lê** dados de produção
- Apenas **escreve** no banco local
- O banco de produção permanece **100% intacto**

## 📁 Arquivos Gerados

O script cria os seguintes arquivos em `backups/`:

- `production-backup-YYYYMMDD_HHMMSS.sql` - Backup completo
- `export-log-YYYYMMDD_HHMMSS.txt` - Log da exportação
- `import-log-YYYYMMDD_HHMMSS.txt` - Log da importação

## 🐛 Troubleshooting

### Erro: "Container não está rodando"

```bash
docker compose up -d postgres
```

### Erro: "Banco local não está acessível"

Verifique se o PostgreSQL está rodando:

```bash
docker ps | grep lia-postgres
docker logs lia-postgres
```

### Erro: "Falha ao exportar banco de produção"

1. Verifique a URL em `.env`:
   ```bash
   echo $PRODUCTION_DATABASE_URL
   ```

2. Teste conexão manual:
   ```bash
   docker run --rm postgres:16-alpine \
     psql "sua-url-aqui" -c "SELECT 1;"
   ```

3. Verifique logs:
   ```bash
   cat backups/export-log-*.txt
   ```

### Erro: "Falha ao importar no banco local"

1. Verifique logs:
   ```bash
   cat backups/import-log-*.txt
   ```

2. Verifique espaço em disco:
   ```bash
   df -h
   ```

3. Tente importar manualmente:
   ```bash
   docker cp backups/production-backup-*.sql lia-postgres:/tmp/
   docker exec lia-postgres psql -U postgres -d lia_cortex_dev -f /tmp/production-backup-*.sql
   ```

## 📊 Verificar Sincronização

Após o dump, você pode verificar se os dados foram importados:

```bash
# Conectar ao banco local
docker exec -it lia-postgres psql -U postgres -d lia_cortex_dev

# Verificar tabelas
\dt

# Contar registros
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM messages;
SELECT COUNT(*) FROM contacts;
```

## 🔄 Sincronização Regular

Para manter o banco local atualizado, execute periodicamente:

```bash
# Adicionar ao crontab (opcional)
# 0 2 * * * cd /caminho/do/projeto && ./scripts/sync-from-production.sh --auto
```

## 📚 Mais Informações

- Documentação completa: `scripts/SINCRONIZACAO.md`
- Script de verificação: `scripts/verify-sync.sh`

