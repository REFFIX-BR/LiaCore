# Teste: Consulta de Boletos com Múltiplos Endereços

## Objetivo
Testar a funcionalidade de consulta de boletos quando o cliente possui múltiplos pontos de instalação.

## CPF de Teste
**CPF**: 10441834701 (cliente com múltiplos pontos de instalação)

## Fluxo de Teste

### 1️⃣ Primeira Consulta (Sem Seleção de Endereço)

**Ação do Cliente:**
```
Cliente: Meu CPF é 104.418.347-01
Cliente: Quais são meus boletos?
```

**Comportamento Esperado:**
- ✅ Sistema detecta que o CPF tem múltiplos pontos de instalação
- ✅ Sistema retorna lista de endereços disponíveis
- ✅ Cada endereço mostra:
  - Número do ponto
  - Endereço completo (rua, bairro, cidade)
  - Quantidade de boletos pendentes
  - Quantidade de boletos vencidos
  - Valor total
- ✅ IA pergunta ao cliente qual endereço ele deseja consultar

**Resposta da API** (exemplo):
```json
{
  "status": "MULTIPLOS_PONTOS_DETECTADOS",
  "mensagem": "Cliente possui 2 endereços de instalação...",
  "pontos": [
    {
      "numero": "1",
      "endereco": "Rua Exemplo, 123, Centro - Cidade",
      "totalBoletos": 3,
      "totalVencidos": 1,
      "valorTotal": "R$ 450.00"
    },
    {
      "numero": "2",
      "endereco": "Av Principal, 456, Bairro - Cidade",
      "totalBoletos": 2,
      "totalVencidos": 0,
      "valorTotal": "R$ 300.00"
    }
  ],
  "instrucao_ia": "IMPORTANTE: Apresente os endereços..."
}
```

### 2️⃣ Seleção do Endereço

**Ação do Cliente:**
```
Cliente: Quero consultar o endereço 1
```

**Comportamento Esperado:**
- ✅ IA identifica que cliente escolheu ponto "1"
- ✅ IA chama função `selecionar_ponto_instalacao` com parâmetro `numeroPonto: 1`
- ✅ Sistema salva seleção em `conversation.selectedInstallationPoint`
- ✅ Sistema verifica se há falha massiva naquele endereço
- ✅ IA informa que o endereço foi selecionado

### 3️⃣ Segunda Consulta (Com Endereço Já Selecionado)

**Ação do Cliente:**
```
Cliente: Quais são os boletos desse endereço?
```

**Comportamento Esperado:**
- ✅ Sistema detecta que `conversation.selectedInstallationPoint` já está definido
- ✅ Sistema busca boletos usando a API
- ✅ Sistema filtra apenas os boletos do ponto selecionado (ponto 1)
- ✅ IA exibe boletos do endereço selecionado
- ✅ Resposta inclui informação de qual endereço está sendo consultado

**Resposta da API** (exemplo):
```json
{
  "status": "COM_DEBITOS",
  "mensagem": "Endereço: Rua Exemplo, 123, Centro - Cidade. 3 boleto(s) pendente(s).",
  "enderecoSelecionado": "Rua Exemplo, 123, Centro - Cidade",
  "quantidade_boletos": 3,
  "boletos": [
    {
      "vencimento": "2025-11-05",
      "valor": "150,00",
      "codigo_barras": "...",
      "link_pagamento": "https://...",
      "pix": "...",
      "status": "EM ABERTO"
    },
    // ... mais boletos
  ]
}
```

## Casos de Teste Adicionais

### Caso 4: Mudança de Endereço
**Ação:**
```
Cliente: Na verdade, quero consultar o endereço 2
```

**Esperado:**
- ✅ IA chama `selecionar_ponto_instalacao` com `numeroPonto: 2`
- ✅ Sistema atualiza `selectedInstallationPoint` para ponto 2
- ✅ Próximas consultas mostram boletos do ponto 2

### Caso 5: Cliente com Ponto Único
**CPF de Teste:** Qualquer CPF com apenas 1 ponto de instalação

**Esperado:**
- ✅ Sistema não detecta múltiplos pontos
- ✅ Retorna boletos diretamente sem pedir seleção
- ✅ Fluxo normal de consulta de boleto

## Implementação Técnica

### Estrutura de Dados

**Quando há múltiplos pontos:**
```typescript
{
  hasMultiplePoints: true,
  totalBoletos: number,
  pontos: [
    {
      numero: string,
      nome: string,
      endereco: string,
      bairro: string,
      cidade: string,
      boletos: ConsultaBoletoResult[],  // ✅ Boletos JÁ estão aqui
      totalBoletos: number,
      totalVencidos: number,
      valorTotal: number
    }
  ]
}
```

**Quando há ponto único:**
```typescript
{
  hasMultiplePoints: false,
  totalBoletos: number,
  boletos: ConsultaBoletoResult[]
}
```

### Persistência
```typescript
// Campo no schema de conversations
selectedInstallationPoint: jsonb("selected_installation_point")

// Estrutura salva
{
  numero: "1",
  endereco: "Rua...",
  bairro: "Centro",
  cidade: "Cidade"
}
```

## Logs para Monitorar

Durante o teste, observe estes logs:

```
📋 [AI Tool] X boleto(s) retornado(s) pela API
📍 [AI Tool] MÚLTIPLOS PONTOS DETECTADOS: X pontos
📍 [AI Tool] Ponto 1: Rua..., Bairro - X boleto(s), X vencido(s), Total: R$ X
🏠 [Boletos] Cliente possui X pontos de instalação - solicitando seleção
🔀 [AI Tool Handler] Selecionando ponto de instalação...
✅ [AI Tool] Ponto X selecionado: Cidade/Bairro - Endereço
🏠 [Boletos] Cliente já selecionou ponto X - filtrando boletos
```

## Checklist de Validação

- [ ] Cliente com múltiplos pontos recebe lista de endereços
- [ ] IA pede ao cliente que escolha o endereço
- [ ] Função `selecionar_ponto_instalacao` é chamada corretamente
- [ ] Seleção é salva em `conversation.selectedInstallationPoint`
- [ ] Consultas subsequentes filtram boletos do endereço selecionado
- [ ] Resposta informa qual endereço está sendo consultado
- [ ] Cliente pode trocar de endereço selecionado
- [ ] Sistema verifica falha massiva no endereço selecionado
- [ ] Cliente com ponto único tem fluxo normal sem seleção

## Status
✅ **Implementação Completa**
- Handler atualizado em `server/lib/openai.ts`
- Tratamento de múltiplos pontos implementado
- Reutilização da tool `selecionar_ponto_instalacao` existente
- Servidor rodando sem erros

🧪 **Pronto para Teste pelo Usuário**
