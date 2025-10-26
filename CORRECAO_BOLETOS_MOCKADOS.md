# 🔧 Correção: Boletos Mockados na Resposta da IA

## 🔍 Problema Identificado

A IA estava apresentando dados **mockados/fictícios** de boletos ao cliente:
- ❌ Valor: R$ 230.79
- ❌ Link: `pagamento.com/23079`
- ❌ PIX: `23079a6b7c8d9e1f2g3h4i5j6k7l8m9`

Esses dados **não correspondem aos boletos reais** do cliente e causam confusão.

---

## 🎯 Causa Raiz

O prompt do assistente **Financeiro** (configurado no dashboard da OpenAI) contém **exemplos de resposta** com dados fictícios. Quando a API de boletos falha ou há timeout, a IA usa esses exemplos em vez de informar o erro ao cliente.

---

## ✅ Correções Implementadas no Código

### 1. Logging Detalhado (`server/ai-tools.ts`)
```typescript
// Logs adicionados:
console.log(`🌐 [AI Tool] Endpoint: https://webhook.trtelecom.net/webhook/consulta_boleto`);
console.log(`📤 [AI Tool] Enviando requisição para API externa...`);
console.log(`📥 [AI Tool] Resposta recebida da API externa`);
console.log(`📊 [AI Tool] Dados brutos (primeiros 3 boletos):`, JSON.stringify(...));
```

### 2. Tratamento de Erro Melhorado (`server/lib/openai.ts`)
```typescript
// Quando a API falha, retornar erro estruturado:
return JSON.stringify({
  status: "ERRO_API",
  error: error instanceof Error ? error.message : "Erro ao consultar boletos",
  instrucao_ia: "ATENÇÃO: A consulta de boletos FALHOU. NÃO invente dados. NÃO use exemplos..."
});
```

### 3. Endpoint de Teste (`/api/debug/test-boletos`)
```bash
POST /api/debug/test-boletos
Authorization: Bearer <token>
Content-Type: application/json

{
  "cpf": "123.456.789-00"
}
```

---

## 🔧 Como Corrigir o Prompt do Assistente OpenAI

### Passo 1: Acessar Dashboard OpenAI
1. Acesse: https://platform.openai.com/
2. Navegue até **Assistants** no menu lateral
3. Localize o assistente **Financeiro** (ID: `asst_pRXVhoy1o4YxNxVmaRiNOTMX`)
4. Clique em **Edit**

### Passo 2: Revisar e Limpar o Prompt

Procure no campo **Instructions** por:
- ❌ Exemplos com valores específicos (R$ 230.79, etc.)
- ❌ Respostas mockadas com links genéricos
- ❌ Dados de PIX fictícios

**REMOVA** todos os exemplos de resposta que contenham dados específicos de boletos.

### Passo 3: Adicionar Instruções de Erro

Adicione ao prompt do assistente:

```
IMPORTANTE - TRATAMENTO DE ERROS:

Quando a função consulta_boleto_cliente retornar um erro (status: "ERRO_API"):
1. NÃO invente dados de boletos
2. NÃO use exemplos ou dados mockados
3. Informe ao cliente que houve um problema técnico temporário
4. Ofereça tentar novamente em alguns minutos
5. Ofereça transferir para atendimento humano se preferir

Exemplo de resposta em caso de erro:
"Desculpe, estou com dificuldade para consultar seus boletos no momento devido a um problema técnico temporário. 
Você pode tentar novamente em alguns minutinhos ou, se preferir, posso transferir você para um atendente humano. 
O que prefere?"
```

### Passo 4: Salvar e Testar

1. Clique em **Save**
2. Aguarde alguns segundos para sincronização
3. Teste via WhatsApp ou endpoint de debug

---

## 🧪 Como Testar

### Teste 1: Endpoint de Debug (Recomendado)

```bash
# 1. Fazer login como admin no sistema
# 2. Obter token JWT
# 3. Chamar o endpoint:

curl -X POST http://localhost:5000/api/debug/test-boletos \
  -H "Authorization: Bearer <seu-token>" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "087.841.647-19"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "duration_ms": 1234,
  "total_boletos": 4,
  "boletos": [...dados reais da API...],
  "primeiros_3": [...]
}
```

### Teste 2: Via WhatsApp

1. Envie mensagem: `Meu CPF é 087.841.647-19`
2. Envie mensagem: `Quero meu boleto`
3. Verifique os logs do servidor:

```bash
# Logs esperados:
🌐 [AI Tool] Endpoint: https://webhook.trtelecom.net/webhook/consulta_boleto
📤 [AI Tool] Enviando requisição para API externa...
📥 [AI Tool] Resposta recebida da API externa
📋 [AI Tool] 4 boleto(s) retornado(s) pela API
📊 [AI Tool] Dados brutos (primeiros 3 boletos): [...]
```

4. Verifique que a resposta **NÃO contém**:
   - ❌ R$ 230.79
   - ❌ pagamento.com/23079
   - ❌ PIX genérico 23079a6b...

---

## 📊 Monitoramento

### Verificar Logs do Servidor

```bash
# Buscar por chamadas à API de boletos:
grep "Consultando boletos" logs/server.log

# Buscar por erros na API:
grep "ERRO_API" logs/server.log

# Verificar dados retornados:
grep "Dados brutos" logs/server.log
```

### Sinais de Problema

🚨 **Se você ver nos logs:**
- Nenhuma linha com `📤 [AI Tool] Enviando requisição para API externa...` 
  → A API não está sendo chamada

- Linha `❌ [AI Tool Handler] Erro ao consultar boletos:`
  → A API está falhando (timeout, erro HTTP, etc.)

- Cliente recebe dados com R$ 230.79
  → O prompt do assistente ainda contém exemplos mockados

---

## 🔐 Segurança

### Dados Sensíveis nos Logs

✅ **Implementado**: Todos os CPFs são mascarados nos logs:
```
📋 [AI Tool] Consultando boletos (conversação: abc-123)
```

❌ **Nunca aparece**: CPF completo nos logs

### Validações de Segurança

✅ Documento consultado deve pertencer ao cliente da conversa  
✅ Contexto de conversa obrigatório  
✅ Validação de documento normalizado (remove formatação)

---

## 📝 Checklist de Verificação

Após aplicar as correções:

- [ ] Código atualizado com logging detalhado
- [ ] Tratamento de erro melhorado implementado
- [ ] Endpoint de teste funcionando
- [ ] Prompt do assistente revisado e limpo
- [ ] Exemplos mockados removidos do prompt
- [ ] Instruções de erro adicionadas ao prompt
- [ ] Teste via endpoint de debug bem-sucedido
- [ ] Teste via WhatsApp bem-sucedido
- [ ] Logs confirmam chamada à API real
- [ ] Nenhum dado mockado (R$ 230.79) aparece

---

## 🆘 Troubleshooting

### "API está retornando 500"

**Verificar:**
1. Endpoint correto: `https://webhook.trtelecom.net/webhook/consulta_boleto`
2. Formato do payload: `{"documento": "12345678900"}`
3. API externa está online

### "IA ainda usa dados mockados"

**Verificar:**
1. Prompt do assistente foi salvo no dashboard OpenAI
2. Aguardou 30-60 segundos após salvar (sincronização)
3. Testou com nova conversa (não reutilizar conversa antiga)

### "Endpoint de teste retorna 401"

**Verificar:**
1. Token JWT válido
2. Usuário tem role ADMIN
3. Token não expirado

---

## 📚 Arquivos Relacionados

- `server/ai-tools.ts` - Função `consultaBoletoCliente()`
- `server/lib/openai.ts` - Handler `consultar_boleto_cliente`
- `server/routes.ts` - Endpoint `/api/debug/test-boletos`
- `BOLETO_FUNCTION_SETUP.md` - Configuração inicial da função

---

## ✅ Status

**Data da Correção**: 26/10/2025  
**Versão**: 2.0 (Arquitetura Efêmera)  
**Responsável**: Sistema LIA CORTEX  
**Testado**: ⏳ Pendente validação em produção
