# Guia de Configuração: Verificação Obrigatória de CPF

## 📋 Resumo da Implementação

Este guia documenta a implementação da verificação obrigatória de CPF/CNPJ antes do encaminhamento para assistentes especializados.

## ✅ O que foi implementado

### 1. Base de Conhecimento (RAG)
✅ **Documento criado:** `kb-geral-005` - "Verificação Obrigatória de CPF para Encaminhamentos"
- Define a regra crítica de verificação antes de rotear
- Descreve o processo completo de verificação
- Instruções para lidar com recusa do cliente
- Formatos aceitos: CPF e CNPJ (formatados ou não)

**Localização:** `server/populate-knowledge-optimized.ts` (linhas 582-639)

### 2. Detecção Automática de CPF/CNPJ
✅ **Sistema já implementado** no webhook handler (`server/routes.ts`)
- Detecta CPF via regex: `\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b`
- Detecta CNPJ via regex: `\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b`
- Remove formatação e armazena em `conversations.clientDocument`
- Logging com máscara de segurança (***.***.***-**)

### 3. Instruções dos Assistentes Atualizadas

#### 📍 Assistente de Apresentação (Recepcionista)
✅ **Atualizado** para verificar CPF antes de rotear
- Nova ferramenta: `consultar_base_de_conhecimento`
- Fluxo: Revisar histórico → Solicitar CPF se ausente → Rotear

#### 📍 Assistente de Suporte Técnico
✅ **Atualizado** com verificação de CPF no início
- Primeiro passo: Verificar CPF no histórico
- Solicitar se ausente: "Para prosseguir, preciso do seu CPF ou CNPJ, por favor 😊"

#### 📍 Assistente Financeiro
✅ **Atualizado** com verificação de CPF no início
- Primeiro passo: Verificar CPF no histórico antes de consultas

#### 📍 Assistente de Ouvidoria
✅ **Atualizado** com verificação de CPF no início
- Primeiro passo: Verificar CPF antes de coletar relato

#### 📍 Assistente Comercial
✅ **Atualizado** com verificação de CPF para upgrades
- Verificação obrigatória para solicitações de upgrade de velocidade
- Nova contratação já coleta CPF no fluxo padrão

#### 📍 Assistente de Cancelamento
✅ **Atualizado** com verificação de CPF no início
- Primeiro passo: Verificar CPF antes de discutir cancelamento

## 🚀 Como Aplicar as Novas Instruções

### Passo 1: Popular a Base de Conhecimento
```bash
npx tsx server/populate-knowledge-optimized.ts
```
✅ **Status:** Executado com sucesso (19 chunks adicionados)

### Passo 2: Atualizar Assistentes na OpenAI Platform

Acesse: https://platform.openai.com/assistants

Para cada assistente, copie as instruções OTIMIZADAS do arquivo:
📄 `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`

**Assistentes a atualizar:**
1. ✅ Assistente de Apresentação/Recepção (APRESENTACAO_ASSISTANT_ID)
2. ✅ Assistente de Suporte Técnico (SUPORTE_ASSISTANT_ID)
3. ✅ Assistente Comercial (COMERCIAL_ASSISTANT_ID)
4. ✅ Assistente Financeiro (FINANCEIRO_ASSISTANT_ID)
5. ✅ Assistente de Cancelamento (CANCELAMENTO_ASSISTANT_ID)
6. ✅ Assistente de Ouvidoria (OUVIDORIA_ASSISTANT_ID)

**IMPORTANTE:** 
- Para o Assistente de Apresentação, adicione também a ferramenta `consultar_base_de_conhecimento`
- Demais assistentes já possuem essa ferramenta habilitada

## 📊 Fluxo Completo de Verificação

```
1. Cliente envia mensagem via WhatsApp
   ↓
2. Sistema detecta CPF/CNPJ automaticamente (se presente)
   ↓
3. Armazena em conversations.clientDocument (limpo, sem formatação)
   ↓
4. Assistente de Apresentação identifica necessidade
   ↓
5. ANTES de rotear → Verifica histórico
   ├─ CPF presente? → Roteia diretamente
   └─ CPF ausente? → Solicita: "Para prosseguir, preciso do seu CPF ou CNPJ, por favor 😊"
       ↓
6. Cliente fornece CPF
   ↓
7. Sistema detecta e armazena automaticamente
   ↓
8. Assistente roteia para especialista
   ↓
9. Especialista verifica CPF no início (se ainda não verificado)
   ↓
10. Prossegue com atendimento específico
```

## 🔒 Segurança e Compliance

- ✅ CPF/CNPJ armazenado de forma limpa (sem formatação)
- ✅ Logging com máscara de segurança
- ✅ Validação obrigatória antes de operações sensíveis
- ✅ Instruções claras para lidar com recusa do cliente

## 🧪 Testes Realizados

### Detecção de CPF/CNPJ ✅
```
Teste 1: "Olá, meu CPF é 123.456.789-00"
✅ Detectado: ***.***.***-** (limpo: 12345678900)

Teste 2: "Meu documento é 12345678900"
✅ Detectado: ***.***.***-** (limpo: 12345678900)

Teste 3: "CNPJ: 12.345.678/0001-99"
✅ Detectado: **.***.***/****-** (limpo: 12345678000199)

Teste 4: "Quero consultar minha fatura para o documento 12345678000199"
✅ Detectado: **.***.***/****-** (limpo: 12345678000199)
```

## 📝 Checklist de Implementação

- [x] Criar documento na base de conhecimento (kb-geral-005)
- [x] Atualizar instruções do Assistente de Apresentação
- [x] Atualizar instruções dos 5 assistentes especializados
- [x] Popular base de conhecimento (19 chunks)
- [x] Validar detecção de CPF/CNPJ via regex
- [ ] Atualizar assistentes na OpenAI Platform (ação manual do usuário)
- [ ] Testar fluxo completo em produção

## 🎯 Próximos Passos (Ação do Usuário)

1. Acesse https://platform.openai.com/assistants
2. Para cada assistente:
   - Copie as instruções do arquivo `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md`
   - Cole na plataforma OpenAI
   - Salve as alterações
3. Para o Assistente de Apresentação especificamente:
   - Adicione a ferramenta `consultar_base_de_conhecimento` na lista de ferramentas habilitadas
4. Teste o fluxo completo enviando mensagens via WhatsApp

## 📚 Arquivos Modificados

- ✅ `server/populate-knowledge-optimized.ts` - Novo chunk kb-geral-005
- ✅ `INSTRUCOES_ASSISTENTES_OPENAI_OTIMIZADO.md` - Todas as instruções atualizadas
- ✅ `GUIA_VERIFICACAO_CPF.md` - Este guia (NOVO)

## 🔍 Como Verificar se Está Funcionando

1. Envie mensagem sem CPF: "Preciso de ajuda técnica"
2. Assistente deve solicitar: "Para prosseguir, preciso do seu CPF ou CNPJ, por favor 😊"
3. Forneça CPF: "123.456.789-00"
4. Sistema detecta e armazena automaticamente
5. Assistente prossegue com o atendimento

**Resultado Esperado:** CPF deve ser solicitado ANTES de qualquer encaminhamento para assistentes especializados.
