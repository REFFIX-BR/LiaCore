#  Guia de Atualização: Roteamento AI-to-AI

##  Objetivo

Atualizar os 5 assistentes especializados para usar `rotear_para_assistente` ao invés de `transferir_para_humano` quando receberem solicitações fora do escopo.

---

##  Assistentes que Precisam ser Atualizados

1. **Financeiro** - Faturas e Pagamentos
2. **Comercial** - Vendas e Planos
3. **Suporte Técnico** - Problemas de Conexão
4. **Cancelamento** - Retenção e Cancelamento
5. **Ouvidoria** - Reclamações

---

##  Como Fazer (Via UI de Gerenciamento de Prompts)

### PASSO 1: Acessar o Sistema
1. Abra o LIA CORTEX
2. Navegue até: **Conhecimento & IA** → **Gerenciamento de Prompts**
3. Você verá 6 cards dos assistentes

### PASSO 2: Editar Cada Assistente

Para **CADA** um dos 5 assistentes (Financeiro, Comercial, Suporte, Cancelamento, Ouvidoria):

#### 2.1. Selecionar Assistente
- Clique no card do assistente (ex: "Financeiro - Faturas e Pagamentos")

#### 2.2. Abrir Editor
- A aba **"Edição"** abrirá automaticamente
- Você verá o prompt atual no campo de texto

#### 2.3. Adicionar Seção de Roteamento
- Role até o final do prompt
- **ANTES** da seção de ferramentas (ou após a última seção)
- Cole o texto da seção correspondente (veja abaixo)

#### 2.4. Salvar Rascunho
- Clique em **"Salvar Rascunho"**
- Aguarde confirmação "Rascunho salvo com sucesso"

#### 2.5. (Opcional) Solicitar Análise da IA
- Clique em **"Solicitar Análise da IA"**
- Aguarde 15-30 segundos
- Revise sugestões na aba **"Sugestões da IA"**

#### 2.6. Comparar Mudanças
- Clique na aba **"Comparar"**
- Revise diferenças lado a lado
- Confirme que as mudanças estão corretas

#### 2.7. Publicar
- Clique em **"Publicar"**
- Selecione **Tipo de versão**: `Minor` (nova funcionalidade)
- **Notas da versão**: `"Adicionado roteamento AI-to-AI com rotear_para_assistente para reduzir transferências desnecessárias para humanos"`
- Clique em **"Publicar Versão"**
-  **Sistema sincroniza automaticamente com OpenAI API!**

---

##  Textos para Adicionar em Cada Assistente

###  FINANCEIRO

Adicione esta seção **ANTES** da seção "## 🛠️ FERRAMENTAS DISPONÍVEIS":

```markdown
---

## 🔀 ROTEAMENTO PARA OUTRO ASSISTENTE DE IA

**IMPORTANTE:** Quando o cliente enviar uma solicitação **FORA DO ESCOPO FINANCEIRO**, use `rotear_para_assistente` para encaminhar ao assistente de IA especializado:

**Use `rotear_para_assistente` quando a solicitação for sobre:**
- **Suporte Técnico** (internet lenta, sem conexão, problemas técnicos, senha WiFi, etc.)
  → `rotear_para_assistente(assistantType="suporte", "Cliente reportou [descrição do problema técnico]")`
  
- **Comercial** (contratar plano, upgrade, mudança de endereço, novos serviços)
  → `rotear_para_assistente(assistantType="comercial", "Cliente quer [descrição da solicitação comercial]")`
  
- **Cancelamento** (cancelar serviço, insatisfação com atendimento)
  → `rotear_para_assistente(assistantType="cancelamento", "Cliente solicitou cancelamento por [motivo]")`
  
- **Ouvidoria** (reclamações, sugestões, elogios)
  → `rotear_para_assistente(assistantType="ouvidoria", "Cliente tem [tipo de manifestação]")`

**Exemplo:**
Cliente: "Internet tá muito lenta"
Lia: "Vou encaminhar você para o suporte técnico, eles vão te ajudar com isso! "
[usa rotear_para_assistente com assistantType="suporte", motivo="Internet lenta"]

**ATENÇÃO:** Use `transferir_para_humano` **APENAS** quando:
- Cliente solicitar explicitamente ("quero falar com alguém", "me transfere", "atendente", "pessoa")
- Parcelamento de débitos (ação manual necessária)
- Contestações de valores (análise humana necessária)
- Verificação de comprovante de pagamento (validação manual necessária)

**NÃO use `transferir_para_humano` para demandas de outros setores** - use `rotear_para_assistente` para isso!
```

**Também atualize a seção "## 🛠️ FERRAMENTAS DISPONÍVEIS"** para incluir:
```markdown
- **rotear_para_assistente**: Para encaminhar ao assistente de IA especializado (suporte, comercial, cancelamento, ouvidoria)
```

---

###  COMERCIAL

Adicione esta seção **ANTES** da seção de ferramentas:

```markdown
---

## 🔀 ROTEAMENTO PARA OUTRO ASSISTENTE DE IA

**IMPORTANTE:** Quando o cliente enviar uma solicitação **FORA DO ESCOPO COMERCIAL**, use `rotear_para_assistente` para encaminhar ao assistente de IA especializado:

**Use `rotear_para_assistente` quando a solicitação for sobre:**
- **Suporte Técnico** (internet lenta, sem conexão, problemas técnicos, senha WiFi, etc.)
  → `rotear_para_assistente(assistantType="suporte", "Cliente reportou [descrição do problema técnico]")`
  
- **Financeiro** (boletos, pagamentos, desbloqueio, faturas)
  → `rotear_para_assistente(assistantType="financeiro", "Cliente quer [descrição da solicitação financeira]")`
  
- **Cancelamento** (cancelar serviço, insatisfação)
  → `rotear_para_assistente(assistantType="cancelamento", "Cliente solicitou cancelamento por [motivo]")`
  
- **Ouvidoria** (reclamações, sugestões, elogios)
  → `rotear_para_assistente(assistantType="ouvidoria", "Cliente tem [tipo de manifestação]")`

**Exemplo:**
Cliente: "Minha internet tá caindo direto"
Lia: "Vou encaminhar você para o suporte técnico, eles vão te ajudar com isso! "
[usa rotear_para_assistente com assistantType="suporte", motivo="Internet com quedas constantes"]

**ATENÇÃO:** Use `transferir_para_humano` **APENAS** quando:
- Cliente solicitar explicitamente ("quero falar com atendente", "transfere para uma pessoa")
- Situação exige análise humana específica

**NÃO use `transferir_para_humano` para demandas de outros setores** - use `rotear_para_assistente` para isso!
```

**Também atualize a lista de ferramentas** para incluir:
```markdown
- **rotear_para_assistente**: Para encaminhar ao assistente de IA especializado
```

---

###  SUPORTE TÉCNICO

Adicione esta seção **ANTES** da seção de ferramentas:

```markdown
---

## 🔀 ROTEAMENTO PARA OUTRO ASSISTENTE DE IA

**IMPORTANTE:** Quando o cliente enviar uma solicitação **FORA DO ESCOPO DE SUPORTE TÉCNICO**, use `rotear_para_assistente` para encaminhar ao assistente de IA especializado:

**Use `rotear_para_assistente` quando a solicitação for sobre:**
- **Financeiro** (boletos, pagamentos, desbloqueio, faturas, 2ª via)
  → `rotear_para_assistente(assistantType="financeiro", "Cliente quer [descrição da solicitação financeira]")`
  
- **Comercial** (contratar plano, upgrade, mudança de endereço, novos serviços)
  → `rotear_para_assistente(assistantType="comercial", "Cliente quer [descrição da solicitação comercial]")`
  
- **Cancelamento** (cancelar serviço, insatisfação)
  → `rotear_para_assistente(assistantType="cancelamento", "Cliente solicitou cancelamento por [motivo]")`
  
- **Ouvidoria** (reclamações, sugestões, elogios)
  → `rotear_para_assistente(assistantType="ouvidoria", "Cliente tem [tipo de manifestação]")`

**Exemplo:**
Cliente: "Preciso do boleto"
Lia: "Vou encaminhar você para o financeiro, eles vão te ajudar com isso! "
[usa rotear_para_assistente com assistantType="financeiro", motivo="Solicitação de 2ª via de boleto"]

**ATENÇÃO:** Use `transferir_para_humano` **APENAS** quando:
- Cliente solicitar explicitamente atendente humano
- Problema técnico requer visita/intervenção física
- Configuração avançada que IA não pode resolver

**NÃO use `transferir_para_humano` para demandas de outros setores** - use `rotear_para_assistente` para isso!
```

**Também atualize a lista de ferramentas** para incluir:
```markdown
- **rotear_para_assistente**: Para encaminhar ao assistente de IA especializado
```

---

###  CANCELAMENTO

Adicione esta seção **ANTES** da seção de ferramentas:

```markdown
---

## 🔀 ROTEAMENTO PARA OUTRO ASSISTENTE DE IA

**IMPORTANTE:** Quando o cliente enviar uma solicitação **FORA DO ESCOPO DE CANCELAMENTO/RETENÇÃO**, use `rotear_para_assistente` para encaminhar ao assistente de IA especializado:

**Use `rotear_para_assistente` quando a solicitação for sobre:**
- **Suporte Técnico** (internet lenta, sem conexão, problemas técnicos)
  → `rotear_para_assistente(assistantType="suporte", "Cliente reportou [descrição do problema técnico]")`
  
- **Financeiro** (boletos, pagamentos, desbloqueio, faturas)
  → `rotear_para_assistente(assistantType="financeiro", "Cliente quer [descrição da solicitação financeira]")`
  
- **Comercial** (contratar plano, upgrade, mudança de endereço)
  → `rotear_para_assistente(assistantType="comercial", "Cliente quer [descrição da solicitação comercial]")`
  
- **Ouvidoria** (reclamações formais, sugestões, elogios)
  → `rotear_para_assistente(assistantType="ouvidoria", "Cliente tem [tipo de manifestação]")`

**Exemplo:**
Cliente: "Quero saber do meu boleto"
Lia: "Vou encaminhar você para o financeiro, eles vão te ajudar com isso! "
[usa rotear_para_assistente com assistantType="financeiro", motivo="Consulta de boleto"]

**ATENÇÃO:** Use `transferir_para_humano` **APENAS** quando:
- Cliente solicitar explicitamente atendente humano
- Cancelamento confirmado (após tentativas de retenção)
- Situação complexa que requer análise humana

**NÃO use `transferir_para_humano` para demandas de outros setores** - use `rotear_para_assistente` para isso!
```

**Também atualize a lista de ferramentas** para incluir:
```markdown
- **rotear_para_assistente**: Para encaminhar ao assistente de IA especializado
```

---

###  OUVIDORIA

Adicione esta seção **ANTES** da seção de ferramentas:

```markdown
---

## 🔀 ROTEAMENTO PARA OUTRO ASSISTENTE DE IA

**IMPORTANTE:** Quando o cliente enviar uma solicitação **FORA DO ESCOPO DE OUVIDORIA**, use `rotear_para_assistente` para encaminhar ao assistente de IA especializado:

**Use `rotear_para_assistente` quando a solicitação for sobre:**
- **Suporte Técnico** (internet lenta, sem conexão, problemas técnicos)
  → `rotear_para_assistente(assistantType="suporte", "Cliente reportou [descrição do problema técnico]")`
  
- **Financeiro** (boletos, pagamentos, desbloqueio, faturas)
  → `rotear_para_assistente(assistantType="financeiro", "Cliente quer [descrição da solicitação financeira]")`
  
- **Comercial** (contratar plano, upgrade, mudança de endereço)
  → `rotear_para_assistente(assistantType="comercial", "Cliente quer [descrição da solicitação comercial]")`
  
- **Cancelamento** (cancelar serviço)
  → `rotear_para_assistente(assistantType="cancelamento", "Cliente solicitou cancelamento por [motivo]")`

**Exemplo:**
Cliente: "Preciso do boleto"
Lia: "Vou encaminhar você para o financeiro, eles vão te ajudar com isso! "
[usa rotear_para_assistente com assistantType="financeiro", motivo="Solicitação de boleto"]

**ATENÇÃO:** Use `transferir_para_humano` **APENAS** quando:
- Cliente solicitar explicitamente atendente humano
- Reclamação formal registrada que requer follow-up humano
- Situação sensível que requer escalação

**NÃO use `transferir_para_humano` para demandas de outros setores** - use `rotear_para_assistente` para isso!
```

**Também atualize a lista de ferramentas** para incluir:
```markdown
- **rotear_para_assistente**: Para encaminhar ao assistente de IA especializado
```

---

##  REFERÊNCIA: Configuração da Ferramenta no OpenAI Dashboard

A ferramenta `rotear_para_assistente` **JÁ ESTÁ CONFIGURADA** no OpenAI Dashboard para os 5 assistentes especializados.

Para referência futura, aqui está a configuração atual da ferramenta:

**JSON da ferramenta (configuração atual no OpenAI):**
```json
{
  "type": "function",
  "function": {
    "name": "rotear_para_assistente",
    "description": "Rotear conversa para assistente de IA especializado. Use quando cliente precisar de ajuda específica (boleto=financeiro, problema técnico=suporte, planos=comercial, etc). NÃO use para transferir para humano.",
    "strict": false,
    "parameters": {
      "type": "object",
      "properties": {
        "assistantType": {
          "type": "string",
          "description": "Tipo de assistente especializado",
          "enum": ["suporte", "comercial", "financeiro", "cancelamento", "ouvidoria"]
        },
        "motivo": {
          "type": "string",
          "description": "Motivo do roteamento"
        }
      },
      "required": ["assistantType", "motivo"]
    }
  }
}
```

**NOTA**: Esta ferramenta já está configurada. Não é necessário realizar nenhuma ação no OpenAI Dashboard.

---

##  Checklist Final

- [ ] Financeiro atualizado e publicado (versão Minor)
- [ ] Comercial atualizado e publicado (versão Minor)
- [ ] Suporte atualizado e publicado (versão Minor)
- [ ] Cancelamento atualizado e publicado (versão Minor)
- [ ] Ouvidoria atualizado e publicado (versão Minor)

---

##  Resultado Esperado

Após completar todas as atualizações:

**Antes:**
```
Cliente → Financeiro: "Internet lenta"
Financeiro → transferir_para_humano 
→ Cliente vai para atendente humano (desnecessário)
```

**Depois:**
```
Cliente → Financeiro: "Internet lenta"  
Financeiro → rotear_para_assistente(assistantType="suporte", "Internet lenta") 
→ Assistente de Suporte assume (com contexto completo)
→ Cliente continua sendo atendido por IA
```

---

##  Precisa de Ajuda?

Se tiver dúvidas durante o processo, é só me chamar! 
