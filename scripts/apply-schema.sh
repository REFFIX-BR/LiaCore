#!/bin/bash

# ==========================================
# Script para Aplicar Schema do Banco de Dados
# ==========================================
# Este script aplica o schema do Drizzle ORM no banco de dados local

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
print_info "  Aplicar Schema do Banco de Dados"
print_info "=========================================="
echo ""

# Verificar se Docker está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^lia-postgres$"; then
    print_error "Container lia-postgres não está rodando!"
    print_info "Inicie o Docker: docker compose up -d postgres"
    exit 1
fi

print_success "Container lia-postgres está rodando"

# Verificar se app está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^lia-app$"; then
    print_warning "Container lia-app não está rodando"
    print_info "Iniciando container app..."
    docker compose up -d app
    sleep 5
fi

print_info "Aplicando schema do banco de dados..."
print_warning "⚠️  Isso pode modificar a estrutura do banco de dados!"

read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_info "Operação cancelada"
    exit 0
fi

# Aplicar schema usando drizzle-kit push
print_info "Executando: npm run db:push"
if docker compose exec app npm run db:push; then
    print_success "Schema aplicado com sucesso!"
else
    print_error "Falha ao aplicar schema!"
    exit 1
fi

echo ""
print_success "=========================================="
print_success "  Schema Aplicado!"
print_success "=========================================="
echo ""

