#!/bin/bash

# ==========================================
# Verificar Última Sincronização
# ==========================================

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAST_SYNC_FILE="$SCRIPT_DIR/../.last-sync"
LOG_DIR="$SCRIPT_DIR/../logs"

echo ""
print_info "=========================================="
print_info "  Status da Sincronização"
print_info "=========================================="
echo ""

# Verificar última sincronização
if [ -f "$LAST_SYNC_FILE" ]; then
    LAST_SYNC_TIMESTAMP=$(cat "$LAST_SYNC_FILE")
    LAST_SYNC_DATE=$(date -d "@$LAST_SYNC_TIMESTAMP" 2>/dev/null || date -r "$LAST_SYNC_TIMESTAMP" 2>/dev/null || echo "Desconhecido")
    CURRENT_TIMESTAMP=$(date +%s)
    SECONDS_AGO=$((CURRENT_TIMESTAMP - LAST_SYNC_TIMESTAMP))
    
    HOURS_AGO=$((SECONDS_AGO / 3600))
    MINUTES_AGO=$(((SECONDS_AGO % 3600) / 60))
    
    print_success "Última sincronização: $LAST_SYNC_DATE"
    
    if [ $HOURS_AGO -lt 1 ]; then
        print_success "Há $MINUTES_AGO minuto(s)"
    elif [ $HOURS_AGO -lt 24 ]; then
        print_info "Há $HOURS_AGO hora(s) e $MINUTES_AGO minuto(s)"
    else
        DAYS_AGO=$((HOURS_AGO / 24))
        print_warning "Há $DAYS_AGO dia(s) - considere sincronizar novamente"
    fi
else
    print_warning "Nenhuma sincronização registrada ainda"
fi

echo ""

# Verificar se há cron configurado
if crontab -l 2>/dev/null | grep -q "sync-scheduler.sh"; then
    CRON_ENTRY=$(crontab -l 2>/dev/null | grep "sync-scheduler.sh")
    print_success "Sincronização automática: ATIVA"
    print_info "   Cron: $CRON_ENTRY"
else
    print_info "Sincronização automática: NÃO CONFIGURADA"
    print_info "   Execute: ./scripts/setup-auto-sync.sh"
fi

echo ""

# Mostrar últimos logs
if [ -d "$LOG_DIR" ] && [ -n "$(ls -A $LOG_DIR 2>/dev/null)" ]; then
    print_info "Últimos logs de sincronização:"
    ls -t "$LOG_DIR"/sync-scheduler-*.log 2>/dev/null | head -3 | while read logfile; do
        echo "   - $(basename $logfile)"
    done
fi

echo ""

