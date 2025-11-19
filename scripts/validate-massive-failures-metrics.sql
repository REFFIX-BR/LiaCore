-- ==========================================
-- VALIDAÇÃO DE MÉTRICAS - FALHAS MASSIVAS
-- ==========================================
-- Execute este script para validar os números do dashboard

-- 1. MÉTRICAS PRINCIPAIS
SELECT 
  '=== MÉTRICAS PRINCIPAIS ===' as secao;

WITH active_failures AS (
  SELECT id, name, severity
  FROM massive_failures
  WHERE status = 'active'
),
active_notifications AS (
  SELECT fn.*
  FROM failure_notifications fn
  WHERE fn.notification_type = 'failure'
    AND fn.failure_id IN (SELECT id FROM active_failures)
)
SELECT 
  (SELECT COUNT(*) FROM active_failures) as falhas_ativas,
  (SELECT COUNT(*) FROM active_notifications) as notificacoes_enviadas,
  (SELECT COUNT(DISTINCT client_phone) FROM active_notifications) as clientes_notificados;

-- 2. FALHAS POR SEVERIDADE
SELECT 
  '=== FALHAS POR SEVERIDADE ===' as secao;

SELECT 
  severity,
  COUNT(*) as quantidade
FROM massive_failures
WHERE status = 'active'
GROUP BY severity
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;

-- 3. ÚLTIMAS 5 FALHAS COM NOTIFICAÇÕES
SELECT 
  '=== ÚLTIMAS 5 FALHAS REGISTRADAS ===' as secao;

SELECT 
  mf.name as titulo,
  mf.severity as severidade,
  mf.status,
  COUNT(fn.id) as notificacoes_enviadas,
  mf.created_at as criada_em
FROM massive_failures mf
LEFT JOIN failure_notifications fn 
  ON fn.failure_id = mf.id 
  AND fn.notification_type = 'failure'
GROUP BY mf.id, mf.name, mf.severity, mf.status, mf.created_at
ORDER BY mf.created_at DESC
LIMIT 5;

-- 4. DETALHAMENTO DAS NOTIFICAÇÕES ATIVAS
SELECT 
  '=== DETALHAMENTO DAS NOTIFICAÇÕES (FALHAS ATIVAS) ===' as secao;

SELECT 
  mf.name as falha,
  fn.client_phone as telefone,
  fn.sent_at as enviado_em,
  CASE WHEN fn.was_read THEN 'Sim' ELSE 'Não' END as lida,
  fn.responded_at as respondeu_em
FROM massive_failures mf
JOIN failure_notifications fn ON fn.failure_id = mf.id
WHERE fn.notification_type = 'failure'
  AND mf.status = 'active'
ORDER BY mf.created_at DESC, fn.sent_at DESC;

-- 5. VERIFICAR INCONSISTÊNCIAS
SELECT 
  '=== VERIFICAÇÃO DE INCONSISTÊNCIAS ===' as secao;

-- 5.1 Notificações órfãs (sem falha associada)
SELECT 
  'Notificações órfãs (sem falha):' as tipo,
  COUNT(*) as quantidade
FROM failure_notifications fn
LEFT JOIN massive_failures mf ON mf.id = fn.failure_id
WHERE mf.id IS NULL
  AND fn.notification_type = 'failure'

UNION ALL

-- 5.2 Falhas sem notificações
SELECT 
  'Falhas ativas sem notificações:' as tipo,
  COUNT(*) as quantidade
FROM massive_failures mf
LEFT JOIN failure_notifications fn ON fn.failure_id = mf.id
WHERE mf.status = 'active'
  AND fn.id IS NULL;

-- 6. REGIÕES AFETADAS POR FALHA ATIVA
SELECT 
  '=== REGIÕES AFETADAS (FALHAS ATIVAS) ===' as secao;

SELECT 
  name as titulo,
  affected_regions::text as regioes_json,
  created_at as criada_em
FROM massive_failures
WHERE status = 'active'
ORDER BY created_at DESC;
