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

### Sincronização Automática

Para manter o banco local sempre atualizado com produção, você pode configurar sincronização automática:

#### Opção 1: Usando o Script de Configuração (Recomendado)

```bash
# Executar o assistente de configuração
./scripts/setup-auto-sync.sh
```

O script oferece opções de frequência:
- A cada 10 minutos
- A cada 20 minutos
- A cada 30 minutos
- A cada hora
- A cada 6 horas
- A cada 12 horas
- Diariamente (2h da manhã)
- Duas vezes por dia (2h e 14h)

#### Opção 2: Configuração Manual do Cron

Para sincronizar automaticamente, adicione ao crontab:

```bash
# Sincronizar diariamente às 2h da manhã
0 2 * * * cd /caminho/para/HealthLinkConnect && ./scripts/sync-scheduler.sh
```

**⚠️ Atenção**: A sincronização automática substitui os dados locais sem confirmação. Use com cuidado!

#### Verificar Status da Sincronização

```bash
# Ver quando foi a última sincronização
./scripts/check-last-sync.sh
```

#### Executar Sincronização Manual

```bash
# Sincronização com confirmação
./scripts/sync-from-production.sh

# Sincronização automática (sem confirmação - para cron)
./scripts/sync-scheduler.sh
```

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

## 📝 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `sync-from-production.sh` | Sincronização manual com confirmação |
| `sync-scheduler.sh` | Sincronização automática (para cron) |
| `setup-auto-sync.sh` | Configurar sincronização automática |
| `check-last-sync.sh` | Verificar última sincronização |
| `verify-sync.sh` | Verificar dados sincronizados |

## 🔄 Fluxo de Sincronização Contínua

Para manter o banco local sempre atualizado durante testes:

1. **Configurar sincronização automática:**
   ```bash
   ./scripts/setup-auto-sync.sh
   ```

2. **Verificar status:**
   ```bash
   ./scripts/check-last-sync.sh
   ```

3. **Sincronizar manualmente quando necessário:**
   ```bash
   ./scripts/sync-from-production.sh
   ```

4. **Verificar dados sincronizados:**
   ```bash
   ./scripts/verify-sync.sh
   ```

## 📚 Referências

- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL psql Documentation](https://www.postgresql.org/docs/current/app-psql.html)
- [Cron Documentation](https://man7.org/linux/man-pages/man5/crontab.5.html)

