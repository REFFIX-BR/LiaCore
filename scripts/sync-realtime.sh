#!/bin/bash

# ==========================================
# Script de Sincronização em Tempo Real: Produção → Local
# ==========================================
# Este script sincroniza continuamente o banco de produção com o local
# Executa sincronizações periódicas (padrão: a cada 5 minutos)
#
# ⚠️  SEGURANÇA: Este script NUNCA modifica o banco de produção.
#     Apenas lê dados (pg_dump é somente leitura) e escreve no banco local.

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_sync() {
    echo -e "${CYAN}🔄 $1${NC}"
}

# ==========================================
# CONFIGURAÇÃO
# ==========================================

# Intervalo entre sincronizações (em minutos)
SYNC_INTERVAL=${SYNC_INTERVAL:-5}

# Carregar variáveis do .env se existir
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# URL do banco de PRODUÇÃO (Neon)
PRODUCTION_DB_URL="${PRODUCTION_DATABASE_URL:-postgresql://neondb_owner:npg_X7wuH9centWi@ep-bold-wildflower-adga7o9q.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require}"

# URL do banco LOCAL (Docker)
LOCAL_DB_URL="postgresql://postgres:lia_dev_2024@localhost:5432/lia_cortex_dev"
DOCKER_CONTAINER="lia-postgres"

# Diretório para backups
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Arquivo de controle para parar o script
STOP_FILE="$BACKUP_DIR/.sync-stop"

# ==========================================
# FUNÇÕES
# ==========================================

# Função para executar uma sincronização
sync_once() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/production-backup-$timestamp.sql"
    local export_log="$BACKUP_DIR/export-log-$timestamp.txt"
    local import_log="$BACKUP_DIR/import-log-$timestamp.txt"
    
    print_sync "Iniciando sincronização... ($(date '+%H:%M:%S'))"
    
    # Exportar do banco de produção
    print_info "📥 Exportando dados de produção..."
    print_info "   Isso pode levar de 1-5 minutos dependendo do tamanho do banco..."
    
    TEMP_CONTAINER="pg-dump-temp-$$"
    START_TIME=$(date +%s)
    
    if docker run --rm \
      --name "$TEMP_CONTAINER" \
      -v "${PWD}/$BACKUP_DIR:/backup" \
      postgres:16-alpine \
      sh -c "pg_dump '$PRODUCTION_DB_URL' --no-owner --no-privileges --clean --if-exists > /backup/production-backup-$timestamp.sql" 2> "$export_log"; then
        
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        MINUTES=$((DURATION / 60))
        SECONDS=$((DURATION % 60))
        
        if [ ! -f "$backup_file" ] || [ ! -s "$backup_file" ]; then
            print_error "Backup não foi criado ou está vazio!"
            return 1
        fi
        
        local backup_size=$(du -h "$backup_file" | cut -f1)
        if [ $MINUTES -gt 0 ]; then
            print_success "Backup criado: $backup_size (em ${MINUTES}m ${SECONDS}s)"
        else
            print_success "Backup criado: $backup_size (em ${SECONDS}s)"
        fi
    else
        print_error "Falha ao exportar banco de produção!"
        if [ -s "$export_log" ]; then
            tail -10 "$export_log"
        fi
        return 1
    fi
    
    # Importar no banco local
    print_info "📤 Importando no banco local..."
    print_info "   Isso pode levar de 30 segundos a 3 minutos..."
    
    IMPORT_START=$(date +%s)
    
    if docker cp "$backup_file" "${DOCKER_CONTAINER}:/tmp/backup.sql" && \
       docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -f /tmp/backup.sql > "$import_log" 2>&1 && \
       docker exec ${DOCKER_CONTAINER} rm -f /tmp/backup.sql; then
        IMPORT_END=$(date +%s)
        IMPORT_DURATION=$((IMPORT_END - IMPORT_START))
        IMPORT_MIN=$((IMPORT_DURATION / 60))
        IMPORT_SEC=$((IMPORT_DURATION % 60))
        
        if [ $IMPORT_MIN -gt 0 ]; then
            print_success "Sincronização concluída! ($(date '+%H:%M:%S') - Total: ${MINUTES}m ${SECONDS}s + ${IMPORT_MIN}m ${IMPORT_SEC}s)"
        else
            print_success "Sincronização concluída! ($(date '+%H:%M:%S') - Total: ${MINUTES}m ${SECONDS}s + ${IMPORT_SEC}s)"
        fi
        
        # Limpar backups antigos (manter últimos 3)
        cd "$BACKUP_DIR"
        local backup_count=$(ls -1 production-backup-*.sql 2>/dev/null | wc -l)
        if [ "$backup_count" -gt 3 ]; then
            local remove_count=$((backup_count - 3))
            ls -t production-backup-*.sql | tail -n +4 | xargs -r rm -f
            print_info "🧹 Removidos $remove_count backup(s) antigo(s)"
        fi
        
        return 0
    else
        print_error "Falha ao importar no banco local!"
        if [ -s "$import_log" ]; then
            tail -10 "$import_log"
        fi
        return 1
    fi
}

# Função para verificar se deve parar
should_stop() {
    if [ -f "$STOP_FILE" ]; then
        return 0  # true - deve parar
    fi
    return 1  # false - continuar
}

# Função para limpar arquivo de stop
cleanup_stop_file() {
    if [ -f "$STOP_FILE" ]; then
        rm -f "$STOP_FILE"
    fi
}

# Função para verificar conexões
check_connections() {
    # Verificar Docker
    if ! docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
        print_error "Container '$DOCKER_CONTAINER' não está rodando!"
        print_info "Inicie o container: docker compose up -d postgres"
        return 1
    fi
    
    # Verificar banco local
    if ! docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Banco local não está acessível!"
        return 1
    fi
    
    return 0
}

# ==========================================
# MAIN
# ==========================================

echo ""
print_info "=========================================="
print_info "  Sincronização em Tempo Real"
print_info "  Produção → Local"
print_info "=========================================="
echo ""
print_info "Intervalo: $SYNC_INTERVAL minutos"
print_info "Para parar: crie o arquivo $STOP_FILE"
print_info "  ou pressione Ctrl+C"
echo ""

# Verificar conexões
if ! check_connections; then
    exit 1
fi

print_success "Conexões verificadas"
echo ""

# Limpar arquivo de stop se existir
cleanup_stop_file

# Contador de sincronizações
SYNC_COUNT=0
SUCCESS_COUNT=0
FAIL_COUNT=0

# Sincronização inicial imediata
print_info "🔄 Sincronização inicial..."
if sync_once; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
SYNC_COUNT=$((SYNC_COUNT + 1))

echo ""
print_info "⏰ Aguardando $SYNC_INTERVAL minutos até próxima sincronização..."
print_info "   (Pressione Ctrl+C para parar)"
echo ""

# Loop principal
while true; do
    # Verificar se deve parar
    if should_stop; then
        print_warning "Arquivo de stop detectado. Encerrando..."
        cleanup_stop_file
        break
    fi
    
    # Aguardar intervalo
    sleep $((SYNC_INTERVAL * 60))
    
    # Verificar conexões novamente
    if ! check_connections; then
        print_error "Conexões perdidas. Tentando novamente em $SYNC_INTERVAL minutos..."
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi
    
    # Executar sincronização
    if sync_once; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    SYNC_COUNT=$((SYNC_COUNT + 1))
    
    # Mostrar estatísticas
    echo ""
    print_info "📊 Estatísticas:"
    print_info "   Total: $SYNC_COUNT sincronizações"
    print_info "   Sucesso: $SUCCESS_COUNT"
    print_info "   Falhas: $FAIL_COUNT"
    echo ""
    print_info "⏰ Próxima sincronização em $SYNC_INTERVAL minutos..."
    echo ""
done

# Resumo final
echo ""
print_success "=========================================="
print_success "  Sincronização Encerrada"
print_success "=========================================="
echo ""
print_info "📊 Estatísticas finais:"
print_info "   Total: $SYNC_COUNT sincronizações"
print_info "   Sucesso: $SUCCESS_COUNT"
print_info "   Falhas: $FAIL_COUNT"
echo ""

