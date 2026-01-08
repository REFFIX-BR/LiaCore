# 🔄 Sincronização de Banco de Dados

Este documento explica como sincronizar o banco de dados local com o banco de produção (Replit/Neon).

## 📋 Visão Geral

O script `sync-from-production.sh` permite copiar todos os dados do banco de produção para o banco local, mantendo o ambiente local atualizado.

### ⚠️ Segurança

**IMPORTANTE**: O script **NUNCA modifica** o banco de produção. Ele apenas:
- **Lê** dados do banco de produção (usando `pg_dump` - operação somente leitura)
- **Escreve** no banco local (substituindo os dados locais)

O banco de produção permanece **100% intacto**.

## 🚀 Pré-requisitos

### 1. Cliente PostgreSQL

Instale o cliente PostgreSQL no servidor:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql-client-15

# Ou verificar se já está instalado
pg_dump --version
psql --version
```

### 2. Docker em Execução

Certifique-se de que o banco local está rodando:

```bash
docker compose up -d postgres
```

### 3. Configuração do `.env`

Adicione a URL do banco de produção no arquivo `.env`:

```bash
PRODUCTION_DATABASE_URL=postgresql://neondb_owner:npg_X7wuH9centWi@ep-bold-wildflower-adga7o9q.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Ou use o valor padrão no script.

## 📝 Como Usar

### Executar Sincronização

```bash
# Tornar o script executável (primeira vez)
chmod +x scripts/sync-from-production.sh

# Executar sincronização
./scripts/sync-from-production.sh
```

### O que o Script Faz

1. **Validação**: Verifica se as ferramentas e conexões estão disponíveis
2. **Exportação**: Exporta todos os dados do banco de produção (somente leitura)
3. **Confirmação**: Pede confirmação antes de substituir dados locais
4. **Importação**: Importa os dados no banco local
5. **Limpeza**: Remove backups antigos (mantém últimos 5)
6. **Resumo**: Mostra informações sobre o backup criado

### Arquivos Gerados

O script cria os seguintes arquivos no diretório `backups/`:

- `production-backup-YYYYMMDD_HHMMSS.sql` - Backup completo do banco
- `export-log-YYYYMMDD_HHMMSS.txt` - Logs da exportação
- `import-log-YYYYMMDD_HHMMSS.txt` - Logs da importação

## ⚙️ Configuração Avançada

### Usar URL Personalizada

Você pode passar a URL de produção via variável de ambiente:

```bash
PRODUCTION_DATABASE_URL="sua-url-aqui" ./scripts/sync-from-production.sh
```

### Sincronização Automática (Cron)

Para sincronizar automaticamente, adicione ao crontab:

```bash
# Sincronizar diariamente às 2h da manhã
0 2 * * * cd /caminho/para/HealthLinkConnect && ./scripts/sync-from-production.sh >> /var/log/sync-db.log 2>&1
```

**⚠️ Atenção**: A sincronização automática substitui os dados locais sem confirmação. Use com cuidado!

## 🔍 Troubleshooting

### Erro: "pg_dump não encontrado"

Instale o cliente PostgreSQL:
```bash
sudo apt-get install postgresql-client-15
```

### Erro: "Banco local não está acessível"

Verifique se o Docker está rodando:
```bash
docker compose up -d postgres
docker compose ps
```

### Erro: "Falha ao exportar banco de produção"

- Verifique se a URL do banco está correta no `.env`
- Verifique se o banco de produção está acessível
- Verifique os logs em `backups/export-log-*.txt`

### Erro: "Falha ao importar no banco local"

- Verifique se o banco local está rodando
- Verifique se há espaço em disco suficiente
- Verifique os logs em `backups/import-log-*.txt`

## 📊 Monitoramento

### Verificar Tamanho dos Backups

```bash
du -sh backups/*
```

### Ver Última Sincronização

```bash
ls -lht backups/production-backup-*.sql | head -1
```

### Ver Logs de Erro

```bash
# Logs de exportação
tail -f backups/export-log-*.txt

# Logs de importação
tail -f backups/import-log-*.txt
```

## 🔐 Segurança

### Proteção do Banco de Produção

- O script usa `pg_dump`, que é **somente leitura**
- Nenhum comando de escrita é executado no banco de produção
- A URL de produção é usada apenas para leitura

### Proteção de Credenciais

- **NUNCA** commite o arquivo `.env` no Git
- O arquivo `.env` está no `.gitignore`
- Use variáveis de ambiente ou secrets management em produção

## 📚 Referências

- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL psql Documentation](https://www.postgresql.org/docs/current/app-psql.html)

