-- =====================================================
-- MIGRATION: Two-Stage Automatic Conversation Closure
-- Data: 2025-10-14
-- Descrição: Adiciona sistema de encerramento automático
--            de conversas inativas em duas etapas
-- =====================================================

-- =====================================================
-- PASSO 1: Adicionar colunas de auto-closure
-- =====================================================

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS auto_closed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_closed_reason TEXT,
ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMP;

COMMENT ON COLUMN conversations.auto_closed IS 'Se a conversa foi encerrada automaticamente por inatividade';
COMMENT ON COLUMN conversations.auto_closed_reason IS 'Motivo do encerramento automático (ex: inactivity)';
COMMENT ON COLUMN conversations.auto_closed_at IS 'Quando a conversa foi encerrada automaticamente';

-- =====================================================
-- PASSO 2: Inserir templates de mensagens
-- =====================================================

-- Template: Follow-up de inatividade (10 minutos)
INSERT INTO message_templates (key, name, description, template, variables, category, updated_at)
VALUES (
  'inactivity_followup',
  'Follow-up de Inatividade',
  'Mensagem enviada após 10 minutos de inatividade do cliente para verificar se ainda precisa de ajuda',
  'Olá! 👋

Percebi que você não respondeu há alguns minutos. Ainda está precisando de ajuda?

Estou aqui se precisar de algo! 😊',
  ARRAY[]::text[],
  'inactivity',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  template = EXCLUDED.template,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Template: Encerramento automático (30 minutos total)
INSERT INTO message_templates (key, name, description, template, variables, category, updated_at)
VALUES (
  'auto_closure',
  'Encerramento Automático',
  'Mensagem enviada após 30 minutos de inatividade (10min follow-up + 20min espera) para encerrar o atendimento',
  '⚠️ *Aviso de encerramento de atendimento*

Informamos que, devido à inatividade, este atendimento será encerrado.

Se precisar de ajuda novamente, basta entrar em contato conosco. Estamos sempre à disposição! 😊

Tenha um ótimo dia! 🌟',
  ARRAY[]::text[],
  'inactivity',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  template = EXCLUDED.template,
  description = EXCLUDED.description,
  updated_at = NOW();

-- =====================================================
-- PASSO 3: Verificar dados inseridos
-- =====================================================

-- Verificar colunas adicionadas
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversations' 
  AND column_name IN ('auto_closed', 'auto_closed_reason', 'auto_closed_at')
ORDER BY column_name;

-- Verificar templates inseridos
SELECT 
  key, 
  name, 
  category,
  LENGTH(template) as template_length,
  updated_at
FROM message_templates 
WHERE key IN ('inactivity_followup', 'auto_closure')
ORDER BY key;

-- =====================================================
-- INFORMAÇÕES SOBRE O SISTEMA
-- =====================================================

/*
FLUXO DE ENCERRAMENTO AUTOMÁTICO:

1. ESTÁGIO 1 - Follow-up (10 minutos)
   - Cliente fica inativo por 10 minutos
   - Sistema envia template 'inactivity_followup'
   - Agenda estágio 2 para daqui a 20 minutos

2. ESTÁGIO 2 - Encerramento (+ 20 minutos = 30 minutos total)
   - Se cliente não responder em 20 minutos após follow-up
   - Sistema envia template 'auto_closure'
   - Marca conversa como resolvida com:
     * status = 'resolved'
     * auto_closed = true
     * auto_closed_reason = 'inactivity'
     * auto_closed_at = NOW()

CANCELAMENTO INTELIGENTE:
   - Se cliente responder a qualquer momento:
     * Ambos os timers são cancelados
     * Ciclo recomeça do zero (novo timer de 10 minutos)
   
   - Conversas transferidas para humanos:
     * NUNCA são fechadas automaticamente
     * Sistema respeita o atendimento humano

WORKERS:
   - inactivityFollowupWorker: Envia follow-up após 10min
   - autoClosureWorker: Encerra conversa após 30min total
   - Concurrency: 2 jobs simultâneos cada

QUEUES (BullMQ):
   - INACTIVITY_FOLLOWUP: Jobs de follow-up
   - AUTO_CLOSURE: Jobs de encerramento
*/
