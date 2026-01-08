#!/bin/bash

# ==========================================
# Agendador de Sincronização Automática
# ==========================================
# Este script pode ser executado manualmente ou via cron
# para manter o banco local sincronizado com produção

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/sync-from-production.sh"
LOG_DIR="$SCRIPT_DIR/../logs"
LAST_SYNC_FILE="$SCRIPT_DIR/../.last-sync"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/sync-scheduler-$TIMESTAMP.log"

# Executar sincronização e capturar saída
echo "==========================================" >> "$LOG_FILE"
echo "Sincronização iniciada em: $(date)" >> "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

if "$SYNC_SCRIPT" --auto >> "$LOG_FILE" 2>&1; then
    # Salvar timestamp da última sincronização bem-sucedida
    echo "$(date +%s)" > "$LAST_SYNC_FILE"
    echo "" >> "$LOG_FILE"
    echo "==========================================" >> "$LOG_FILE"
    echo "Sincronização concluída com sucesso em: $(date)" >> "$LOG_FILE"
    echo "==========================================" >> "$LOG_FILE"
    exit 0
else
    echo "" >> "$LOG_FILE"
    echo "==========================================" >> "$LOG_FILE"
    echo "Sincronização FALHOU em: $(date)" >> "$LOG_FILE"
    echo "==========================================" >> "$LOG_FILE"
    exit 1
fi

