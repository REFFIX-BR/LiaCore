#!/bin/bash

# ==========================================
# Script para Corrigir assignedTo Histórico
# ==========================================
# Este script executa o SQL para corrigir conversas resolvidas
# que têm resolvedBy mas não têm assignedTo

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
print_info "  Correção de assignedTo Histórico"
print_info "=========================================="
echo ""

# ==========================================
# CONFIGURAÇÃO
# ==========================================

# Detectar se psql está disponível no sistema ou via Docker
USE_DOCKER_PSQL=false
PSQL_CMD="psql"
DOCKER_CONTAINER="lia-postgres"

if ! command -v psql &> /dev/null; then
    print_info "psql não encontrado no sistema"
    print_info "Tentando usar via container Docker..."
    
    if docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
        USE_DOCKER_PSQL=true
        PSQL_CMD="docker exec -i ${DOCKER_CONTAINER} psql"
        print_success "Usando psql via Docker container: ${DOCKER_CONTAINER}"
    else
        print_error "Container Docker '${DOCKER_CONTAINER}' não está rodando!"
        print_info "Inicie o container: docker compose up -d postgres"
        exit 1
    fi
else
    print_success "psql encontrado no sistema"
fi

# Verificar se banco local está acessível
print_info "Verificando conexão com banco local..."

if [ "$USE_DOCKER_PSQL" = true ]; then
    if ! docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Banco local não está acessível via Docker!"
        print_info "Certifique-se de que o Docker está rodando:"
        print_info "  docker compose up -d postgres"
        exit 1
    fi
else
    if ! PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Banco local não está acessível!"
        print_info "Certifique-se de que o Docker está rodando:"
        print_info "  docker compose up -d postgres"
        exit 1
    fi
fi

print_success "Banco local está acessível"

# ==========================================
# EXECUTAR QUERIES
# ==========================================

print_warning "⚠️  ATENÇÃO: Este script irá atualizar conversas resolvidas que não têm assignedTo."
print_warning "   Ele definirá assignedTo = resolvedBy para essas conversas."
echo ""

# Mostrar estatísticas antes da correção
print_info "Estatísticas ANTES da correção:"
VERIFICATION_SQL="SELECT 
    COUNT(*) AS conversas_sem_assigned_to,
    COUNT(DISTINCT resolved_by) AS agentes_afetados
FROM 
    conversations
WHERE 
    status = 'resolved'
    AND resolved_by IS NOT NULL
    AND assigned_to IS NULL;"

if [ "$USE_DOCKER_PSQL" = true ]; then
    echo "$VERIFICATION_SQL" | docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev
else
    PGPASSWORD=lia_dev_2024 echo "$VERIFICATION_SQL" | psql -h localhost -p 5432 -U postgres -d lia_cortex_dev
fi

echo ""
print_info "Prévia das conversas que serão atualizadas (primeiras 10):"
PREVIEW_SQL="SELECT 
    id,
    chat_id,
    client_name,
    resolved_by,
    resolved_at,
    assigned_to
FROM 
    conversations
WHERE 
    status = 'resolved'
    AND resolved_by IS NOT NULL
    AND assigned_to IS NULL
ORDER BY 
    resolved_at DESC
LIMIT 10;"

if [ "$USE_DOCKER_PSQL" = true ]; then
    echo "$PREVIEW_SQL" | docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev
else
    PGPASSWORD=lia_dev_2024 echo "$PREVIEW_SQL" | psql -h localhost -p 5432 -U postgres -d lia_cortex_dev
fi

echo ""
read -p "Deseja continuar com a correção? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_info "Correção cancelada pelo usuário"
    exit 0
fi

# Executar UPDATE
print_info "Executando correção..."
UPDATE_SQL="UPDATE conversations SET assigned_to = resolved_by WHERE status = 'resolved' AND resolved_by IS NOT NULL AND assigned_to IS NULL;"

if [ "$USE_DOCKER_PSQL" = true ]; then
    # Contar quantas serão atualizadas antes
    COUNT_BEFORE=$(docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -t -c "SELECT COUNT(*) FROM conversations WHERE status = 'resolved' AND resolved_by IS NOT NULL AND assigned_to IS NULL;" | xargs)
    
    # Executar UPDATE
    echo "$UPDATE_SQL" | docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev
    
    # Contar quantas foram atualizadas
    COUNT_AFTER=$(docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -t -c "SELECT COUNT(*) FROM conversations WHERE status = 'resolved' AND resolved_by IS NOT NULL AND assigned_to IS NOT NULL;" | xargs)
else
    # Contar quantas serão atualizadas antes
    COUNT_BEFORE=$(PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -t -c "SELECT COUNT(*) FROM conversations WHERE status = 'resolved' AND resolved_by IS NOT NULL AND assigned_to IS NULL;" | xargs)
    
    # Executar UPDATE
    PGPASSWORD=lia_dev_2024 echo "$UPDATE_SQL" | psql -h localhost -p 5432 -U postgres -d lia_cortex_dev
    
    # Contar quantas foram atualizadas
    COUNT_AFTER=$(PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -t -c "SELECT COUNT(*) FROM conversations WHERE status = 'resolved' AND resolved_by IS NOT NULL AND assigned_to IS NOT NULL;" | xargs)
fi

print_success "Correção concluída!"
print_info "Conversas atualizadas: $COUNT_BEFORE"
print_info "Total de conversas resolvidas com assignedTo após correção: $COUNT_AFTER"
echo ""

