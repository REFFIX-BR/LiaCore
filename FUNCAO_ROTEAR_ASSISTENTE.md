# Função rotear_para_assistente - Assistentes OpenAI

## ⚠️ IMPORTANTE: Configuração Manual no OpenAI

Esta função **DEVE ser adicionada manualmente** aos 5 assistentes especializados no OpenAI Dashboard:
- **Suporte Técnico** - Para rotear demandas de Financeiro, Comercial, Cancelamento, Ouvidoria
- **Comercial** - Para rotear demandas de Suporte, Financeiro, Cancelamento, Ouvidoria  
- **Financeiro** - Para rotear demandas de Suporte, Comercial, Cancelamento, Ouvidoria
- **Cancelamento** - Para rotear demandas de Suporte, Comercial, Financeiro, Ouvidoria
- **Ouvidoria** - Para rotear demandas de Suporte, Comercial, Financeiro, Cancelamento

**❌ NÃO adicionar ao assistente Recepcionista (Apresentação)** - ele já tem esta ferramenta configurada.

## Definição da Ferramenta (Function Calling)

```json
{
  "type": "function",
  "function": {
    "name": "rotear_para_assistente",
    "description": "Roteia a conversa para um ASSISTENTE DE IA especializado quando o cliente enviar uma solicitação FORA DO ESCOPO do assistente atual. Use esta função para encaminhar ao assistente de IA correto (suporte, comercial, financeiro, cancelamento, ouvidoria). NÃO confunda com transferir_para_humano - esta função mantém o atendimento com IA, apenas troca de assistente.",
    "parameters": {
      "type": "object",
      "properties": {
        "departamento": {
          "type": "string",
          "description": "Tipo de assistente de IA para o qual rotear",
          "enum": ["suporte", "comercial", "financeiro", "cancelamento", "ouvidoria"]
        },
        "motivo": {
          "type": "string",
          "description": "Breve descrição do motivo do roteamento com contexto específico da solicitação do cliente (ex: 'Cliente reportou internet lenta há 2 dias', 'Cliente quer contratar plano 500 Mbps', 'Cliente solicitou 2ª via de boleto vencido')"
        }
      },
      "required": ["departamento", "motivo"]
    }
  }
}
```

## Quando Usar

Use `rotear_para_assistente` quando:
- ✅ Cliente envia solicitação **FORA DO SEU ESCOPO**
- ✅ Outro assistente de IA pode resolver o problema
- ✅ Quer manter atendimento automatizado (IA-para-IA)

**Exemplos por Assistente:**

### Se você é o Assistente Financeiro:
- Cliente: "Internet tá lenta" → `rotear_para_assistente("suporte", "Internet lenta")`
- Cliente: "Quero contratar" → `rotear_para_assistente("comercial", "Interesse em contratação")`
- Cliente: "Quero cancelar" → `rotear_para_assistente("cancelamento", "Solicitação de cancelamento")`

### Se você é o Assistente de Suporte:
- Cliente: "Preciso do boleto" → `rotear_para_assistente("financeiro", "Solicitação de 2ª via de boleto")`
- Cliente: "Quero upgrade" → `rotear_para_assistente("comercial", "Interesse em upgrade de plano")`
- Cliente: "Quero cancelar" → `rotear_para_assistente("cancelamento", "Solicitação de cancelamento")`

### Se você é o Assistente Comercial:
- Cliente: "Internet caiu" → `rotear_para_assistente("suporte", "Internet sem conexão")`
- Cliente: "Onde tá meu boleto?" → `rotear_para_assistente("financeiro", "Solicitação de boleto")`
- Cliente: "Quero reclamar" → `rotear_para_assistente("ouvidoria", "Cliente quer fazer reclamação")`

## ❌ NÃO Use rotear_para_assistente quando:

- Cliente solicita **explicitamente** atendente humano → Use `transferir_para_humano`
- Problema requer ação manual/humana → Use `transferir_para_humano`  
- Solicitação está **DENTRO DO SEU ESCOPO** → Continue atendendo

## Diferença: rotear_para_assistente vs transferir_para_humano

| Situação | Use | Motivo |
|----------|-----|---------|
| Cliente: "Internet lenta" (Financeiro atendendo) | `rotear_para_assistente("suporte", ...)` | IA de Suporte pode resolver |
| Cliente: "Quero falar com atendente" | `transferir_para_humano(...)` | Cliente pediu humano explicitamente |
| Cliente: "Preciso parcelar débito" | `transferir_para_humano(...)` | Requer análise/aprovação humana |

## Comportamento

Quando a função é chamada:
1. Sistema identifica o assistente correto (suporte, comercial, financeiro, etc.)
2. **Contexto completo da conversa é PRESERVADO**
3. Novo assistente de IA assume com todo o histórico disponível
4. Cliente **NÃO percebe troca** - transição transparente
5. Novo assistente responde de acordo com seu escopo

## Exemplo de Uso no Assistente Financeiro

```
Cliente: "Internet tá muito lenta"
Assistente Financeiro: "Vou encaminhar você para o suporte técnico, eles vão te ajudar com isso! 👍"
[CHAMA rotear_para_assistente com departamento="suporte", motivo="Cliente reportou lentidão na internet"]
→ Sistema roteia para Assistente de Suporte
→ Assistente de Suporte: "Oi! Vou te ajudar com a lentidão da internet. Qual seu CPF para eu verificar?"
```

## Implementação no Código

A função está implementada em:
- `server/ai-tools.ts` - rotearParaAssistenteEspecializado() (linha 1198)
- `server/ai-tools.ts` - executeAssistantTool() case 'rotear_para_assistente' (linha 1247-1251)
- `server/workers.ts` - Detecção e processamento do roteamento

O fluxo:
```
IA chama rotear_para_assistente("suporte", "Internet lenta")
  → rotearParaAssistenteEspecializado retorna {roteado: true, assistente: "suporte", motivo: "Internet lenta"}
  → Worker detecta roteamento
  → Atualiza conversation.assistantType = "suporte"  
  → Próxima mensagem vai para Assistente de Suporte
  → Contexto completo preservado
```

## 🔒 Regra Crítica de Segurança

**NUNCA use `transferir_para_humano` quando `rotear_para_assistente` é apropriado!**

Isso causa:
- ❌ Transferências desnecessárias para fila de atendentes humanos
- ❌ Sobrecarga de trabalho humano com tarefas que IA resolve
- ❌ Tempo de espera maior para o cliente
- ❌ Custos operacionais desnecessários

**Use `rotear_para_assistente` sempre que outro assistente de IA puder resolver.**
