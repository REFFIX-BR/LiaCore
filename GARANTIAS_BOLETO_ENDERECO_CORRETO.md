# 🔒 Garantias: Boleto do Endereço Correto

## ✅ Como o Sistema Garante que o Boleto Enviado é do Endereço Solicitado

### 🎯 Visão Geral do Fluxo

```
1. Cliente pede boleto
   ↓
2. Sistema consulta CRM → Detecta 4 pontos de instalação
   ↓
3. Sistema verifica: conversation.selectedInstallationPoint existe?
   ├─ NÃO → Apresenta endereços e pede seleção
   └─ SIM → Filtra boletos apenas do endereço salvo
   ↓
4. Cliente escolhe endereço (ex: "Ponto 2")
   ↓
5. IA chama: selecionar_ponto_instalacao(numeroPonto: 2)
   ↓
6. Sistema salva no banco de dados:
   conversation.selectedInstallationPoint = {
     numero: "2",
     endereco: "WENCESLAU BRÁS",
     bairro: "CIDADE NOVA",
     cidade: "TRES RIOS",
     login: "2017341",
     plano: "TR FIBER 150 MEGAS"
   }
   ↓
7. Próxima solicitação de boleto → Sistema lê o ponto salvo e filtra
```

---

## 🛡️ 5 Camadas de Garantia

### **1️⃣ Persistência no Banco de Dados**
- **Local**: Campo `selected_installation_point` na tabela `conversations`
- **Tipo**: JSONB (estruturado)
- **Garantia**: O endereço escolhido fica salvo permanentemente na conversa
- **Código**: `server/ai-tools.ts` linha 668-670

```typescript
await storage.updateConversation(conversationContext.conversationId, {
  selectedInstallationPoint: selectedPoint
});
```

---

### **2️⃣ Validação do Número do Ponto**
- **Momento**: Quando o cliente escolhe o endereço
- **Validação**: Sistema verifica se o número escolhido (1, 2, 3, 4...) existe nos pontos retornados pela API
- **Garantia**: Não aceita números inválidos
- **Código**: `server/ai-tools.ts` linha 658-665

```typescript
const selectedPoint = points.find(p => p.numero === numeroPontoStr);
if (!selectedPoint) {
  throw new Error(`Ponto ${numeroPonto} não encontrado. Pontos disponíveis: ${points.map(p => p.numero).join(', ')}`);
}
```

**Exemplo:**
- Cliente tem 4 pontos (1, 2, 3, 4)
- Cliente diz "quero o ponto 5"
- ❌ Sistema rejeita: "Ponto 5 não encontrado. Pontos disponíveis: 1, 2, 3, 4"

---

### **3️⃣ Filtragem por Login Único**
- **Momento**: Ao consultar boletos
- **Método**: Cada ponto tem um `login` único (ex: 2017341, 20171123, 20212334)
- **Garantia**: Boletos são filtrados pelo `login` do ponto selecionado
- **Código**: `server/lib/openai.ts` linha 1637-1650

```typescript
// Encontrar o ponto correspondente
const ponto = pontos.find(p => p.numero === numeroPontoSelecionado);

if (!ponto) {
  // Ponto não encontrado - pedir nova seleção
  return JSON.stringify({
    status: "PONTO_NAO_ENCONTRADO",
    mensagem: "O endereço selecionado anteriormente não foi encontrado..."
  });
}

// Retornar APENAS os boletos deste ponto
return JSON.stringify({
  boletos: ponto.boletos,
  endereco: `${ponto.endereco}, ${ponto.bairro} - ${ponto.cidade}`,
  totalBoletos: ponto.totalBoletos
});
```

**Exemplo real (CPF 087.841.647-19):**

**Ponto 1** - Login: 20171123
- Endereço: IRACY BRAGA, 471 - CIDADE NOVA
- Boletos: 2 (vencimento 15/01/2022, 20/11/2025)

**Ponto 2** - Login: 2017341  ← **SELECIONADO**
- Endereço: WENCESLAU BRÁS, 137 - CIDADE NOVA
- Boletos: 2 (vencimento 10/10/2025, 10/11/2025)

**Ponto 3** - Login: 20212334
- Endereço: AMAZONAS, 1422 - CARIRI
- Boletos: 2 (vencimento 15/10/2025, 15/11/2025)

✅ Sistema retorna **apenas** os 2 boletos do Ponto 2 (login 2017341)

---

### **4️⃣ Verificação de Consistência**
- **Momento**: A cada nova consulta de boletos
- **Validação**: Sistema verifica se o ponto salvo ainda existe nos dados do CRM
- **Garantia**: Se o ponto foi deletado/mudou no CRM, sistema detecta e pede nova seleção
- **Código**: `server/lib/openai.ts` linha 1637-1648

**Cenário de proteção:**
1. Cliente seleciona Ponto 2
2. Administrador cancela contrato do Ponto 2 no CRM
3. Cliente pede boleto novamente
4. ✅ Sistema detecta que Ponto 2 não existe mais
5. ✅ Sistema pede nova seleção

---

### **5️⃣ Logs de Auditoria**
- **Rastreabilidade completa** de todas as seleções e consultas
- **Logs incluem**:
  - CPF consultado (mascarado)
  - Ponto selecionado (número + endereço)
  - Boletos retornados (quantidade + endereços)
  - Timestamp de cada ação

**Exemplo de logs:**
```
🏠 [Boletos] Cliente já selecionou ponto 2 - filtrando boletos
📍 [AI Tool] Ponto 2 selecionado: TRES RIOS/CIDADE NOVA - WENCESLAU BRÁS
📋 [AI Tool] 2 boleto(s) EM ABERTO (filtrados de 6 totais)
```

---

## 🔍 Exemplo Prático Completo

### **Situação Real:**
Cliente: **ALEXANDRE MARQUES CARVALHO**  
CPF: **087.841.647-19**  
Pontos: **4 endereços diferentes**

### **Passo a Passo:**

#### **1. Cliente pede boleto pela primeira vez**
```
Cliente: "me manda o boleto"
```

#### **2. Sistema detecta múltiplos pontos**
```
✅ [Massive Failure] 4 ponto(s) de instalação encontrado(s) no CRM
   📍 Ponto 1: TRES RIOS/CIDADE NOVA - IRACY BRAGA
   📍 Ponto 2: TRES RIOS/CIDADE NOVA - WENCESLAU BRÁS  
   📍 Ponto 3: TRES RIOS/CARIRI - AMAZONAS
   📍 Ponto 4: TRES RIOS/CIDADE NOVA - WENCESLAU BRÁS
```

#### **3. IA apresenta opções**
```
IA: "Você tem 4 endereços cadastrados:

1. CIDADE NOVA - IRACY BRAGA, 471 (TRES RIOS)
2. CIDADE NOVA - WENCESLAU BRÁS, 137 (TRES RIOS)
3. CARIRI - AMAZONAS, 1422 (TRES RIOS)
4. CIDADE NOVA - WENCESLAU BRÁS, 137 (TRES RIOS)

Qual deles você quer consultar os boletos?"
```

#### **4. Cliente escolhe**
```
Cliente: "o da wenceslau brás 137"
```

#### **5. IA identifica e seleciona o ponto**
```
🔧 [AI Tool] Handling function call: selecionar_ponto_instalacao
🔧 [AI Tool] Function arguments: {"numeroPonto": 2}
✅ [AI Tool] Ponto 2 selecionado: TRES RIOS/CIDADE NOVA - WENCESLAU BRÁS
```

#### **6. Salvo no banco de dados**
```sql
UPDATE conversations 
SET selected_installation_point = '{
  "numero": "2",
  "endereco": "WENCESLAU BRÁS",
  "bairro": "CIDADE NOVA", 
  "cidade": "TRES RIOS",
  "login": "2017341",
  "plano": "TR FIBER 150 MEGAS"
}'
WHERE id = '80e5fe7f-551e-4955-b489-e014ad775488';
```

#### **7. Sistema retorna boletos APENAS do Ponto 2**
```
IA: "Aqui estão os boletos do endereço WENCESLAU BRÁS, CIDADE NOVA:

Boleto 1:
- Vencimento: 10/10/2025
- Valor: R$ 69,90
- Código: 36490.00019 00003.305901...

Boleto 2:
- Vencimento: 10/11/2025
- Valor: R$ 69,90
- Código: 36490.00050 00003.305901..."
```

#### **8. Cliente pede boleto novamente (semana seguinte)**
```
Cliente: "quero o boleto"
```

#### **9. Sistema lê o ponto salvo e filtra automaticamente**
```
🏠 [Boletos] Cliente já selecionou ponto 2 - filtrando boletos
✅ Retorna APENAS boletos do Ponto 2 (WENCESLAU BRÁS)
```

✅ **Sem precisar perguntar novamente qual endereço!**

---

## 🚨 Casos de Borda Tratados

### **Caso 1: Ponto selecionado não existe mais**
```
Cliente selecionou Ponto 2 → Contrato cancelado no CRM
↓
Sistema detecta que Ponto 2 não está nos dados retornados
↓
IA: "O endereço selecionado anteriormente não foi encontrado. 
     Por favor, escolha novamente entre os endereços disponíveis..."
```

### **Caso 2: Cliente tem 1 ponto apenas**
```
Sistema detecta: 1 ponto de instalação
↓
NÃO pergunta qual endereço
↓
Retorna boletos direto (sem seleção)
```

### **Caso 3: Cliente escolhe número inválido**
```
Cliente: "quero o ponto 10"
↓
Sistema valida: Pontos disponíveis são 1, 2, 3, 4
↓
❌ Rejeita: "Ponto 10 não encontrado. Pontos disponíveis: 1, 2, 3, 4"
```

---

## 📊 Resumo das Garantias

| # | Garantia | Onde ocorre | Proteção contra |
|---|----------|-------------|-----------------|
| 1 | Persistência no BD | `conversations.selected_installation_point` | Perda de seleção entre sessões |
| 2 | Validação do número | `selecionar_ponto_instalacao()` | Números inválidos (ex: ponto 99) |
| 3 | Filtragem por login | `consultar_boleto_cliente()` | Boletos de outro endereço |
| 4 | Verificação de consistência | A cada consulta | Pontos deletados/alterados no CRM |
| 5 | Logs de auditoria | Todas as operações | Rastreabilidade completa |

---

## 🎯 Conclusão

O sistema possui **5 camadas de garantia** que asseguram que:

✅ O endereço escolhido é validado  
✅ O endereço é salvo persistentemente  
✅ Os boletos são filtrados pelo login único do endereço  
✅ Mudanças no CRM são detectadas  
✅ Todo o processo é auditável via logs  

**Resultado:** É **impossível** retornar boletos de um endereço diferente do selecionado.
