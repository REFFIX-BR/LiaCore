#!/bin/bash

# ==========================================
# Configuração de Sincronização Automática
# ==========================================
# Este script configura o cron para sincronização automática

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
print_info "  Configuração de Sincronização Automática"
print_info "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SYNC_SCHEDULER="$SCRIPT_DIR/sync-scheduler.sh"

# Verificar se o script existe
if [ ! -f "$SYNC_SCHEDULER" ]; then
    print_error "Script sync-scheduler.sh não encontrado!"
    exit 1
fi

# Tornar executável
chmod +x "$SYNC_SCHEDULER"

print_info "Escolha a frequência de sincronização:"
print_warning "⚠️  Nota: Sincronizações muito frequentes (10 min) podem sobrecarregar o banco de produção"
print_info "   Recomendado para testes: 20-30 minutos"
echo ""
echo "1) A cada 10 minutos ⚠️  (muito frequente)"
echo "2) A cada 20 minutos"
echo "3) A cada 30 minutos"
echo "4) A cada hora"
echo "5) A cada 6 horas"
echo "6) A cada 12 horas"
echo "7) Diariamente (2h da manhã)"
echo "8) Duas vezes por dia (2h e 14h)"
echo "9) Remover sincronização automática"
echo ""
read -p "Escolha uma opção (1-9): " choice

case $choice in
    1)
        CRON_SCHEDULE="*/10 * * * *"
        DESCRIPTION="A cada 10 minutos"
        ;;
    2)
        CRON_SCHEDULE="*/20 * * * *"
        DESCRIPTION="A cada 20 minutos"
        ;;
    3)
        CRON_SCHEDULE="*/30 * * * *"
        DESCRIPTION="A cada 30 minutos"
        ;;
    4)
        CRON_SCHEDULE="0 * * * *"
        DESCRIPTION="A cada hora"
        ;;
    5)
        CRON_SCHEDULE="0 */6 * * *"
        DESCRIPTION="A cada 6 horas"
        ;;
    6)
        CRON_SCHEDULE="0 */12 * * *"
        DESCRIPTION="A cada 12 horas"
        ;;
    7)
        CRON_SCHEDULE="0 2 * * *"
        DESCRIPTION="Diariamente às 2h"
        ;;
    8)
        CRON_SCHEDULE="0 2,14 * * *"
        DESCRIPTION="Duas vezes por dia (2h e 14h)"
        ;;
    9)
        print_info "Removendo sincronização automática..."
        crontab -l 2>/dev/null | grep -v "sync-scheduler.sh" | crontab -
        print_success "Sincronização automática removida!"
        exit 0
        ;;
    *)
        print_error "Opção inválida!"
        exit 1
        ;;
esac

# Criar entrada do cron
CRON_ENTRY="$CRON_SCHEDULE cd $PROJECT_DIR && $SYNC_SCHEDULER"

# Verificar se já existe entrada
if crontab -l 2>/dev/null | grep -q "sync-scheduler.sh"; then
    print_warning "Já existe uma sincronização automática configurada!"
    read -p "Deseja substituir? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Operação cancelada"
        exit 0
    fi
    # Remover entrada antiga
    crontab -l 2>/dev/null | grep -v "sync-scheduler.sh" | crontab -
fi

# Adicionar nova entrada
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

print_success "Sincronização automática configurada!"
echo ""
print_info "📋 Configuração:"
print_info "   - Frequência: $DESCRIPTION"
print_info "   - Script: $SYNC_SCHEDULER"
print_info "   - Logs: $PROJECT_DIR/logs/"
echo ""
print_info "Para verificar o cron:"
print_info "   crontab -l"
echo ""
print_info "Para testar manualmente:"
print_info "   $SYNC_SCHEDULER"
echo ""

