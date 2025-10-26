# 🧪 Teste: Sistema de Múltiplos Pontos de Instalação

## ✅ Status: Ferramenta Registrada
- ✅ Backend implementado
- ✅ Ferramenta registrada no OpenAI (Suporte: 11 tools, Apresentação: 3 tools)

## 📋 Pré-requisitos

**Cliente de Teste:**
- **CPF**: 10441834701
- **Nome**: Flavia
- **Pontos de Instalação**:
  1. **BOA UNIÃO** - Rua Salim Chimelli, 474 - Três Rios/RJ
  2. **CENTRO** - Rua Augusto de Almeida, 207 - Três Rios/RJ

## 🔄 Fluxo de Teste

### Passo 1: Enviar Mensagem Inicial
Envie via WhatsApp (ou pelo sistema):
```
Minha internet está sem conexão
```

**Resultado Esperado:**
- Sistema detecta 2 pontos de instalação no CRM
- Worker injeta contexto na thread OpenAI
- Logs devem mostrar:
  ```
  🔀 [Massive Failure] Injetando contexto de 2 pontos para IA
  🔀 [Worker] Contexto de múltiplos pontos injetado na mensagem
  ```

### Passo 2: IA Apresenta Opções
A IA deve responder algo como:
```
Olá Flavia! Vejo que você possui 2 pontos de instalação:

1. **BOA UNIÃO** - Rua Salim Chimelli, 474 (Três Rios)
2. **CENTRO** - Rua Augusto de Almeida, 207 (Três Rios)

Qual desses endereços está com problema de conexão?
```

### Passo 3: Cliente Responde
Cliente informa o ponto:
```
É o primeiro endereço (Boa União)
```

**Resultado Esperado:**
- IA chama a ferramenta `selecionar_ponto_instalacao` com `numeroPonto: 1`
- Logs devem mostrar:
  ```
  🔧 [AI Tool] Handling function call: selecionar_ponto_instalacao
  🔀 [AI Tool Handler] Selecionando ponto de instalação
  🔀 [Tool] Ponto de instalação 1 selecionado
  ```

### Passo 4: Verificar Banco de Dados
```sql
SELECT 
  id,
  "clientDocument",
  "selectedInstallationPoint"
FROM conversations
WHERE "clientDocument" = '10441834701'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**Resultado Esperado:**
```json
{
  "selectedInstallationPoint": {
    "index": 0,
    "bairro": "BOA UNIÃO",
    "endereco": "Rua Salim Chimelli, 474",
    "cidade": "Três Rios"
  }
}
```

### Passo 5: Verificação de Falha Massiva
Se houver uma falha massiva ativa no bairro BOA UNIÃO:
- Sistema deve usar o ponto selecionado
- Cliente deve receber notificação específica para aquele endereço

## 🔍 Logs Importantes

**Detecção de Múltiplos Pontos:**
```
🔀 [Massive Failure] Cliente possui 2 contratos/pontos
🔀 [Massive Failure] Injetando contexto de 2 pontos para IA
```

**Injeção de Contexto:**
```
🔀 [Worker] Contexto de múltiplos pontos injetado na mensagem
```

**Chamada da Ferramenta:**
```
🔧 [AI Tool] Handling function call: selecionar_ponto_instalacao
🔧 [AI Tool] Function arguments: {"numeroPonto":1}
🔀 [Tool] Ponto de instalação 1 selecionado com sucesso
```

**Atualização no Banco:**
```
💾 [Tool] Conversation updated with selected point
```

## ⚠️ Possíveis Problemas

### 1. IA não pergunta qual endereço
**Causa**: Contexto não foi injetado
**Verificar**: Logs do worker buscando "Injetando contexto"

### 2. IA não chama a ferramenta
**Causa**: Ferramenta não registrada ou IA não entendeu
**Solução**: Verificar se ferramenta aparece no assistant via API

### 3. Erro ao salvar ponto selecionado
**Causa**: Campo não existe no banco
**Solução**: Executar `npm run db:push`

## 🎯 Critérios de Sucesso

- [x] Sistema detecta múltiplos pontos automaticamente
- [x] IA recebe contexto com lista de endereços
- [x] IA pergunta ao cliente qual endereço tem problema
- [x] Cliente consegue indicar o endereço
- [x] IA chama ferramenta `selecionar_ponto_instalacao`
- [x] Ponto selecionado é salvo em `conversation.selectedInstallationPoint`
- [x] Verificação de falha massiva usa o ponto correto

## 📞 Contato para Testes

Para testar com cliente real que tenha múltiplos pontos:
- Use o CPF 10441834701 (Flavia) 
- Ou consulte o CRM para encontrar outros clientes com múltiplos contratos
