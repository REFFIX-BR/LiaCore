# 📊 DATABASE SCHEMA - LIA CORTEX

**Versão:** 3.0  
**Última Atualização:** Novembro 2025  
**Banco de Dados:** PostgreSQL (Neon)  
**ORM:** Drizzle ORM

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Módulo de Autenticação](#módulo-de-autenticação)
3. [Módulo de Conversas](#módulo-de-conversas)
4. [Módulo de Mensagens](#módulo-de-mensagens)
5. [Módulo de Supervisão](#módulo-de-supervisão)
6. [Módulo de Aprendizado Contínuo](#módulo-de-aprendizado-contínuo)
7. [Módulo de Satisfação (NPS)](#módulo-de-satisfação-nps)
8. [Módulo de Gamificação](#módulo-de-gamificação)
9. [Módulo de Ouvidoria](#módulo-de-ouvidoria)
10. [Módulo de Vendas](#módulo-de-vendas)
11. [Módulo de Prompts](#módulo-de-prompts)
12. [Módulo de Falhas Massivas](#módulo-de-falhas-massivas)
13. [Módulo de Cobrança](#módulo-de-cobrança)
14. [Módulo de Contatos](#módulo-de-contatos)
15. [Módulo de RAG Analytics](#módulo-de-rag-analytics)
16. [Índices e Performance](#índices-e-performance)
17. [Diagrama de Relacionamentos](#diagrama-de-relacionamentos)

---

## Visão Geral

O banco de dados da LIA CORTEX é estruturado em 30+ tabelas organizadas por módulos funcionais. Principais características:

- ✅ **IDs:** UUID via `gen_random_uuid()` para escalabilidade e distribuição
- ✅ **Timestamps:** Timezone-aware com `timestamp` (defaultNow)
- ✅ **JSONB:** Para dados semi-estruturados e metadados flexíveis
- ✅ **Arrays:** Para listas de valores (PostgreSQL native)
- ✅ **Índices Estratégicos:** Queries otimizadas para dashboards e monitores
- ✅ **Soft Deletes:** Preservação de histórico com `deletedAt`

---

## Módulo de Autenticação

### `users` - Usuários do Sistema

Gerencia usuários internos (agentes, supervisores, admins).

| Campo | Tipo | Descrição | Constraints |
|-------|------|-----------|-------------|
| `id` | varchar (UUID) | Identificador único | PRIMARY KEY, DEFAULT gen_random_uuid() |
| `username` | text | Nome de usuário | NOT NULL, UNIQUE |
| `password` | text | Senha hasheada (bcrypt) | NOT NULL |
| `fullName` | text | Nome completo | NOT NULL |
| `email` | text | Email | UNIQUE |
| `role` | text | Papel no sistema | NOT NULL, DEFAULT 'AGENT' |
| `status` | text | Status do usuário | NOT NULL, DEFAULT 'ACTIVE' |
| `departments` | text[] | Departamentos atribuídos | DEFAULT [general] |
| `participatesInGamification` | boolean | Participa do ranking | DEFAULT true |
| `lastLoginAt` | timestamp | Último login | |
| `lastActivityAt` | timestamp | Última atividade | |
| `createdAt` | timestamp | Data de criação | DEFAULT NOW() |

**Roles:**
- `ADMIN` - Acesso total
- `SUPERVISOR` - Monitora e gerencia agentes
- `AGENT` - Atendente

**Departments:**
- `commercial`, `support`, `financial`, `cancellation`, `general`

---

### `registration_requests` - Solicitações de Cadastro

Gerencia requisições de novos usuários (aprovação manual).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID da solicitação |
| `username` | text | Usuário solicitado |
| `password` | text | Senha hasheada |
| `fullName` | text | Nome completo |
| `email` | text | Email |
| `requestedRole` | text | Role solicitada (DEFAULT 'AGENT') |
| `status` | text | pending, approved, rejected |
| `reviewedBy` | varchar | User ID do revisor |
| `reviewedAt` | timestamp | Quando foi revisado |
| `rejectionReason` | text | Motivo da rejeição |
| `createdAt` | timestamp | Data da solicitação |

---

### `activity_logs` - Logs de Atividade

Auditoria de ações dos usuários.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID do log |
| `userId` | varchar | User ID |
| `action` | text | login, logout, transfer_conversation, etc. |
| `ipAddress` | text | IP de origem |
| `userAgent` | text | User Agent do navegador |
| `sessionDuration` | integer | Duração da sessão (segundos) |
| `conversationId` | varchar | ID da conversa relacionada |
| `targetUserId` | varchar | ID do usuário alvo (transferências) |
| `details` | jsonb | Detalhes adicionais |
| `createdAt` | timestamp | Timestamp do log |

---

## Módulo de Conversas

### `conversations` - Conversas com Clientes

Tabela central do sistema - rastreia todas as conversas WhatsApp.

| Campo | Tipo | Descrição | Constraints |
|-------|------|-----------|-------------|
| `id` | varchar (UUID) | Identificador único | PRIMARY KEY |
| `chatId` | text | ID do chat WhatsApp | NOT NULL, UNIQUE |
| `clientName` | text | Nome do cliente | NOT NULL |
| `clientId` | text | ID do cliente (Evolution API) | |
| `clientDocument` | text | CPF/CNPJ/Código | |
| `clientDocumentType` | text | CPF, CNPJ, CLIENT_CODE | |
| `threadId` | text | OpenAI Thread ID | |
| `assistantType` | text | Tipo do assistente atual | NOT NULL |
| `department` | text | Departamento responsável | DEFAULT 'general' |
| `status` | text | active, transferred, resolved | DEFAULT 'active' |
| `sentiment` | text | Sentimento detectado | DEFAULT 'neutral' |
| `urgency` | text | normal, high, urgent | DEFAULT 'normal' |
| `duration` | integer | Duração em segundos | DEFAULT 0 |
| `lastMessage` | text | Última mensagem | |
| `lastMessageTime` | timestamp | Timestamp da última msg | DEFAULT NOW() |
| `createdAt` | timestamp | Criação da conversa | DEFAULT NOW() |
| `metadata` | jsonb | Metadados flexíveis | |
| `conversationSummary` | text | Resumo (thread rotation) | |
| `lastSummarizedAt` | timestamp | Última sumarização | |
| `messageCountAtLastSummary` | integer | Contador de mensagens | DEFAULT 0 |
| `transferredToHuman` | boolean | Transferida para humano | DEFAULT false |
| `transferReason` | text | Motivo da transferência | |
| `transferredAt` | timestamp | Quando foi transferida | |
| `assignedTo` | varchar | User ID do agente | |
| `resolvedBy` | varchar | User ID de quem resolveu | |
| `resolvedAt` | timestamp | Quando foi resolvida | |
| `resolutionTime` | integer | Tempo de resolução (segundos) | |
| `evolutionInstance` | text | Instância Evolution API | |
| `autoClosed` | boolean | Auto-encerrada | DEFAULT false |
| `autoClosedReason` | text | Motivo do auto-close | |
| `autoClosedAt` | timestamp | Quando foi fechada | |
| `verifiedAt` | timestamp | Verificada pelo supervisor | |
| `verifiedBy` | varchar | Supervisor que verificou | |
| `lastCoverageCheck` | jsonb | Última verificação de CEP | |
| `conversationSource` | text | inbound, voice_campaign, whatsapp_campaign | DEFAULT 'inbound' |
| `voiceCampaignTargetId` | varchar | ID do target de cobrança | |

**Índices:**
- `conversations_last_message_time_idx` → lastMessageTime
- `conversations_status_idx` → status
- `conversations_status_last_message_idx` → (status, lastMessageTime)
- `conversations_assigned_to_idx` → assignedTo
- `conversations_transferred_idx` → transferredToHuman
- `conversations_department_idx` → department

---

### `conversation_threads` - Thread Rotation

Rastreia rotações de threads OpenAI (otimização de contexto).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID do thread |
| `conversationId` | varchar | ID da conversa |
| `threadId` | text | OpenAI Thread ID |
| `messageCount` | integer | Número de mensagens no thread |
| `summary` | text | Resumo do histórico preservado |
| `preservedMessageIds` | text[] | IDs de mensagens críticas |
| `createdAt` | timestamp | Criação do thread |
| `closedAt` | timestamp | Quando foi fechado (rotacionado) |
| `closedReason` | text | rotation, conversation_ended |

**Índices:**
- `conversation_threads_conversation_id_idx` → conversationId
- `conversation_threads_thread_id_idx` → threadId
- `conversation_threads_active_idx` → (conversationId, closedAt)

**Uso:** Quando uma conversa atinge 55+ mensagens, o sistema rotaciona para um novo thread OpenAI, reduzindo latência ~40%.

---

## Módulo de Mensagens

### `messages` - Mensagens das Conversas

Armazena todas as mensagens trocadas nas conversas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID da mensagem |
| `conversationId` | varchar | ID da conversa |
| `role` | text | user, assistant, system |
| `content` | text | Conteúdo da mensagem |
| `timestamp` | timestamp | Timestamp da mensagem |
| `functionCall` | jsonb | Chamada de função (AI) |
| `assistant` | text | Tipo do assistente |
| `imageBase64` | text | Imagem em base64 |
| `pdfBase64` | text | PDF em base64 |
| `pdfName` | text | Nome do PDF |
| `audioUrl` | text | URL do áudio (WhatsApp) |
| `audioBase64` | text | Áudio em base64 |
| `videoUrl` | text | URL do vídeo |
| `videoName` | text | Nome do vídeo |
| `videoMimetype` | text | MIME type do vídeo |
| `whatsappMessageId` | text | ID da mensagem no WhatsApp |
| `remoteJid` | text | JID do chat WhatsApp |
| `whatsappStatus` | text | PENDING, SERVER_ACK, DELIVERY_ACK, READ, ERROR |
| `whatsappStatusUpdatedAt` | timestamp | Última atualização de status |
| `whatsappRetryCount` | integer | Número de retries |
| `whatsappLastRetryAt` | timestamp | Última tentativa de retry |
| `whatsappTemplateMetadata` | jsonb | Metadata do template (retry) |
| `isPrivate` | boolean | Nota interna (não enviada) |
| `sendBy` | text | supervisor, agent, ai, client |
| `deletedAt` | timestamp | Soft delete |
| `deletedBy` | text | Quem deletou |

**Índices:**
- `messages_conversation_id_idx` → conversationId
- `messages_conversation_timestamp_idx` → (conversationId, timestamp)
- `messages_whatsapp_status_idx` → (whatsappStatus, whatsappStatusUpdatedAt)
- `messages_whatsapp_message_id_idx` → whatsappMessageId

---

## Módulo de Supervisão

### `alerts` - Alertas do Sistema

Alertas gerados automaticamente (urgência, sentimento, timeout).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID do alerta |
| `conversationId` | varchar | Conversa relacionada |
| `type` | text | Tipo do alerta |
| `severity` | text | low, medium, high, critical |
| `message` | text | Mensagem do alerta |
| `resolved` | boolean | Se foi resolvido |
| `createdAt` | timestamp | Criação |

---

### `supervisor_actions` - Ações de Supervisores

Registro de ações dos supervisores nas conversas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID da ação |
| `conversationId` | varchar | Conversa |
| `action` | text | Tipo da ação |
| `notes` | text | Observações |
| `createdBy` | text | Supervisor |
| `createdAt` | timestamp | Timestamp |

---

### `suggested_responses` - Respostas Sugeridas (Hybrid Mode)

AI sugere respostas para supervisores em modo híbrido.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa |
| `messageContext` | text | Mensagem do cliente |
| `suggestedResponse` | text | Resposta sugerida pela AI |
| `finalResponse` | text | O que foi enviado (se editado) |
| `wasEdited` | boolean | Se foi editada |
| `wasApproved` | boolean | Se foi aprovada |
| `supervisorName` | text | Supervisor |
| `createdAt` | timestamp | Criação |
| `approvedAt` | timestamp | Aprovação |

---

## Módulo de Aprendizado Contínuo

### `learning_events` - Eventos de Aprendizado

Captura interações para treinamento da IA.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa |
| `eventType` | text | explicit_correction, implicit_success, implicit_failure |
| `assistantType` | text | Tipo do assistente |
| `userMessage` | text | Mensagem do usuário |
| `aiResponse` | text | Resposta da IA |
| `correctResponse` | text | Correção do supervisor |
| `feedback` | text | Notas |
| `sentiment` | text | Sentimento |
| `resolution` | text | success, abandoned, corrected |
| `createdAt` | timestamp | Criação |
| `metadata` | jsonb | Metadados |

---

### `prompt_suggestions` - Sugestões de Melhoria de Prompts

Sistema GPT-4 sugere melhorias automáticas nos prompts.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `assistantType` | text | Tipo do assistente |
| `problemIdentified` | text | Problema identificado |
| `rootCauseAnalysis` | text | Análise de causa raiz |
| `currentPrompt` | text | Prompt atual |
| `suggestedPrompt` | text | Prompt sugerido |
| `confidenceScore` | integer | Confiança (0-100) |
| `affectedConversations` | text[] | IDs de conversas afetadas |
| `status` | text | pending, approved, rejected, applied, consolidated |
| `reviewedBy` | text | Revisor |
| `reviewNotes` | text | Notas da revisão |
| `appliedInVersion` | varchar | Versão aplicada |
| `consolidatedWith` | text[] | Outras sugestões consolidadas |
| `createdAt` | timestamp | Criação |
| `reviewedAt` | timestamp | Revisão |

---

### `prompt_updates` - Histórico de Atualizações de Prompts

Registro de todas as mudanças nos prompts.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `suggestionId` | varchar | ID da sugestão origem |
| `assistantType` | text | Tipo do assistente |
| `modificationType` | text | instructions, function_added, function_removed |
| `previousValue` | text | Valor anterior |
| `newValue` | text | Novo valor |
| `reason` | text | Motivo da mudança |
| `appliedBy` | text | Quem aplicou |
| `createdAt` | timestamp | Aplicação |

---

### `training_sessions` - Sessões de Treinamento

Treinamento manual de assistentes pelos supervisores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `title` | text | Título da sessão |
| `assistantType` | text | Assistente treinado |
| `trainingType` | text | manual, conversation |
| `conversationId` | varchar | Conversa (se aplicável) |
| `content` | text | Conteúdo do treinamento |
| `status` | text | active, completed, applied |
| `startedBy` | varchar | Quem iniciou |
| `completedBy` | varchar | Quem finalizou |
| `appliedBy` | varchar | Quem aplicou |
| `startedAt` | timestamp | Início |
| `completedAt` | timestamp | Conclusão |
| `appliedAt` | timestamp | Aplicação |
| `notes` | text | Observações |
| `improvedPrompt` | text | Prompt melhorado |
| `metadata` | jsonb | Metadados |

**Índices:**
- `training_sessions_status_idx` → status
- `training_sessions_assistant_type_idx` → assistantType

---

## Módulo de Satisfação (NPS)

### `satisfaction_feedback` - Feedbacks NPS

Pesquisas de satisfação enviadas após resolução.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa avaliada |
| `assistantType` | text | Assistente avaliado |
| `npsScore` | integer | Nota 0-10 |
| `category` | text | detractor (0-6), neutral (7-8), promoter (9-10) |
| `comment` | text | Comentário do cliente |
| `clientName` | text | Nome do cliente |
| `createdAt` | timestamp | Data do feedback |
| `handlingScore` | integer | Nota da tratativa (1-5) |
| `handlingStatus` | text | pending, in_progress, resolved |
| `handlingNotes` | text | Notas da tratativa |
| `handledBy` | varchar | Quem tratou |
| `handledAt` | timestamp | Quando foi tratado |

**Categorias NPS:**
- **Detratores:** 0-6 (insatisfeitos)
- **Neutros:** 7-8 (indiferentes)
- **Promotores:** 9-10 (satisfeitos)

**Cálculo NPS:** (% Promotores) - (% Detratores)

---

## Módulo de Gamificação

### `gamification_scores` - Pontuações Mensais

Scores calculados mensalmente para ranking.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `agentId` | varchar | User ID do agente |
| `period` | text | YYYY-MM (ex: 2025-01) |
| `totalConversations` | integer | Conversas resolvidas |
| `avgNps` | integer | NPS médio (0-10) |
| `successRate` | integer | Taxa de sucesso (0-100) |
| `avgResponseTime` | integer | Tempo médio (segundos) |
| `volumeScore` | integer | Score de volume (0-100) |
| `npsScore` | integer | Score de NPS (0-100) |
| `resolutionScore` | integer | Score de resolução (0-100) |
| `timeScore` | integer | Score de tempo (0-100) |
| `totalScore` | integer | Score total ponderado |
| `ranking` | integer | Posição no ranking (1-N) |
| `calculatedAt` | timestamp | Cálculo |
| `createdAt` | timestamp | Criação |

**Fórmula:**
```
totalScore = (npsScore × 40%) + (volumeScore × 30%) + (resolutionScore × 20%) + (timeScore × 10%)
```

**Índices:**
- `gamification_scores_agent_period_idx` → (agentId, period)
- `gamification_scores_period_idx` → period
- `gamification_scores_total_score_idx` → totalScore

---

### `gamification_badges` - Badges Conquistados

Medalhas/conquistas dos agentes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `agentId` | varchar | Agente |
| `badgeType` | text | solucionador, velocista, campeao_volume |
| `period` | text | YYYY-MM |
| `metric` | integer | Valor da métrica |
| `awardedAt` | timestamp | Concessão |

**Badges:**
- **Solucionador:** NPS ≥ 7 + Taxa de resolução ≥ 70%
- **Velocista:** Top 1 em tempo de resposta (com NPS ≥ 7)
- **Campeão de Volume:** Top 1 em volume de atendimentos

**Índices:**
- `gamification_badges_agent_id_idx` → agentId
- `gamification_badges_period_idx` → period
- `gamification_badges_badge_type_idx` → badgeType

---

### `gamification_history` - Histórico de Vencedores

Top 5 de cada mês (histórico permanente).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `period` | text | YYYY-MM |
| `agentId` | varchar | Vencedor |
| `ranking` | integer | Posição (1-5) |
| `totalScore` | integer | Pontuação final |
| `metrics` | jsonb | Snapshot das métricas |
| `badges` | text[] | Badges conquistados |
| `createdAt` | timestamp | Registro |

---

### `gamification_settings` - Configurações Globais

Singleton (apenas 1 registro - id=1).

| Campo | Tipo | Descrição | Default |
|-------|------|-----------|---------|
| `id` | serial | ID (sempre 1) | PRIMARY KEY |
| `npsWeight` | integer | Peso NPS (%) | 40 |
| `volumeWeight` | integer | Peso volume (%) | 30 |
| `resolutionWeight` | integer | Peso resolução (%) | 20 |
| `responseTimeWeight` | integer | Peso tempo (%) | 10 |
| `solucionadorNpsMin` | integer | NPS mínimo Solucionador | 7 |
| `solucionadorResolutionMin` | integer | Resolução mín. Solucionador | 70 |
| `velocistaNpsMin` | integer | NPS mínimo Velocista | 7 |
| `velocistaTopN` | integer | Top N Velocista | 1 |
| `campeaoVolumeTopN` | integer | Top N Campeão | 1 |
| `targetNps` | integer | Meta NPS equipe | 8 |
| `targetResolution` | integer | Meta resolução (%) | 85 |
| `targetResponseTime` | integer | Meta tempo (seg) | 120 |
| `targetVolume` | integer | Meta volume | 500 |
| `calculationPeriod` | text | weekly, monthly, quarterly | monthly |
| `autoCalculate` | boolean | Cálculo automático | false |
| `calculationFrequency` | text | Frequência | monthly |
| `calculationDayOfMonth` | integer | Dia do mês (1-31) | 1 |
| `calculationDayOfWeek` | integer | Dia da semana (1-7) | 1 |
| `calculationTime` | text | Horário (HH:MM) | 00:00 |
| `updatedBy` | varchar | Quem atualizou | |
| `updatedAt` | timestamp | Atualização | |
| `createdAt` | timestamp | Criação | |

---

## Módulo de Ouvidoria

### `complaints` - Reclamações

Gerenciamento de reclamações formais.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa da Ouvidoria |
| `complaintType` | text | atendimento, produto, tecnico, comercial, financeiro, outro |
| `severity` | text | baixa, media, alta, critica |
| `description` | text | Descrição completa |
| `status` | text | novo, em_investigacao, resolvido, fechado |
| `assignedTo` | varchar | Responsável |
| `resolution` | text | Resolução final |
| `resolutionNotes` | text | Notas adicionais |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |
| `resolvedAt` | timestamp | Resolução |
| `metadata` | jsonb | Metadados |

---

## Módulo de Vendas

### `sales_plans` - Planos de Venda

Catálogo de planos comerciais.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `name` | text | Nome do plano |
| `description` | text | Descrição |
| `category` | text | internet, telefonia, combo |
| `speed` | text | Velocidade (ex: 200MB) |
| `price` | integer | Preço em centavos |
| `isActive` | boolean | Ativo/Inativo |
| `features` | text[] | Lista de recursos |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

---

### `sales_leads` - Leads de Vendas

Leads capturados pelo assistente comercial.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa origem |
| `name` | text | Nome do lead |
| `phone` | text | Telefone |
| `address` | text | Endereço completo |
| `cep` | text | CEP |
| `cpf` | text | CPF |
| `planId` | varchar | Plano de interesse |
| `status` | text | novo, contatado, qualificado, convertido, perdido |
| `notes` | text | Observações |
| `assignedTo` | varchar | Vendedor |
| `convertedAt` | timestamp | Conversão |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

---

## Módulo de Prompts

### `prompt_templates` - Templates de Prompts

Armazena prompts dos assistentes com versionamento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `assistantType` | text | apresentacao, comercial, suporte, etc. |
| `version` | text | Semantic versioning (1.0.0) |
| `status` | text | active, archived |
| `content` | text | Conteúdo do prompt |
| `instructions` | text | Instruções do assistente |
| `tools` | jsonb | Ferramentas disponíveis |
| `model` | text | Modelo OpenAI (gpt-4o-mini) |
| `temperature` | integer | Temperatura (0-100) |
| `topP` | integer | Top P (0-100) |
| `tokenCount` | integer | Contagem de tokens |
| `lastAnalysisAt` | timestamp | Última análise GPT-4o |
| `analysisResults` | jsonb | Resultados da análise |
| `createdBy` | varchar | Criador |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

**Índices:**
- `prompt_templates_assistant_type_idx` → assistantType
- `prompt_templates_status_idx` → status

---

### `prompt_versions` - Histórico de Versões

Todas as versões publicadas de cada prompt.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `promptId` | varchar | ID do template |
| `version` | text | Versão (1.2.0) |
| `content` | text | Conteúdo desta versão |
| `instructions` | text | Instruções |
| `tools` | jsonb | Ferramentas |
| `changeLog` | text | O que mudou |
| `publishedBy` | varchar | Quem publicou |
| `createdAt` | timestamp | Publicação |

**Índices:**
- `prompt_versions_prompt_id_idx` → promptId

---

### `prompt_drafts` - Rascunhos de Prompts

Work-in-progress (não publicado).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `promptId` | varchar | ID do template (UNIQUE) |
| `draftContent` | text | Rascunho |
| `aiSuggestions` | jsonb | Sugestões da IA |
| `tokenCount` | integer | Tokens |
| `preConsolidationContent` | text | Antes da consolidação |
| `lastEditedBy` | varchar | Último editor |
| `lastEditedAt` | timestamp | Última edição |
| `createdAt` | timestamp | Criação |

**Índices:**
- `prompt_drafts_prompt_id_idx` → promptId

---

### `context_quality_alerts` - Alertas de Qualidade de Contexto

Monitora problemas de contexto nas conversas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa |
| `alertType` | text | duplicate_data_request, ignored_history, duplicate_routing, context_reset, client_repetition, misrouting_frustration |
| `severity` | text | low, medium, high |
| `description` | text | Descrição do problema |
| `assistantType` | text | Assistente |
| `metadata` | jsonb | Dados adicionais |
| `detectedAt` | timestamp | Detecção |
| `resolvedAt` | timestamp | Resolução |

**Índices:**
- `context_quality_alerts_conversation_id_idx` → conversationId
- `context_quality_alerts_detected_at_idx` → detectedAt
- `context_quality_alerts_assistant_type_idx` → assistantType
- `context_quality_alerts_alert_type_idx` → alertType

---

## Módulo de Falhas Massivas

### `massive_failures` - Falhas em Grande Escala

Gerencia interrupções de serviço em regiões/cidade.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `name` | text | Nome da falha |
| `description` | text | Descrição |
| `severity` | text | low, medium, high, critical |
| `status` | text | active, resolved, monitoring |
| `affectedRegions` | jsonb | Regiões/cidades afetadas |
| `estimatedResolution` | timestamp | Previsão de resolução |
| `createdAt` | timestamp | Detecção |
| `createdBy` | varchar | Criador |
| `resolvedAt` | timestamp | Resolução |
| `resolvedBy` | varchar | Resolvedor |
| `resolutionMessage` | text | Mensagem de resolução |

**Índices:**
- `massive_failures_status_idx` → status
- `massive_failures_created_at_idx` → createdAt

**Regiões Afetadas (JSON):**
```json
{
  "type": "predefined" | "custom",
  "regionIds": ["teresopolis", "petropolis"],
  "custom": [
    {
      "city": "Teresópolis",
      "neighborhoods": ["Centro", "Alto"]
    }
  ]
}
```

---

### `failure_notifications` - Notificações de Falhas

Rastreia envio de notificações aos clientes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `failureId` | varchar | ID da falha |
| `clientPhone` | text | Telefone do cliente |
| `clientName` | text | Nome |
| `notificationType` | text | failure, resolution, update |
| `message` | text | Mensagem enviada |
| `sentAt` | timestamp | Envio |
| `wasRead` | boolean | Foi lido |
| `respondedAt` | timestamp | Resposta |
| `clientResponse` | text | Resposta do cliente |

**Índices:**
- `failure_notifications_failure_id_idx` → failureId
- `failure_notifications_client_phone_idx` → clientPhone
- `failure_notifications_sent_at_idx` → sentAt

---

## Módulo de Cobrança

### `voice_campaigns` - Campanhas de Cobrança

Campanhas de cobrança ativa via WhatsApp.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `name` | text | Nome da campanha |
| `description` | text | Descrição |
| `status` | text | draft, scheduled, active, paused, completed, cancelled |
| `strategy` | text | sequential, priority, random |
| `maxAttempts` | integer | Máx tentativas/cliente |
| `attemptSpacingMinutes` | integer | Intervalo entre tentativas |
| `activeHours` | jsonb | Horários permitidos (ANATEL) |
| `startDate` | timestamp | Início |
| `endDate` | timestamp | Fim |
| `totalTargets` | integer | Total de alvos |
| `contactedTargets` | integer | Contatados |
| `successfulContacts` | integer | Sucessos |
| `promisesMade` | integer | Promessas feitas |
| `promisesFulfilled` | integer | Promessas cumpridas |
| `allowedMethods` | text[] | voice, whatsapp |
| `fallbackOrder` | text[] | Ordem de fallback |
| `createdBy` | varchar | Criador |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |
| `startedAt` | timestamp | Início execução |
| `completedAt` | timestamp | Conclusão |

**Índices:**
- `voice_campaigns_status_idx` → status
- `voice_campaigns_created_by_idx` → createdBy

---

### `crm_sync_configs` - Sincronização com CRM

Configuração de importação automática de inadimplentes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `campaignId` | varchar | Campanha (UNIQUE) |
| `enabled` | boolean | Ativo/Inativo |
| `apiUrl` | text | URL da API CRM |
| `apiKey` | text | API Key |
| `dateRangeType` | text | relative, fixed |
| `dateRangeDays` | integer | Últimos N dias |
| `dateRangeFrom` | timestamp | Data inicial (fixed) |
| `dateRangeTo` | timestamp | Data final (fixed) |
| `minDebtAmount` | integer | Dívida mínima (centavos) |
| `maxDebtAmount` | integer | Dívida máxima (centavos) |
| `syncSchedule` | text | hourly, daily, weekly, manual |
| `syncTime` | text | Horário (HH:MM) |
| `syncTimeZone` | text | Timezone |
| `deduplicateBy` | text | document, phone, both |
| `updateExisting` | boolean | Atualizar existentes |
| `lastSyncAt` | timestamp | Última sync |
| `lastSyncStatus` | text | success, partial, failed |
| `lastSyncError` | text | Erro |
| `lastSyncImported` | integer | Importados |
| `lastSyncSkipped` | integer | Pulados |
| `createdBy` | varchar | Criador |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

**Índices:**
- `crm_sync_campaign_id_idx` → campaignId
- `crm_sync_enabled_idx` → enabled

---

### `voice_campaign_targets` - Alvos de Cobrança

Clientes devedores de cada campanha.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `campaignId` | varchar | Campanha |
| `contactId` | varchar | Contato (FK) |
| `phoneNumber` | text | Telefone principal |
| `alternativePhones` | text[] | Telefones alternativos |
| `contactMethod` | text | whatsapp, voice |
| `debtorName` | text | Nome do devedor |
| `debtorDocument` | text | CPF/CNPJ |
| `debtorDocumentType` | text | CPF, CNPJ, CLIENT_CODE |
| `debtAmount` | integer | Valor dívida (centavos) |
| `dueDate` | timestamp | Vencimento |
| `debtorMetadata` | jsonb | Outros dados CRM |
| `state` | text | pending, scheduled, calling, completed, failed, skipped, paid |
| `priority` | integer | Prioridade |
| `attemptCount` | integer | Tentativas |
| `lastAttemptAt` | timestamp | Última tentativa |
| `nextAttemptAt` | timestamp | Próxima tentativa |
| `paymentStatus` | text | pending, paid, overdue, unknown |
| `paymentCheckedAt` | timestamp | Verificação pagamento |
| `crmSyncState` | text | synced, pending, failed |
| `crmLastSyncAt` | timestamp | Última sync CRM |
| `preferredTimeWindow` | jsonb | Janela preferencial |
| `outcome` | text | promise_made, paid, refused, no_answer, etc. |
| `outcomeDetails` | text | Detalhes |
| `completedAt` | timestamp | Conclusão |
| `conversationId` | varchar | Conversa WhatsApp |
| `lastWhatsappStatus` | text | Status mensagem |
| `lastWhatsappStatusAt` | timestamp | Atualização status |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

**Índices:**
- `voice_targets_campaign_id_idx` → campaignId
- `voice_targets_state_idx` → state
- `voice_targets_next_attempt_idx` → nextAttemptAt
- `voice_targets_contact_id_idx` → contactId
- `voice_targets_payment_status_idx` → paymentStatus

---

### `voice_call_attempts` - Tentativas de Ligação (Legacy)

**Nota:** Não usado no fluxo WhatsApp-only atual.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `targetId` | varchar | Alvo |
| `campaignId` | varchar | Campanha |
| `attemptNumber` | integer | Número da tentativa |
| `phoneNumber` | text | Telefone |
| `scheduledFor` | timestamp | Agendamento |
| `dialedAt` | timestamp | Discagem |
| `callSid` | text | SID Twilio |
| `status` | text | Status |
| `amdResult` | text | Resultado AMD |
| `durationSeconds` | integer | Duração |
| `recordingUrl` | text | URL gravação |
| `transcriptUrl` | text | URL transcrição |
| `transcript` | text | Transcrição |
| `aiSummary` | text | Resumo AI |
| `sentiment` | text | Sentimento |
| `detectedIntent` | text | Intenção |
| `errorCode` | text | Código erro |
| `errorMessage` | text | Mensagem erro |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

---

### `voice_promises` - Promessas de Pagamento

Promessas registradas durante cobrança.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `campaignId` | varchar | Campanha |
| `targetId` | varchar | Alvo |
| `contactId` | varchar | Contato |
| `callAttemptId` | varchar | Tentativa (legacy) |
| `contactName` | text | Nome |
| `contactDocument` | text | Documento |
| `phoneNumber` | text | Telefone |
| `promisedAmount` | integer | Valor prometido (centavos) |
| `dueDate` | timestamp | Data prometida |
| `paymentMethod` | text | boleto, pix, cartao, outro |
| `status` | text | pending, fulfilled, broken, renegotiated |
| `fulfilledAt` | timestamp | Cumprimento |
| `brokenAt` | timestamp | Quebra |
| `reminderSent` | boolean | Lembrete enviado |
| `reminderSentAt` | timestamp | Envio lembrete |
| `notes` | text | Observações |
| `crmReference` | text | Referência CRM |
| `recordingUrl` | text | URL gravação |
| `createdAt` | timestamp | Criação |

**Índices:**
- `voice_promises_campaign_id_idx` → campaignId
- `voice_promises_status_idx` → status
- `voice_promises_due_date_idx` → dueDate

---

### `collection_settings` - Configurações de Cobrança

Singleton (id=1) - Configurações globais do módulo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | serial | ID (sempre 1) |
| `allowedContactMethods` | text[] | whatsapp, voice |
| `fallbackOrder` | text[] | Ordem fallback |
| `defaultMaxAttempts` | integer | Tentativas padrão |
| `defaultAttemptSpacingMinutes` | integer | Espaçamento padrão |
| `defaultActiveHours` | jsonb | Horários padrão |
| `enableAutoReminders` | boolean | Lembretes automáticos |
| `reminderDaysBefore` | integer | Dias antes vencimento |
| `enableCrmSync` | boolean | Sync CRM habilitado |
| `crmApiUrl` | text | URL API CRM |
| `crmApiKey` | text | Key CRM |
| `updatedBy` | varchar | Atualizador |
| `updatedAt` | timestamp | Atualização |
| `createdAt` | timestamp | Criação |

---

## Módulo de Contatos

### `contacts` - Contatos

Gerenciamento centralizado de contatos WhatsApp.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `phoneNumber` | text | Telefone (UNIQUE) |
| `name` | text | Nome |
| `document` | text | CPF/CNPJ |
| `documentType` | text | CPF, CNPJ, CLIENT_CODE |
| `email` | text | Email |
| `address` | text | Endereço |
| `city` | text | Cidade |
| `state` | text | Estado |
| `zipCode` | text | CEP |
| `tags` | text[] | Tags |
| `notes` | text | Observações |
| `whatsappProfilePicture` | text | URL foto perfil |
| `lastInteractionAt` | timestamp | Última interação |
| `totalConversations` | integer | Total conversas |
| `averageNps` | integer | NPS médio |
| `isBlacklisted` | boolean | Bloqueado |
| `blacklistReason` | text | Motivo bloqueio |
| `metadata` | jsonb | Metadados |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Atualização |

**Índices:**
- `contacts_phone_number_idx` → phoneNumber

---

## Módulo de RAG Analytics

### `rag_analytics` - Analytics de Consultas RAG

Rastreia uso da base de conhecimento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `conversationId` | varchar | Conversa |
| `assistantType` | text | Assistente |
| `query` | text | Consulta |
| `resultsFound` | boolean | Encontrou resultados |
| `topScore` | integer | Score do melhor match |
| `resultsCount` | integer | Número de resultados |
| `createdAt` | timestamp | Timestamp |

---

### `announcements` - Comunicados Internos

Sistema de comunicados para equipe.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `title` | text | Título |
| `message` | text | Mensagem |
| `type` | text | info, warning, alert, success |
| `targetRoles` | text[] | Roles alvo |
| `createdBy` | varchar | Criador |
| `createdAt` | timestamp | Criação |
| `expiresAt` | timestamp | Expiração |

---

### `message_templates` - Templates de Mensagens

Mensagens padronizadas (boas-vindas, NPS, etc).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | varchar (UUID) | ID |
| `key` | text | Chave única (UNIQUE) |
| `name` | text | Nome amigável |
| `description` | text | Descrição |
| `template` | text | Texto com variáveis |
| `variables` | text[] | Variáveis disponíveis |
| `category` | text | assignment, nps, system |
| `updatedAt` | timestamp | Atualização |
| `updatedBy` | varchar | Atualizador |

**Exemplo:**
```
key: "agent_welcome"
template: "Olá! Sou *{agentName}*, assumindo seu atendimento. Como posso ajudar?"
variables: ["agentName"]
```

---

## Índices e Performance

### **Índices Principais por Performance:**

**Conversas:**
- `conversations_status_last_message_idx` → Queries de dashboard (status + tempo)
- `conversations_assigned_to_idx` → Filtro por agente
- `conversations_department_idx` → Filtro por departamento

**Mensagens:**
- `messages_conversation_timestamp_idx` → Paginação de mensagens
- `messages_whatsapp_status_idx` → Recovery de mensagens travadas

**Gamificação:**
- `gamification_scores_total_score_idx` → Ordenação de ranking

**Falhas Massivas:**
- `failure_notifications_failure_id_idx` → Contagem de notificações

**Cobrança:**
- `voice_targets_next_attempt_idx` → Agendamento de tentativas

---

## Diagrama de Relacionamentos

### **Principais Relações:**

```
users (1) ──< (N) conversations [assignedTo]
users (1) ──< (N) activity_logs [userId]
users (1) ──< (N) gamification_scores [agentId]

conversations (1) ──< (N) messages [conversationId]
conversations (1) ──< (N) conversation_threads [conversationId]
conversations (1) ──< (N) alerts [conversationId]
conversations (1) ──< (1) satisfaction_feedback [conversationId]
conversations (1) ──< (1) complaints [conversationId]

voice_campaigns (1) ──< (N) voice_campaign_targets [campaignId]
voice_campaigns (1) ──< (1) crm_sync_configs [campaignId]
voice_campaign_targets (1) ──< (N) voice_promises [targetId]

contacts (1) ──< (N) voice_campaign_targets [contactId]

massive_failures (1) ──< (N) failure_notifications [failureId]

prompt_templates (1) ──< (N) prompt_versions [promptId]
prompt_templates (1) ──< (1) prompt_drafts [promptId]
```

---

## Convenções e Regras

### **Naming:**
- Tabelas: `snake_case` (plural)
- Campos: `camelCase`
- Enums: `lowercase` com underscores

### **IDs:**
- Tipo: `varchar` com `gen_random_uuid()`
- Exceção: `gamification_settings` usa `serial` (singleton)

### **Timestamps:**
- `createdAt` → Criação automática (DEFAULT NOW())
- `updatedAt` → Atualização manual
- `deletedAt` → Soft delete

### **Arrays:**
- Formato: `text[]` (PostgreSQL native)
- Exemplo: `departments text[] DEFAULT [general]`

### **JSONB:**
- Dados semi-estruturados
- Metadados flexíveis
- Configurações complexas

### **Soft Deletes:**
- Mensagens: `deletedAt`, `deletedBy`
- Preserva histórico

---

## Queries de Exemplo

### **Dashboard de Supervisor:**
```sql
-- Conversas ativas por status
SELECT status, COUNT(*) 
FROM conversations 
WHERE status IN ('active', 'transferred') 
GROUP BY status;

-- Tempo médio de resposta por agente
SELECT assigned_to, AVG(resolution_time) 
FROM conversations 
WHERE resolved_at >= NOW() - INTERVAL '30 days'
GROUP BY assigned_to;
```

### **Ranking de Gamificação:**
```sql
-- Top 5 do mês atual
SELECT u.full_name, gs.total_score, gs.ranking
FROM gamification_scores gs
JOIN users u ON u.id = gs.agent_id
WHERE gs.period = TO_CHAR(NOW(), 'YYYY-MM')
ORDER BY gs.ranking
LIMIT 5;
```

### **Métricas de Falhas Massivas:**
```sql
-- Notificações de falhas ativas
SELECT 
  COUNT(*) as total_notificacoes,
  COUNT(DISTINCT client_phone) as clientes_unicos
FROM failure_notifications fn
WHERE fn.failure_id IN (
  SELECT id FROM massive_failures WHERE status = 'active'
);
```

### **Conversas por Assistente:**
```sql
-- Volume por tipo de assistente
SELECT assistant_type, COUNT(*) 
FROM conversations 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY assistant_type;
```

---

## Backup e Manutenção

### **Backup Completo:**
```bash
pg_dump $DATABASE_URL --file=backup_$(date +%Y%m%d).sql
```

### **Apenas Schema:**
```bash
pg_dump $DATABASE_URL --schema-only --file=schema.sql
```

### **Limpeza de Dados Antigos:**
```sql
-- Deletar mensagens privadas antigas (>90 dias)
DELETE FROM messages 
WHERE is_private = true 
  AND timestamp < NOW() - INTERVAL '90 days';

-- Arquivar conversas resolvidas antigas
UPDATE conversations 
SET metadata = jsonb_set(metadata, '{archived}', 'true') 
WHERE resolved_at < NOW() - INTERVAL '180 days';
```

---

## Versionamento

**Histórico de Mudanças:**

- **v3.0** (Nov 2025)
  - Thread Rotation System
  - Message Recovery Scheduler
  - WhatsApp Business (@lid) support
  - Context Quality Monitoring
  
- **v2.5** (Out 2025)
  - Módulo de Cobrança completo
  - CRM Sync automático
  - Gamificação v2
  
- **v2.0** (Set 2025)
  - Prompt Management System
  - Massive Failures Module
  - RAG Analytics

- **v1.0** (Ago 2025)
  - Schema inicial
  - Conversas + Mensagens
  - Sistema básico de supervisão

---

## Referências

- **Drizzle ORM:** https://orm.drizzle.team/
- **PostgreSQL Arrays:** https://www.postgresql.org/docs/current/arrays.html
- **JSONB:** https://www.postgresql.org/docs/current/datatype-json.html
- **Indexes:** https://www.postgresql.org/docs/current/indexes.html

---

**Documentação completa do schema do banco de dados LIA CORTEX.**  
Para detalhes sobre migração e replicação, consulte `DATABASE_EXPORT_AND_REPLICATION.md`.
