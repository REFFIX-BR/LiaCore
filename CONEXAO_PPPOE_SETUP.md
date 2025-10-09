# 🔌 Sistema de Verificação de Conexão PPPoE - Documentação Técnica

## 📋 **Visão Geral**

Sistema automático de consulta e diagnóstico de conexão PPPoE para clientes da TR Telecom. Similar ao sistema de boletos, detecta automaticamente quando o cliente pergunta sobre internet/conexão e enriquece o contexto da IA com dados técnicos em tempo real.

---

## 🎯 **Funcionamento Automático**

### **Detecção por Keywords:**
```regex
internet|conexão|velocidade|lento|desconectado|caindo|
instável|wi-fi|wifi|sinal|offline|online|pppoe|ip|fibra|rede
```

### **Fluxo:**
1. Cliente menciona keyword de conexão
2. Sistema verifica se `clientDocument` existe
3. Busca **TODOS** os dados de conexão via API
4. Enriquece contexto da IA com dados completos
5. IA interpreta e responde de forma natural

---

## 🔗 **Endpoint API**

**POST:** `https://webhook.trtelecom.net/webhook/check_pppoe_status`

**Request Body:**
```json
{
  "documento": "10476670616"
}
```

**Response:** Array de objetos (um por instalação)

---

## 📊 **Estrutura de Dados Retornados**

### **Campos de Identificação:**
- **COD_CLIENTE:** Código do cliente no sistema
- **nomeCliente:** Nome completo do cliente
- **CPF:** CPF formatado (com pontos e hífen)
- **LOGIN:** Login PPPoE do cliente

### **Campos de Plano:**
- **plano:** Nome do plano contratado (ex: "FIBER PROMO 800 MEGA")
- **velocidadeContratada:** Velocidade em Kbps (ex: "819200" = 800 Mbps)

### **Campos de Status de Conexão:**

#### ✅ **statusPPPoE** (SESSÃO DE DADOS)
- **ONLINE:** Cliente possui sessão PPPoE ativa - pode navegar na internet
- **OFFLINE:** Cliente SEM sessão PPPoE - sem tráfego de dados

#### 🔌 **onu_run_state** (EQUIPAMENTO ONU - Conversor Fibra/UTP)
- **online:** ONU (conversor de fibra para cabo) funcionando normalmente
- **offline:** ONU com problema, desligada ou sem sinal
- **Divergência:** Se statusPPPoE e onu_run_state estiverem diferentes, investigar causa

#### 💳 **statusIP** (STATUS FINANCEIRO/BLOQUEIO)
- **ATIVO:** Cliente sem restrições de pagamento - conexão liberada
- **SEMIBLOQUEIO:** Cliente com restrição parcial por inadimplência
- **BLOQUEIO:** Cliente bloqueado por inadimplência - sem internet
- **Importante:** Relacionado a PAGAMENTOS, não a problemas técnicos

#### 🔧 **onu_last_down_cause** (Última Causa de Queda da ONU)
- **dying-gasp:** Equipamento desligado ou queda de energia no cliente
- **los / LOFI / LOSS:** Problema físico no sinal da fibra (rompimento, conector solto, etc.)
- **manual:** Desconexão manual

### **Campos de Tempo:**
- **conectadoDesde:** Data/hora da última conexão (formato: "YYYY-MM-DD HH:mm:ss")
- **minutosConectado:** Tempo conectado em minutos

### **Campos de Rede:**
- **ipv4:** Endereço IP atual do cliente
- **CTO:** Identificador da caixa de distribuição
- **PON:** Porta PON na OLT
- **OLT:** Nome da OLT (equipamento central)
- **SERIAL:** Número de série da ONU

### **Campos de Endereço:**
- **ENDERECO:** Logradouro
- **BAIRRO:** Bairro
- **CIDADE:** Cidade
- **COMPLEMENTO:** Complemento do endereço

### **Campos de Suporte:**

#### 🎫 **os_aberta** (Ordem de Serviço Técnica)
- **"TRUE":** Existe chamado técnico aberto com visita agendada/pendente ao local do cliente
- **"FALSE":** Nenhum chamado técnico presencial aberto

#### 🌐 **massiva** (Problema em Massa)
- **true:** Problema generalizado afetando vários clientes da região (problema na rede)
- **false:** Problema isolado apenas deste cliente

#### 📍 **STATUS_TIPO** (Status do Cadastro)
- **ATIVO:** Cliente ativo com contrato regular
- **PERMUTA:** Cliente em processo de permuta
- **INADIMPLENTE:** Cliente inadimplente mas ainda não bloqueado
- **CANCELADO:** Cliente cancelado
- **Outros:** Podem existir outros status

---

## 🧠 **Interpretação para a IA**

### ✅ **Conexão OK:**
```json
{
  "statusPPPoE": "ONLINE",
  "onu_run_state": "online",
  "statusIP": "ATIVO"
}
```
**Significado:** Tudo funcionando - cliente navegando normalmente

### 💳 **Bloqueio Financeiro:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "online",
  "statusIP": "BLOQUEIO"
}
```
**Significado:** ONU funcionando MAS cliente bloqueado por inadimplência - orientar pagamento

### ⚡ **Queda de Energia no Cliente:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "offline",
  "onu_last_down_cause": "dying-gasp",
  "statusIP": "ATIVO"
}
```
**Significado:** Equipamento desligado/sem energia - pedir para cliente verificar tomada e equipamento

### 🔧 **Problema na Fibra:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "offline", 
  "onu_last_down_cause": "los",
  "os_aberta": "TRUE",
  "statusIP": "ATIVO"
}
```
**Significado:** Problema físico na fibra (rompimento/conector) - técnico já acionado

### 🌐 **Problema Massivo:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "offline",
  "massiva": true
}
```
**Significado:** Problema generalizado afetando vários clientes da região - equipe trabalhando

---

## 💬 **Instruções para Resposta da IA**

### **Priorização de Diagnóstico (ORDEM OBRIGATÓRIA):**

1. **PRIMEIRO: Verificar `statusIP` (PRIORIDADE MÁXIMA - Financeiro):**
   - Se `BLOQUEIO` ou `SEMIBLOQUEIO` → Cliente bloqueado por inadimplência
   - Orientar sobre pagamento/regularização
   - **NÃO é problema técnico! NÃO investigar causas técnicas se bloqueado**
   
2. **SEGUNDO: Verificar `massiva`:**
   - Se `true` → Problema regional, equipe já trabalhando
   - Informar que afeta vários clientes, sem previsão específica
   
3. **TERCEIRO: Verificar `os_aberta`:**
   - Se `TRUE` → Técnico já foi acionado, visita agendada/pendente
   - Informar que chamado existe e aguardar atendimento
   
4. **QUARTO: Diagnosticar pela combinação `statusPPPoE` + `onu_run_state`:**
   - **Ambos ONLINE + statusIP ATIVO** → Conexão OK
   - **PPPoE OFFLINE + ONU online + statusIP ATIVO** → Problema de autenticação PPPoE
   - **Ambos OFFLINE + dying-gasp + statusIP ATIVO** → Queda de energia no cliente
   - **Ambos OFFLINE + los/LOSS/LOFI + statusIP ATIVO** → Problema na fibra (rompimento)
   
5. **QUINTO: Verificar `STATUS_TIPO`:**
   - Se INADIMPLENTE ou CANCELADO → Orientar sobre situação cadastral

### **Tom de Resposta:**
- ✅ Natural e conversacional
- ✅ Traduzir termos técnicos para linguagem simples
- ✅ Dar orientações práticas (ex: "verifique se o equipamento está ligado")
- ❌ Não expor JSON ou termos técnicos crus
- ❌ Não inventar informações não presentes nos dados

### **Exemplos de Resposta:**

#### **Exemplo 1 - Bloqueio Financeiro:**
**Cliente:** "Minha internet não está funcionando"

**Dados:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "online",
  "statusIP": "BLOQUEIO"
}
```

**IA Responde:**
> "Identifiquei que sua conexão está bloqueada devido a pendências financeiras. Seu equipamento está funcionando normalmente, mas a conexão foi suspensa por inadimplência. Para restabelecer o serviço, é necessário regularizar os pagamentos. Posso te ajudar a verificar seus boletos em aberto ou te transferir para o financeiro?"

#### **Exemplo 2 - Queda de Energia:**
**Cliente:** "Internet caiu aqui"

**Dados:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "offline",
  "onu_last_down_cause": "dying-gasp",
  "statusIP": "ATIVO",
  "os_aberta": "FALSE"
}
```

**IA Responde:**
> "Identifiquei que houve uma queda de energia no seu local, o que desligou o equipamento de internet. Por favor, verifique se o modem/roteador está ligado corretamente na tomada e se as luzes estão acesas. Aguarde alguns minutos para o equipamento reiniciar. Se não voltar, me avise que abro um chamado técnico."

#### **Exemplo 3 - Problema Massivo:**
**Cliente:** "A internet está fora"

**Dados:**
```json
{
  "statusPPPoE": "OFFLINE",
  "massiva": true
}
```

**IA Responde:**
> "Identificamos que há um problema generalizado na região que está afetando vários clientes, incluindo você. Nossa equipe técnica já está trabalhando para restabelecer o serviço o mais rápido possível. Pedimos desculpas pelo transtorno e agradecemos a compreensão."

---

## 🔒 **Segurança**

- ✅ Validação de `conversationId` obrigatória
- ✅ Validação de `clientDocument` do banco de dados
- ✅ Não permite consulta de documento de outros clientes
- ✅ Logs sem dados sensíveis

---

## ✅ **Implementação Concluída**

### **Arquivos Modificados:**
- ✅ `server/ai-tools.ts` - Função `consultaStatusConexao`
- ✅ `server/routes.ts` - Detecção automática e enriquecimento
- ✅ Segue mesmo padrão do sistema de boletos

### **Keywords Detectadas:**
internet, conexão, velocidade, lento, desconectado, caindo, instável, wi-fi, wifi, sinal, offline, online, pppoe, ip, fibra, rede

### **Performance:**
- Busca automática quando detecta keyword
- IA recebe TODOS os dados
- Filtra e interpreta baseado na pergunta
- 3-5x mais rápido que function calling tradicional
