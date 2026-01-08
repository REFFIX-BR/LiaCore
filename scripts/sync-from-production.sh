#!/bin/bash

# ==========================================
# Script de Sincronização: Replit/Neon → Local Docker
# ==========================================
# Este script exporta dados do banco de produção (Neon/Replit)
# e importa no banco local (Docker)
#
# ⚠️  SEGURANÇA: Este script NUNCA modifica o banco de produção.
#     Apenas lê dados (pg_dump é somente leitura) e escreve no banco local.

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo ""
print_info "=========================================="
print_info "  Sincronização: Produção → Local"
print_info "=========================================="
echo ""

# ==========================================
# CONFIGURAÇÃO
# ==========================================

# Carregar variáveis do .env se existir
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# URL do banco de PRODUÇÃO (Replit/Neon) - Master
# ⚠️  Esta URL é usada APENAS para LEITURA (pg_dump)
PRODUCTION_DB_URL="${PRODUCTION_DATABASE_URL:-postgresql://neondb_owner:npg_X7wuH9centWi@ep-bold-wildflower-adga7o9q.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require}"

# URL do banco LOCAL (Docker) - Slave
LOCAL_DB_URL="postgresql://postgres:lia_dev_2024@localhost:5432/lia_cortex_dev"

# Diretório para backups
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production-backup-$TIMESTAMP.sql"

# ==========================================
# DETECÇÃO DE FERRAMENTAS
# ==========================================

# Detectar se pg_dump e psql estão disponíveis no sistema ou via Docker
USE_DOCKER=false
PG_DUMP_CMD="pg_dump"
PSQL_CMD="psql"
DOCKER_CONTAINER="lia-postgres"

if ! command -v pg_dump &> /dev/null || ! command -v psql &> /dev/null; then
    print_info "Ferramentas PostgreSQL não encontradas no sistema"
    print_info "Tentando usar via container Docker..."
    
    # Verificar se o container existe e está rodando
    if docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
        USE_DOCKER=true
        PG_DUMP_CMD="docker exec -i ${DOCKER_CONTAINER} pg_dump"
        PSQL_CMD="docker exec -i ${DOCKER_CONTAINER} psql"
        print_success "Usando ferramentas PostgreSQL via Docker container: ${DOCKER_CONTAINER}"
    else
        print_error "Container Docker '${DOCKER_CONTAINER}' não está rodando!"
        print_info "Inicie o container: docker compose up -d postgres"
        exit 1
    fi
else
    print_success "Ferramentas PostgreSQL encontradas no sistema"
fi

# Verificar se banco local está acessível
print_info "Verificando conexão com banco local..."

if [ "$USE_DOCKER" = true ]; then
    # Via Docker, usar conexão interna
    if ! docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Banco local não está acessível via Docker!"
        print_info "Certifique-se de que o Docker está rodando:"
        print_info "  docker compose up -d postgres"
        exit 1
    fi
else
    # Via sistema, usar conexão externa
    if ! PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Banco local não está acessível!"
        print_info "Certifique-se de que o Docker está rodando:"
        print_info "  docker compose up -d postgres"
        exit 1
    fi
fi

print_success "Banco local está acessível"

# ==========================================
# EXPORTAÇÃO DO BANCO DE PRODUÇÃO
# ==========================================
# ⚠️  SEGURANÇA: pg_dump é SOMENTE LEITURA
#     Não modifica nada no banco de produção!

print_info "📥 Exportando dados de produção (Neon/Replit)..."
print_info "   ⚠️  Esta operação é SOMENTE LEITURA - não modifica produção"
print_info "   Isso pode levar alguns minutos dependendo do tamanho do banco..."

# Extrair informações da URL para validação
PROD_HOST=$(echo "$PRODUCTION_DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
PROD_DB=$(echo "$PRODUCTION_DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

print_info "   Host: $PROD_HOST"
print_info "   Database: $PROD_DB"

# Exportar do banco de produção
# ⚠️  IMPORTANTE: pg_dump precisa acessar o banco remoto
#     Se estiver usando Docker, o container precisa ter acesso à internet
if [ "$USE_DOCKER" = true ]; then
    # Via Docker: redirecionar saída para arquivo no host
    print_info "   Usando pg_dump via Docker (container precisa de acesso à internet)"
    if docker exec ${DOCKER_CONTAINER} pg_dump "$PRODUCTION_DB_URL" \
      --no-owner \
      --no-privileges \
      --clean \
      --if-exists \
      --verbose > "$BACKUP_FILE" 2> "$BACKUP_DIR/export-log-$TIMESTAMP.txt"; then
        EXPORT_SUCCESS=true
        # Mostrar últimas linhas do log
        if [ -s "$BACKUP_DIR/export-log-$TIMESTAMP.txt" ]; then
            tail -20 "$BACKUP_DIR/export-log-$TIMESTAMP.txt"
        fi
    else
        EXPORT_SUCCESS=false
        # Mostrar erro completo
        if [ -s "$BACKUP_DIR/export-log-$TIMESTAMP.txt" ]; then
            cat "$BACKUP_DIR/export-log-$TIMESTAMP.txt"
        fi
    fi
else
    # Via sistema: comando direto
    if pg_dump "$PRODUCTION_DB_URL" \
      --no-owner \
      --no-privileges \
      --clean \
      --if-exists \
      --verbose \
      --file="$BACKUP_FILE" 2>&1 | tee "$BACKUP_DIR/export-log-$TIMESTAMP.txt"; then
        EXPORT_SUCCESS=true
    else
        EXPORT_SUCCESS=false
    fi
fi

if [ "$EXPORT_SUCCESS" = true ]; then
    
    if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
        print_error "Backup não foi criado ou está vazio!"
        exit 1
    fi
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "Backup criado: $BACKUP_FILE ($BACKUP_SIZE)"
else
    print_error "Falha ao exportar banco de produção!"
    print_info "Verifique os logs em: $BACKUP_DIR/export-log-$TIMESTAMP.txt"
    exit 1
fi

# ==========================================
# IMPORTAÇÃO NO BANCO LOCAL
# ==========================================

print_info "📤 Importando no banco local (Docker)..."
print_warning "   ⚠️  ATENÇÃO: Os dados locais serão SUBSTITUÍDOS pelos dados de produção!"

# Perguntar confirmação
read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_info "Sincronização cancelada pelo usuário"
    print_info "Backup salvo em: $BACKUP_FILE"
    exit 0
fi

# Importar no banco local
print_info "Importando dados (isso pode levar alguns minutos)..."

if [ "$USE_DOCKER" = true ]; then
    # Via Docker: copiar arquivo para o container e executar psql
    print_info "   Copiando backup para o container..."
    docker cp "$BACKUP_FILE" "${DOCKER_CONTAINER}:/tmp/backup.sql"
    
    # Executar importação e capturar saída
    if docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -f /tmp/backup.sql > "$BACKUP_DIR/import-log-$TIMESTAMP.txt" 2>&1; then
        # Limpar arquivo temporário do container
        docker exec ${DOCKER_CONTAINER} rm -f /tmp/backup.sql
        print_success "Sincronização concluída com sucesso!"
    else
        print_error "Falha ao importar no banco local!"
        print_info "Verifique os logs em: $BACKUP_DIR/import-log-$TIMESTAMP.txt"
        # Mostrar últimas linhas do erro
        if [ -s "$BACKUP_DIR/import-log-$TIMESTAMP.txt" ]; then
            tail -30 "$BACKUP_DIR/import-log-$TIMESTAMP.txt"
        fi
        exit 1
    fi
else
    # Via sistema: comando direto
    if PGPASSWORD=lia_dev_2024 psql "$LOCAL_DB_URL" < "$BACKUP_FILE" 2>&1 | tee "$BACKUP_DIR/import-log-$TIMESTAMP.txt"; then
        print_success "Sincronização concluída com sucesso!"
    else
        print_error "Falha ao importar no banco local!"
        print_info "Verifique os logs em: $BACKUP_DIR/import-log-$TIMESTAMP.txt"
        exit 1
    fi
fi

# ==========================================
# LIMPEZA DE BACKUPS ANTIGOS
# ==========================================

print_info "🧹 Limpando backups antigos (mantendo últimos 5)..."

cd "$BACKUP_DIR"
BACKUP_COUNT=$(ls -1 production-backup-*.sql 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt 5 ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - 5))
    ls -t production-backup-*.sql | tail -n +6 | xargs -r rm -f
    print_success "Removidos $REMOVE_COUNT backup(s) antigo(s)"
else
    print_info "Nenhum backup antigo para remover"
fi

# ==========================================
# RESUMO
# ==========================================

echo ""
print_success "=========================================="
print_success "  Sincronização Concluída!"
print_success "=========================================="
echo ""
print_info "📊 Resumo:"
print_info "   - Backup salvo em: $BACKUP_FILE"
print_info "   - Tamanho: $BACKUP_SIZE"
print_info "   - Logs de exportação: $BACKUP_DIR/export-log-$TIMESTAMP.txt"
print_info "   - Logs de importação: $BACKUP_DIR/import-log-$TIMESTAMP.txt"
echo ""
print_info "🔄 Para sincronizar novamente, execute:"
print_info "   ./scripts/sync-from-production.sh"
echo ""
print_success "✅ Banco local sincronizado com produção!"
print_info "   ⚠️  Lembre-se: O banco de produção permanece INTACTO"
echo ""

