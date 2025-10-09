# 🔧 Configuração da Função consulta_boleto_cliente no OpenAI

## 📋 Instruções para Adicionar a Função ao Assistente Financeiro

### 1. Acessar o Dashboard da OpenAI
- Faça login em: https://platform.openai.com/
- Navegue até **Assistants** no menu lateral
- Localize o assistente **Financeiro** (ID: `asst_pRXVhoy1o4YxNxVmaRiNOTMX`)

### 2. Adicionar a Função

Clique em **Edit** e vá até a seção **Tools** → **Function calling**

Adicione a seguinte definição JSON:

```json
{
  "name": "consulta_boleto_cliente",
  "description": "Consulta boletos (faturas) pendentes de um cliente usando CPF ou CNPJ. Use esta função quando o cliente perguntar sobre boletos, faturas, ou pagamentos pendentes. IMPORTANTE: O sistema já captura automaticamente o CPF/CNPJ da conversa - você NÃO precisa pedir novamente ao cliente.",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

### 3. ⚠️ Parâmetros Importantes

**A função NÃO tem parâmetros!** 

O sistema funciona assim:
- ✅ CPF/CNPJ é **detectado automaticamente** quando o cliente menciona na conversa
- ✅ É **armazenado de forma segura** no banco de dados
- ✅ A função **busca automaticamente** usando o documento da conversa
- ✅ **Validação de segurança** garante que só consulta dados do cliente correto

**Não adicione parâmetros como `cpf`, `cnpj` ou `documento`!**

### 4. Atualizar as Instruções do Assistente

Certifique-se de que as instruções do assistente Financeiro mencionem:

```
Quando o cliente perguntar sobre boletos ou faturas pendentes, use a função consulta_boleto_cliente. 
O sistema já identificou o CPF/CNPJ do cliente automaticamente - não peça novamente.
```

### 5. Testar a Função

1. Inicie uma conversa pelo WhatsApp
2. Envie uma mensagem com seu CPF: "Meu CPF é 123.456.789-00"
3. Pergunte sobre boletos: "Quais são meus boletos pendentes?"
4. A LIA deve chamar `consulta_boleto_cliente` automaticamente

### 6. ✅ Verificação de Sucesso

Se configurado corretamente, você verá:
- Logs no servidor: `🔍 [Boleto] Consultando boletos para CPF: ***.***. ***-**`
- A IA retorna os boletos formatados do cliente
- **NENHUM CPF/CNPJ aparece nos logs** (apenas versões mascaradas)

## 🔒 Segurança Implementada

1. **Captura Automática**: CPF/CNPJ extraído de mensagens do cliente
2. **Validação de Contexto**: Função só executa se houver conversa válida
3. **Autorização de Documento**: Só consulta boletos do CPF armazenado
4. **Logs Seguros**: Todos os logs mascaram CPF/CNPJ completamente
   - CPF: `***.***. ***-**`
   - CNPJ: `**.***.***/****-**`

## 🎯 Fluxo Completo

```
1. Cliente: "Meu CPF é 123.456.789-00"
   → Sistema detecta e armazena CPF (mascarado nos logs)

2. Cliente: "Quais meus boletos?"
   → LIA chama consulta_boleto_cliente()
   → Sistema busca usando CPF armazenado
   → Valida que o documento bate com a conversa
   → Retorna lista de boletos

3. LIA formata e apresenta os boletos ao cliente
```

## ❌ Erros Comuns

**Erro: "Conversa não encontrada"**
- A função precisa de contexto de conversa válido
- Certifique-se de que a conversa existe no banco de dados

**Erro: "Cliente não identificado"**
- O cliente ainda não forneceu CPF/CNPJ
- A LIA deve solicitar educadamente

**Erro: "Não autorizado"**
- Tentativa de consultar com documento diferente do armazenado
- Validação de segurança bloqueou acesso

## 📝 Notas Técnicas

- **Implementação**: `server/ai-tools.ts` → `consulta_boleto_cliente()`
- **Integração**: `server/lib/openai.ts` → `handleToolCall()`
- **Segurança**: Validação obrigatória de `conversationId` e `clientDocument`
- **Logs**: Mascaramento automático em todos os pontos de log
