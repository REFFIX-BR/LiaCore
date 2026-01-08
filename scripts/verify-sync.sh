#!/bin/bash

# ==========================================
# Script de Verificação de Sincronização
# ==========================================
# Verifica se os dados foram sincronizados corretamente

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
print_info "  Verificação de Sincronização"
print_info "=========================================="
echo ""

# Configuração
LOCAL_DB_URL="postgresql://postgres:lia_dev_2024@localhost:5432/lia_cortex_dev"
DOCKER_CONTAINER="lia-postgres"

# Verificar se psql está disponível ou usar Docker
USE_DOCKER=false
if ! command -v psql &> /dev/null; then
    USE_DOCKER=true
fi

# Função para executar query
run_query() {
    local query="$1"
    if [ "$USE_DOCKER" = true ]; then
        docker exec ${DOCKER_CONTAINER} psql -U postgres -d lia_cortex_dev -t -A -c "$query"
    else
        PGPASSWORD=lia_dev_2024 psql "$LOCAL_DB_URL" -t -A -c "$query"
    fi
}

print_info "📊 Verificando dados no banco local..."
echo ""

# 1. Verificar tabelas principais
print_info "1️⃣  Tabelas principais:"
TABLES=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
print_success "   Total de tabelas: $TABLES"
echo ""

# 2. Verificar usuários
print_info "2️⃣  Usuários:"
USER_COUNT=$(run_query "SELECT COUNT(*) FROM users;")
print_success "   Total de usuários: $USER_COUNT"
if [ "$USER_COUNT" -gt 0 ]; then
    USERS=$(run_query "SELECT username, role, status FROM users LIMIT 5;")
    echo "   Primeiros usuários:"
    echo "$USERS" | while IFS='|' read -r username role status; do
        echo "     - $username ($role) - $status"
    done
fi
echo ""

# 3. Verificar conversas
print_info "3️⃣  Conversas:"
CONV_COUNT=$(run_query "SELECT COUNT(*) FROM conversations;")
print_success "   Total de conversas: $CONV_COUNT"
if [ "$CONV_COUNT" -gt 0 ]; then
    RECENT_CONV=$(run_query "SELECT COUNT(*) FROM conversations WHERE created_at > NOW() - INTERVAL '7 days';")
    print_info "   Conversas dos últimos 7 dias: $RECENT_CONV"
fi
echo ""

# 4. Verificar mensagens
print_info "4️⃣  Mensagens:"
MSG_COUNT=$(run_query "SELECT COUNT(*) FROM messages;")
print_success "   Total de mensagens: $MSG_COUNT"
if [ "$MSG_COUNT" -gt 0 ]; then
    RECENT_MSG=$(run_query "SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '7 days';")
    print_info "   Mensagens dos últimos 7 dias: $RECENT_MSG"
fi
echo ""

# 5. Verificar contatos
print_info "5️⃣  Contatos:"
CONTACT_COUNT=$(run_query "SELECT COUNT(*) FROM contacts;")
print_success "   Total de contatos: $CONTACT_COUNT"
echo ""

# 6. Verificar última atualização
print_info "6️⃣  Última atualização:"
LAST_UPDATE=$(run_query "SELECT MAX(GREATEST(COALESCE(updated_at, created_at), created_at)) FROM conversations;")
if [ -n "$LAST_UPDATE" ] && [ "$LAST_UPDATE" != "" ]; then
    print_success "   Última conversa atualizada: $LAST_UPDATE"
else
    print_warning "   Não foi possível determinar última atualização"
fi
echo ""

# 7. Verificar tamanho do banco
print_info "7️⃣  Tamanho do banco de dados:"
DB_SIZE=$(run_query "SELECT pg_size_pretty(pg_database_size('lia_cortex_dev'));")
print_success "   Tamanho: $DB_SIZE"
echo ""

# Resumo
echo ""
print_success "=========================================="
print_success "  Verificação Concluída!"
print_success "=========================================="
echo ""
print_info "📝 Resumo:"
print_info "   - Tabelas: $TABLES"
print_info "   - Usuários: $USER_COUNT"
print_info "   - Conversas: $CONV_COUNT"
print_info "   - Mensagens: $MSG_COUNT"
print_info "   - Contatos: $CONTACT_COUNT"
print_info "   - Tamanho: $DB_SIZE"
echo ""
print_info "🌐 Acesse o Adminer para visualização gráfica:"
print_info "   http://localhost:8080"
print_info "   Sistema: PostgreSQL"
print_info "   Servidor: postgres"
print_info "   Usuário: postgres"
print_info "   Senha: lia_dev_2024"
print_info "   Base de dados: lia_cortex_dev"
echo ""

