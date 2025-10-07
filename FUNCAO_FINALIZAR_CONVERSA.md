# Função finalizar_conversa - Assistentes OpenAI

## ⚠️ IMPORTANTE: Configuração Manual no OpenAI

Esta função **DEVE ser adicionada manualmente** aos 6 assistentes no OpenAI Dashboard:
- Suporte (`asst_CDkh1oE8YvKLtJYs3WY4rJX8`)
- Comercial
- Financeiro
- Cancelamento
- Ouvidoria
- Apresentação

## Definição da Ferramenta (Function Calling)

```json
{
  "type": "function",
  "function": {
    "name": "finalizar_conversa",
    "description": "Finaliza uma conversa quando o problema do cliente foi completamente resolvido. Ao chamar esta função, a conversa será marcada como resolvida e o cliente receberá automaticamente uma pesquisa de satisfação NPS via WhatsApp.",
    "parameters": {
      "type": "object",
      "properties": {
        "motivo": {
          "type": "string",
          "description": "Breve descrição do motivo da finalização (ex: 'Problema resolvido', 'Dúvida esclarecida', 'Solicitação atendida')"
        }
      },
      "required": []
    }
  }
}
```

## Quando Usar

Use `finalizar_conversa` quando:
- ✅ O problema do cliente foi **completamente** resolvido
- ✅ Não há mais pendências ou dúvidas
- ✅ O cliente confirmou que está satisfeito com a solução

**NÃO use** quando:
- ❌ O problema ainda não foi resolvido
- ❌ Você vai transferir para humano (use `transferir_para_humano`)
- ❌ Precisa de mais informações do cliente

## Comportamento

Quando a função é chamada:
1. A conversa é marcada como `resolved`
2. Flag `metadata.awaitingNPS = true` é setada
3. Cliente recebe pesquisa NPS via WhatsApp automaticamente
4. Sistema aguarda resposta do cliente (0-10)
5. Feedback é armazenado e métricas atualizadas

## Exemplo de Uso no Assistente

```
Cliente: "Funcionou! Obrigado!"
Assistente: "Que ótimo! Fico feliz que tenha funcionado. Se precisar de qualquer coisa, estou por aqui!"
[CHAMA finalizar_conversa com motivo: "Problema de conexão resolvido"]
```

## Implementação no Código

A função está implementada em:
- `server/lib/openai.ts` - handleToolCall (case "finalizar_conversa")
- `server/routes.ts` - Processamento do webhook Evolution (if result.resolved)

O fluxo:
```
IA chama finalizar_conversa 
  → handleToolCall retorna {success: true, motivo: "..."}
  → Webhook detecta result.resolved
  → Marca conversa como resolved + seta awaitingNPS
  → Envia pesquisa NPS via WhatsApp
  → Cliente responde → Feedback salvo → Flag removido
```
