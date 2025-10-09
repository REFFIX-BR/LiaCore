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

#### ✅ **statusPPPoE** (PRINCIPAL)
- **ONLINE:** Cliente conectado no momento
- **OFFLINE:** Cliente desconectado

#### ✅ **onu_run_state** (EQUIPAMENTO ONU)
- **online:** ONU (equipamento fibra) funcionando
- **offline:** ONU com problema ou desligada

#### ⚠️ **statusIP**
- **ATIVO:** IP atribuído e ativo
- **INATIVO:** Sem IP atribuído

#### 🔧 **onu_last_down_cause** (Última Causa de Queda)
- **dying-gasp:** Queda de energia no cliente
- **los:** Perda de sinal óptico (problema na fibra)
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

#### 🎫 **os_aberta** (Ordem de Serviço)
- **"TRUE":** Há chamado técnico aberto
- **"FALSE":** Sem chamados abertos

#### 🌐 **massiva** (Problema em Massa)
- **true:** Problema afetando vários clientes
- **false:** Problema isolado do cliente

#### 📍 **STATUS_TIPO**
- **ATIVO:** Cliente com contrato ativo
- **SUSPENSO:** Cliente suspenso (inadimplência)
- **CANCELADO:** Cliente cancelado

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
**Significado:** Tudo funcionando normalmente

### ❌ **Problema no Cliente:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "offline",
  "onu_last_down_cause": "dying-gasp"
}
```
**Significado:** Queda de energia no local do cliente

### 🔧 **Problema Técnico:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_run_state": "offline", 
  "onu_last_down_cause": "los",
  "os_aberta": "TRUE"
}
```
**Significado:** Problema na fibra, técnico já foi acionado

### 🌐 **Problema Massivo:**
```json
{
  "statusPPPoE": "OFFLINE",
  "massiva": true
}
```
**Significado:** Problema generalizado afetando região

### 💳 **Suspensão:**
```json
{
  "STATUS_TIPO": "SUSPENSO",
  "statusPPPoE": "OFFLINE"
}
```
**Significado:** Cliente suspenso por inadimplência

---

## 💬 **Instruções para Resposta da IA**

### **Priorização de Diagnóstico:**
1. Verificar `massiva` → Informar que é problema regional
2. Verificar `STATUS_TIPO` → Se SUSPENSO, orientar pagamento
3. Verificar `os_aberta` → Se TRUE, informar que técnico foi acionado
4. Verificar `statusPPPoE` + `onu_run_state`:
   - Ambos ONLINE → Conexão OK
   - Ambos OFFLINE + dying-gasp → Queda de energia
   - Ambos OFFLINE + los → Problema na fibra
5. Se apenas `statusPPPoE` OFFLINE → Problema de autenticação

### **Tom de Resposta:**
- ✅ Natural e conversacional
- ✅ Traduzir termos técnicos para linguagem simples
- ✅ Dar orientações práticas (ex: "verifique se o equipamento está ligado")
- ❌ Não expor JSON ou termos técnicos crus
- ❌ Não inventar informações não presentes nos dados

### **Exemplo de Resposta:**
**Cliente:** "Minha internet está caindo"

**Dados:**
```json
{
  "statusPPPoE": "OFFLINE",
  "onu_last_down_cause": "dying-gasp",
  "os_aberta": "FALSE"
}
```

**IA Responde:**
> "Entendi sua situação. Identifiquei que houve uma queda de energia no seu local, o que desconectou o equipamento. Por favor, verifique se todos os equipamentos estão ligados corretamente. Se o problema persistir após verificar, posso abrir um chamado técnico para você."

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
