#!/bin/bash

# Login para obter cookie de sessão
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "Login response: $LOGIN_RESPONSE"
echo ""

# Fazer requisição para fechar conversas abandonadas
echo "Fechando conversas abandonadas..."
RESULT=$(curl -s -b /tmp/cookies.txt -X POST http://localhost:5000/api/admin/close-abandoned-conversations \
  -H "Content-Type: application/json" \
  -d '{"minMinutesInactive": 30}')

echo "Result: $RESULT"
echo ""

# Limpar
rm -f /tmp/cookies.txt
