#!/bin/bash

# ==========================================
# Script para Verificar Métricas do Atendente no Banco
# ==========================================
# Este script executa queries SQL para verificar as métricas do atendente

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
print_info "  Verificar Métricas do Atendente"
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
        exit 1
    fi
else
    if ! PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Banco local não está acessível!"
        exit 1
    fi
fi

print_success "Banco local está acessível"

# ==========================================
# BUSCAR ID DO ATENDENTE
# ==========================================

print_info "Buscando ID do atendente 'Thais Alves'..."

if [ "$USE_DOCKER_PSQL" = true ]; then
    AGENT_INFO=$(docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -t -c "SELECT id, username, full_name FROM users WHERE full_name LIKE '%Thais%' OR username LIKE '%thais%';" | head -1)
else
    AGENT_INFO=$(PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -t -c "SELECT id, username, full_name FROM users WHERE full_name LIKE '%Thais%' OR username LIKE '%thais%';" | head -1)
fi

if [ -z "$AGENT_INFO" ]; then
    print_error "Atendente 'Thais Alves' não encontrado!"
    print_info "Listando todos os atendentes..."
    if [ "$USE_DOCKER_PSQL" = true ]; then
        docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "SELECT id, username, full_name FROM users WHERE role IN ('AGENT', 'SUPERVISOR');"
    else
        PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "SELECT id, username, full_name FROM users WHERE role IN ('AGENT', 'SUPERVISOR');"
    fi
    exit 1
fi

AGENT_ID=$(echo "$AGENT_INFO" | awk '{print $1}')
AGENT_NAME=$(echo "$AGENT_INFO" | awk -F'|' '{print $3}' | xargs)

print_success "Atendente encontrado: $AGENT_NAME (ID: $AGENT_ID)"

# ==========================================
# EXECUTAR QUERIES
# ==========================================

START_DATE="2026-01-09 00:00:00"
END_DATE="2026-01-09 23:59:59"

echo ""
print_info "Verificando métricas para o dia 09/01/2026..."
echo ""

# 1. Conversas Resolvidas
print_info "1. Conversas RESOLVIDAS pelo atendente:"
if [ "$USE_DOCKER_PSQL" = true ]; then
    docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_resolvidas
        FROM conversations
        WHERE 
            resolved_by = '$AGENT_ID'
            AND status = 'resolved'
            AND resolved_at IS NOT NULL
            AND resolved_at >= '$START_DATE'::timestamp
            AND resolved_at <= '$END_DATE'::timestamp;
    "
else
    PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_resolvidas
        FROM conversations
        WHERE 
            resolved_by = '$AGENT_ID'
            AND status = 'resolved'
            AND resolved_at IS NOT NULL
            AND resolved_at >= '$START_DATE'::timestamp
            AND resolved_at <= '$END_DATE'::timestamp;
    "
fi

echo ""

# 2. Conversas Atribuídas
print_info "2. Conversas ATRIBUÍDAS ao atendente (resolvidas no dia):"
if [ "$USE_DOCKER_PSQL" = true ]; then
    docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_atendidas
        FROM conversations
        WHERE 
            assigned_to = '$AGENT_ID'
            AND status = 'resolved'
            AND resolved_at IS NOT NULL
            AND resolved_at >= '$START_DATE'::timestamp
            AND resolved_at <= '$END_DATE'::timestamp;
    "
else
    PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_atendidas
        FROM conversations
        WHERE 
            assigned_to = '$AGENT_ID'
            AND status = 'resolved'
            AND resolved_at IS NOT NULL
            AND resolved_at >= '$START_DATE'::timestamp
            AND resolved_at <= '$END_DATE'::timestamp;
    "
fi

echo ""

# 3. Diferença entre assignedTo e resolvedBy
print_info "3. Conversas atribuídas a ela mas resolvidas por outro:"
if [ "$USE_DOCKER_PSQL" = true ]; then
    docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_diferente
        FROM conversations
        WHERE 
            assigned_to = '$AGENT_ID'
            AND resolved_by IS NOT NULL
            AND resolved_by != '$AGENT_ID'
            AND status = 'resolved'
            AND resolved_at IS NOT NULL
            AND resolved_at >= '$START_DATE'::timestamp
            AND resolved_at <= '$END_DATE'::timestamp;
    "
else
    PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_diferente
        FROM conversations
        WHERE 
            assigned_to = '$AGENT_ID'
            AND resolved_by IS NOT NULL
            AND resolved_by != '$AGENT_ID'
            AND status = 'resolved'
            AND resolved_at IS NOT NULL
            AND resolved_at >= '$START_DATE'::timestamp
            AND resolved_at <= '$END_DATE'::timestamp;
    "
fi

echo ""

# 4. Verificar chatIds fornecidos
print_info "4. Verificando quantos dos 32 chatIds fornecidos estão no banco:"
CHAT_IDS="'whatsapp_5524992010518','whatsapp_553284870390','whatsapp_5524998426299','whatsapp_5524992117138','whatsapp_5524998619220','whatsapp_5524999024795','whatsapp_5524981568228','whatsapp_5524993086456','whatsapp_5524992002233','whatsapp_5524988464717','whatsapp_5524992627110','whatsapp_5524992221622','whatsapp_5524992469917','whatsapp_5524981788997','whatsapp_5524992890406','whatsapp_5524992559836','whatsapp_5524992073057','whatsapp_5522998275989','whatsapp_5524992577219','whatsapp_5524992579394','whatsapp_553299853856','whatsapp_5524993197612','whatsapp_5524992428041','whatsapp_5524993258829','whatsapp_5524992360040','whatsapp_5524988177094','whatsapp_5524993021551','whatsapp_553298384929','whatsapp_5524992498643','whatsapp_5524992891265'"

if [ "$USE_DOCKER_PSQL" = true ]; then
    docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_encontrados,
            COUNT(CASE WHEN assigned_to = '$AGENT_ID' THEN 1 END) as atribuidas_a_ela,
            COUNT(CASE WHEN resolved_by = '$AGENT_ID' THEN 1 END) as resolvidas_por_ela,
            COUNT(CASE WHEN status = 'resolved' AND resolved_at >= '$START_DATE'::timestamp AND resolved_at <= '$END_DATE'::timestamp THEN 1 END) as resolvidas_no_dia
        FROM conversations
        WHERE chat_id IN ($CHAT_IDS);
    "
else
    PGPASSWORD=lia_dev_2024 psql -h localhost -p 5432 -U postgres -d lia_cortex_dev -c "
        SELECT 
            COUNT(*) as total_encontrados,
            COUNT(CASE WHEN assigned_to = '$AGENT_ID' THEN 1 END) as atribuidas_a_ela,
            COUNT(CASE WHEN resolved_by = '$AGENT_ID' THEN 1 END) as resolvidas_por_ela,
            COUNT(CASE WHEN status = 'resolved' AND resolved_at >= '$START_DATE'::timestamp AND resolved_at <= '$END_DATE'::timestamp THEN 1 END) as resolvidas_no_dia
        FROM conversations
        WHERE chat_id IN ($CHAT_IDS);
    "
fi

echo ""
print_success "Verificação concluída!"
echo ""

