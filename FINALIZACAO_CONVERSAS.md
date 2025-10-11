# 📋 Matriz de Finalização de Conversas - LIA CORTEX

## 🎯 Visão Geral

Este documento define quando cada assistente especializado PODE ou NÃO PODE finalizar conversas autonomamente, garantindo que pesquisas NPS sejam enviadas corretamente e conversas sejam encerradas de forma adequada.

---

## 📊 Matriz de Finalização por Assistente

| Assistente | Pode Finalizar? | Quando Finaliza | Quando NÃO Finaliza |
|-----------|-----------------|-----------------|---------------------|
| **SUPORTE** | ✅ Sim | Problema resolvido + Cliente confirma satisfação | Vai transferir para humano |
| **FINANCEIRO** | ✅ Sim | Boleto enviado/informação dada + Cliente satisfeito | Parcelamento, comprovante, contestação |
| **COMERCIAL** | ✅ Sim | Apenas consultou informações + Cliente satisfeito | Contratação, mudança endereço/cômodo |
| **CANCELAMENTO** | ❌ Não | NUNCA finaliza | SEMPRE transfere para humano |
| **OUVIDORIA** | ❌ Não | NUNCA finaliza | SEMPRE transfere para supervisor |
| **APRESENTAÇÃO** | ❌ Não | NUNCA finaliza | SEMPRE roteia/transfere |

---

## ✅ ASSISTENTES QUE PODEM FINALIZAR

### 1. SUPORTE TÉCNICO

**Pode finalizar quando:**
- Diagnóstico realizado e problema resolvido
- Cliente confirma que está funcionando
- Cliente agradece ou demonstra satisfação ("Obrigado", "Funcionou", "Tudo certo")

**Exemplo de finalização:**
```
Cliente: "Funcionou! Obrigado pela ajuda"
Lia: "Que ótimo! Fico feliz que tenha funcionado, João! Qualquer coisa, estou por aqui 😊"
[usa finalizar_conversa com motivo="Problema de conexão resolvido"]
(Sistema envia automaticamente pesquisa NPS)
```

**NÃO finaliza quando:**
- Vai transferir para humano (configuração WiFi, procedimentos avançados)
- Problema não foi resolvido
- Cliente ainda tem dúvidas

---

### 2. FINANCEIRO

**Pode finalizar quando:**
- Cliente pediu boleto → Enviou → Cliente confirma ("Obrigado", "Recebi")
- Cliente pediu informação sobre vencimento/pagamento → Respondeu → Cliente satisfeito
- Explicou política de redução/desbloqueio → Cliente entendeu

**Exemplo de finalização:**
```
Cliente: "Obrigado, recebi!"
Lia: "Que bom que pude ajudar! Qualquer coisa, estou à disposição 😊"
[usa finalizar_conversa com motivo="Boleto enviado com sucesso"]
(Sistema envia automaticamente pesquisa NPS)
```

**NÃO finaliza quando:**
- Parcelamento de débitos (sempre transfere)
- Verificação de comprovante (sempre transfere)
- Contestação de valores (sempre transfere)
- Endereço não consta no sistema (sempre transfere)

---

### 3. COMERCIAL

**Pode finalizar quando:**
- Cliente pediu APENAS informações sobre planos/cobertura (sem intenção de contratar)
- Cliente recebeu as informações solicitadas
- Cliente confirma satisfação ("Obrigado", "Entendi", "Valeu")

**Exemplo de finalização:**
```
Cliente: "Obrigado, vou pensar"
Lia: "Que bom que pude ajudar! Se quiser contratar depois, é só chamar 😊"
[usa finalizar_conversa com motivo="Informações sobre planos fornecidas"]
(Sistema envia automaticamente pesquisa NPS)
```

**NÃO finaliza quando:**
- Contratação (sempre transfere após coletar dados)
- Mudança de endereço (sempre transfere)
- Mudança de cômodo (sempre transfere)
- Mudança de titularidade (sempre transfere)
- Cliente demonstrou interesse em contratar

---

## ❌ ASSISTENTES QUE NUNCA FINALIZAM

### 4. CANCELAMENTO

**Por que NUNCA finaliza:**
- Se cliente aceitar alternativa → SEMPRE transferir para humano efetuar mudança
- Se cliente insistir em cancelamento → SEMPRE transferir para humano confirmar
- Cancelamento é processo crítico que SEMPRE requer intervenção humana

**Regra absoluta:**
- ✅ SEMPRE use `transferir_para_humano` ao final
- ❌ NUNCA use `finalizar_conversa`

---

### 5. OUVIDORIA

**Por que NUNCA finaliza:**
- Após coletar relato completo → SEMPRE transferir para supervisor de Ouvidoria
- Se assunto for técnico/comercial/financeiro → SEMPRE transferir para setor apropriado
- Ouvidoria é registro formal que SEMPRE requer intervenção humana

**Regra absoluta:**
- ✅ SEMPRE use `transferir_para_humano` ao final
- ❌ NUNCA use `finalizar_conversa`

---

### 6. APRESENTAÇÃO (Recepcionista)

**Por que NUNCA finaliza:**
- Função é apenas identificar demanda e rotear para assistente especializado
- SEMPRE transfere ou roteia após entender necessidade
- Não resolve demandas - apenas encaminha

**Regra absoluta:**
- ✅ SEMPRE use `transferir_para_humano` ou `rotear_para_assistente`
- ❌ NUNCA use `finalizar_conversa`

---

## 🔄 Regras Universais de Finalização

Baseadas no documento **kb-geral-002** da base de conhecimento:

### Quando Finalizar (para assistentes autorizados):

1. Problema do cliente foi **COMPLETAMENTE** resolvido **E**
2. Não houver pendências técnicas ou comerciais **E**
3. Cliente confirmar satisfação com palavras-chave:
   - "Tudo certo"
   - "Resolvido"
   - "Obrigado" / "Valeu"
   - "Funcionou"
   - "Recebi"

### Como Finalizar:

1. **Enviar mensagem de encerramento:**
   ```
   "Que bom que pude ajudar, {{nome}}! Qualquer coisa, estou por aqui 😊"
   ```

2. **Imediatamente após, usar a ferramenta:**
   ```
   finalizar_conversa({
     "motivo": "Problema resolvido" // ou descrição específica
   })
   ```

### O que acontece ao finalizar:

- ✅ Conversa marcada como resolvida no sistema
- ✅ Cliente recebe pesquisa de satisfação **NPS automaticamente via WhatsApp**
- ✅ Sistema registra a conclusão do atendimento
- ✅ Métricas de resolução são atualizadas

### Quando NÃO Finalizar:

- ❌ Cliente ainda tem dúvidas
- ❌ Problema não foi totalmente resolvido
- ❌ Vai transferir para humano (use `transferir_para_humano` ao invés)
- ❌ Processo de coleta de dados está em andamento

---

## 🛠️ Ferramentas Relacionadas

### `finalizar_conversa`

**Disponível para:**
- ✅ SUPORTE
- ✅ FINANCEIRO
- ✅ COMERCIAL

**NÃO disponível para:**
- ❌ CANCELAMENTO
- ❌ OUVIDORIA
- ❌ APRESENTAÇÃO

### `transferir_para_humano`

**Disponível para:**
- ✅ TODOS os assistentes

**Uso:** Quando assistente não pode ou não deve resolver sozinho

---

## 📈 Impacto no NPS

### ✅ COM Finalização Correta:
- Cliente recebe NPS após problema resolvido
- Feedback positivo sobre resolução
- Métricas precisas de satisfação

### ❌ SEM Finalização (Bug Anterior):
- Conversa fica aberta indefinidamente
- NPS não é enviado
- Cliente não pode avaliar atendimento
- Métricas imprecisas

---

## 🔍 Referências

- **Base de Conhecimento:** `kb-geral-002` (Regras de Finalização de Conversa)
- **Arquivo de Configuração:** `INSTRUCOES_ASSISTENTES_OPENAI.md`
- **Sistema de NPS:** Automaticamente acionado após `finalizar_conversa`

---

## 📝 Histórico de Mudanças

### 2025-01-11 - Correção Crítica
- ✅ Adicionada seção de finalização em FINANCEIRO
- ✅ Adicionada seção de finalização em COMERCIAL
- ✅ Removida finalização incorreta de CANCELAMENTO (agora NUNCA finaliza)
- ✅ Removida finalização incorreta de OUVIDORIA (agora NUNCA finaliza)
- ✅ Confirmado que APRESENTAÇÃO NUNCA finaliza (correto)
- ✅ Confirmado que SUPORTE já tinha finalização correta

**Problema Resolvido:** Antes apenas SUPORTE finalizava conversas, causando conversas abertas indefinidamente e NPS não enviado para outros departamentos.
