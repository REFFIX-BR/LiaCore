/**
 * AI Response Validator - Sistema Anti-Alucinação v1.1
 * 
 * Intercepta respostas da IA ANTES de enviar ao cliente,
 * detectando e corrigindo padrões de alucinação.
 * 
 * v1.1 - Ajustes para reduzir falsos positivos:
 * - Padrões mais específicos com contexto
 * - Exceções para casos legítimos
 * - Verificação de resultados na resposta
 */

export type ValidationSeverity = 'block' | 'auto_correct' | 'warn';

export interface ValidationResult {
  valid: boolean;
  severity: ValidationSeverity;
  rule: string;
  message: string;
  originalResponse: string;
  correctedResponse?: string;
}

export interface ValidationContext {
  response: string;
  clientName?: string;
  assistantType?: string;
  functionCalls?: Array<{ name: string; arguments: string }>;
  transferred?: boolean;
  routed?: boolean;
  conversationId?: string;
  chatId?: string;
}

export interface ValidationOutput {
  status: 'ok' | 'corrected' | 'blocked';
  finalResponse: string;
  violations: ValidationResult[];
}

// ============================================================================
// PADRÕES REFINADOS v1.1 - Mais específicos para evitar falsos positivos
// ============================================================================

// Frases que indicam promessas VAZIAS (sem ação real)
// REFINADO: Só bloqueia se terminar com promessa sem resultado
const EMPTY_PROMISE_PATTERNS = [
  // Promessas futuras sem entrega imediata
  /vou verificar e (te |lhe )?(retorno|volto|aviso)/i,
  /vou consultar e (te |lhe )?(retorno|volto|aviso)/i,
  /aguarde que (vou |eu )?(verifico|consulto|analiso)/i,
  /já (te )?retorno com (a |as )?(informaç|dado)/i,
  /vou analisar (isso|aqui|seu caso) e/i,
  // Promessas de "um momento" que não entregam
  /um momento que (vou |eu )?ver/i,
  /deixa eu ver (aqui )?e/i,
];

// Indicadores de que a resposta CONTÉM resultado (não é promessa vazia)
const RESULT_INDICATORS = [
  /seu (boleto|fatura|plano|saldo)/i,
  /o valor (é|está|será)/i,
  /vencimento/i,
  /código de barras/i,
  /pix copia e cola/i,
  /R\$\s*\d/i, // Valores monetários
  /\d{2}\/\d{2}\/\d{4}/i, // Datas
  /status.*(online|offline|ativo|bloqueado)/i,
  /sua conexão/i,
  /encontrei (o |a |os |as )?/i,
  /aqui estão/i,
  /segue (o |a |os |as )?/i,
];

// Frases que indicam transferência FALSA (passado sem função)
// REFINADO: Foco em afirmações no passado/presente que implicam ação já feita
const FALSE_TRANSFER_PATTERNS = [
  // PASSADO - afirmando que já fez
  /já (te )?transferi para/i,
  /já encaminhei (você |seu caso )?para/i,
  /atendente (já )?foi acionado/i,
  /supervisor (já )?foi acionado/i,
  /técnico (já )?foi (acionado|chamado|agendado)/i,
  /seu (caso|atendimento) foi (transferido|encaminhado)/i,
  // AFIRMAÇÕES de ação concluída sem evidência
  /acionei (o |a )?(atendente|supervisor|técnico)/i,
  /transferi (você |seu caso )?para/i,
];

// Frases LEGÍTIMAS que mencionam transferência (não são falsas)
const LEGITIMATE_TRANSFER_PHRASES = [
  /vou (te )?transferir/i, // Futuro - intenção, não afirmação
  /preciso (te )?transferir/i,
  /será (necessário )?transferi/i,
  /transferindo (você )?para/i, // Gerúndio - ação em curso (OK se routed=true)
];

// Frases de incapacidade que DEVEM transferir
// REFINADO: Só bloqueia se não oferecer alternativa
const INABILITY_PATTERNS = [
  // Incapacidade sem alternativa
  /não (consigo|consegui) (acessar|consultar|verificar).{0,30}$/i, // Termina sem alternativa
  /sistema (está|parece) indisponível.{0,30}$/i,
  /estou com dificuldade.{0,30}$/i,
];

// Indicadores de que ofereceu alternativa (não bloquear)
const ALTERNATIVE_INDICATORS = [
  /mas (posso|você pode|podemos)/i,
  /porém/i,
  /entretanto/i,
  /enquanto isso/i,
  /alternativamente/i,
  /outra opção/i,
  /vou transferir/i,
];

// ============================================================================
// REGRAS DE VALIDAÇÃO
// ============================================================================

/**
 * Regra 1: Detecta promessas vazias sem function_call correspondente
 * REFINADO: Verifica se resposta contém resultado antes de bloquear
 */
function validateNoEmptyPromises(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls } = ctx;
  
  // Se chamou alguma função de consulta, está OK
  const consultaFunctions = [
    'consultar_boleto', 'consultar_cliente', 'consultar_plano_cliente', 
    'verificar_status_os', 'check_pppoe_status', 'buscar_conhecimento',
    'consultar_faturas', 'consultar_conexao'
  ];
  const hasConsultaFunction = functionCalls?.some(fc => consultaFunctions.includes(fc.name));
  
  if (hasConsultaFunction) {
    return null; // OK - está de fato consultando
  }
  
  // Verificar se resposta contém resultado (não é promessa vazia)
  const hasResult = RESULT_INDICATORS.some(pattern => pattern.test(response));
  if (hasResult) {
    return null; // OK - resposta contém dados reais
  }
  
  // Verificar se resposta contém promessa vazia
  for (const pattern of EMPTY_PROMISE_PATTERNS) {
    if (pattern.test(response)) {
      return {
        valid: false,
        severity: 'block',
        rule: 'no_empty_promises',
        message: `Promessa vazia detectada: "${response.match(pattern)?.[0]}"`,
        originalResponse: response,
      };
    }
  }
  
  return null;
}

/**
 * Regra 2: Verifica se nome usado corresponde ao client_name da conversa
 */
function validateClientName(ctx: ValidationContext): ValidationResult | null {
  const { response, clientName } = ctx;
  
  if (!clientName || clientName === 'Cliente' || clientName === 'Desconhecido') {
    return null; // Não temos nome para validar
  }
  
  // Padrões comuns de tratamento com nome
  const namePatterns = [
    /olá,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /oi,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /bom dia,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /boa tarde,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /boa noite,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /certo,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /entendi,?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /obrigad[oa],?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = response.match(pattern);
    if (match && match[1]) {
      const usedName = match[1].toLowerCase();
      const expectedName = clientName.split(' ')[0].toLowerCase();
      
      // Ignorar nomes genéricos
      const genericNames = ['cliente', 'senhor', 'senhora', 'você'];
      if (genericNames.includes(usedName)) {
        continue;
      }
      
      if (usedName !== expectedName) {
        return {
          valid: false,
          severity: 'auto_correct',
          rule: 'client_name_mismatch',
          message: `Nome errado: "${match[1]}" → "${clientName.split(' ')[0]}"`,
          originalResponse: response,
          correctedResponse: response.replace(match[1], clientName.split(' ')[0]),
        };
      }
    }
  }
  
  return null;
}

/**
 * Regra 3: Detecta afirmações de transferência sem função real
 * REFINADO: Distingue entre intenção futura (OK) e afirmação de ação feita (problema)
 */
function validateTransferClaims(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls, transferred, routed } = ctx;
  
  // Se de fato transferiu/roteou, está OK
  if (transferred || routed) {
    return null;
  }
  
  // Verificar se chamou função de transferência
  const transferFunctions = ['transferir_para_humano', 'rotear_para_assistente', 'finalizar_conversa'];
  const hasTransferFunction = functionCalls?.some(fc => transferFunctions.includes(fc.name));
  
  if (hasTransferFunction) {
    return null; // OK - função foi chamada
  }
  
  // Verificar se é frase legítima de intenção (não afirmação)
  const isLegitimate = LEGITIMATE_TRANSFER_PHRASES.some(p => p.test(response));
  
  // Verificar se resposta afirma ter transferido (passado/presente perfeito)
  for (const pattern of FALSE_TRANSFER_PATTERNS) {
    if (pattern.test(response)) {
      // Se também tem frase legítima, é ambíguo - só avisar
      if (isLegitimate) {
        return {
          valid: false,
          severity: 'warn',
          rule: 'ambiguous_transfer_claim',
          message: `Menção ambígua de transferência: "${response.match(pattern)?.[0]}"`,
          originalResponse: response,
        };
      }
      
      return {
        valid: false,
        severity: 'block',
        rule: 'false_transfer_claim',
        message: `Afirmou transferência sem função: "${response.match(pattern)?.[0]}"`,
        originalResponse: response,
      };
    }
  }
  
  // Verificar frases de incapacidade (deve transferir ou oferecer alternativa)
  for (const pattern of INABILITY_PATTERNS) {
    if (pattern.test(response)) {
      // Verificar se ofereceu alternativa
      const hasAlternative = ALTERNATIVE_INDICATORS.some(p => p.test(response));
      if (hasAlternative) {
        return null; // OK - ofereceu alternativa
      }
      
      return {
        valid: false,
        severity: 'warn', // Só warn, não block - pode ser legítimo
        rule: 'inability_without_alternative',
        message: `Incapacidade sem alternativa: "${response.match(pattern)?.[0]}"`,
        originalResponse: response,
      };
    }
  }
  
  return null;
}

/**
 * Regra 4: Detecta assistente falando de assunto fora do escopo
 * REFINADO: Só avisa se está EXPLICANDO sobre o assunto (não apenas mencionando)
 */
function validateScopeViolation(ctx: ValidationContext): ValidationResult | null {
  const { response, assistantType, routed } = ctx;
  
  if (!assistantType || routed) {
    return null;
  }
  
  // Mapeamento de escopo - padrões que indicam EXPLICAÇÃO fora do escopo
  const scopeViolations: Record<string, { patterns: RegExp[]; shouldRouteTo: string }[]> = {
    financeiro: [
      // Só viola se está explicando sobre conexão (não apenas mencionando)
      { patterns: [/sua (internet|conexão) (está|parece|continua)/i], shouldRouteTo: 'suporte' },
    ],
    suporte: [
      // Só viola se está explicando sobre pagamento (não apenas mencionando)
      { patterns: [/seu (boleto|fatura) (está|vence|no valor)/i], shouldRouteTo: 'financeiro' },
    ],
    comercial: [
      // Comercial pode mencionar boleto/fatura ao falar de planos
      { patterns: [/sua (fatura|dívida) (está|vence|em atraso)/i], shouldRouteTo: 'financeiro' },
    ],
  };
  
  const violations = scopeViolations[assistantType];
  if (!violations) {
    return null;
  }
  
  // Frases que indicam redirecionamento legítimo (não violação)
  const redirectPhrases = [
    /para (isso|esse assunto)/i,
    /vou (te )?transferir/i,
    /precisa falar com/i,
    /departamento de/i,
  ];
  
  const isRedirecting = redirectPhrases.some(p => p.test(response));
  if (isRedirecting) {
    return null; // OK - está redirecionando
  }
  
  for (const violation of violations) {
    for (const pattern of violation.patterns) {
      if (pattern.test(response)) {
        return {
          valid: false,
          severity: 'warn',
          rule: 'scope_violation',
          message: `${assistantType} explicando assunto de ${violation.shouldRouteTo}`,
          originalResponse: response,
        };
      }
    }
  }
  
  return null;
}

/**
 * Regra 5: Detecta respostas muito longas
 * REFINADO: Limite aumentado, só warn
 */
function validateResponseLength(ctx: ValidationContext): ValidationResult | null {
  const { response } = ctx;
  const MAX_LENGTH = 800; // Aumentado de 500 para 800
  
  if (response.length > MAX_LENGTH) {
    return {
      valid: false,
      severity: 'warn',
      rule: 'response_too_long',
      message: `Resposta longa: ${response.length} chars (recomendado: ${MAX_LENGTH})`,
      originalResponse: response,
    };
  }
  
  return null;
}

/**
 * Executa todas as validações e retorna resultado consolidado
 */
export function validateAIResponse(ctx: ValidationContext): ValidationOutput {
  const violations: ValidationResult[] = [];
  
  // Executar todas as regras
  const rules = [
    validateNoEmptyPromises,
    validateClientName,
    validateTransferClaims,
    validateScopeViolation,
    validateResponseLength,
  ];
  
  for (const rule of rules) {
    const result = rule(ctx);
    if (result) {
      violations.push(result);
    }
  }
  
  // Determinar status final
  const hasBlock = violations.some(v => v.severity === 'block');
  const hasAutoCorrect = violations.some(v => v.severity === 'auto_correct');
  
  if (hasBlock) {
    const blockViolation = violations.find(v => v.severity === 'block');
    console.error(`🚫 [Validator] BLOCKED: ${blockViolation?.message}`);
    
    return {
      status: 'blocked',
      finalResponse: 'Vou transferir você para um atendente que poderá ajudar melhor. Um momento!',
      violations,
    };
  }
  
  if (hasAutoCorrect) {
    const correction = violations.find(v => v.severity === 'auto_correct' && v.correctedResponse);
    const finalResponse = correction?.correctedResponse || ctx.response;
    
    console.warn(`⚠️ [Validator] AUTO-CORRECTED: ${correction?.message}`);
    
    return {
      status: 'corrected',
      finalResponse,
      violations,
    };
  }
  
  // Log warnings se houver
  for (const v of violations.filter(v => v.severity === 'warn')) {
    console.warn(`⚠️ [Validator] WARNING: ${v.message}`);
  }
  
  return {
    status: 'ok',
    finalResponse: ctx.response,
    violations,
  };
}

/**
 * Log e persiste violações para analytics
 */
export async function logValidationMetrics(
  output: ValidationOutput,
  conversationId?: string,
  assistantType?: string,
  chatId?: string
): Promise<void> {
  if (output.violations.length === 0) {
    return;
  }
  
  // Importação dinâmica para evitar dependência circular
  const { storage } = await import('../storage');
  
  for (const violation of output.violations) {
    // Log no console para debugging
    console.log(`📊 [Validator Metrics] ${JSON.stringify({
      timestamp: new Date().toISOString(),
      conversationId,
      assistantType,
      rule: violation.rule,
      severity: violation.severity,
      status: output.status,
      message: violation.message.substring(0, 100),
    })}`);
    
    // Persistir no banco de dados
    try {
      await storage.createValidationViolation({
        conversationId: conversationId || null,
        chatId: chatId || null,
        assistantType: assistantType || null,
        rule: violation.rule,
        severity: violation.severity,
        status: output.status,
        message: violation.message,
        originalResponse: violation.originalResponse,
        correctedResponse: violation.correctedResponse || null,
      });
    } catch (err) {
      console.error(`❌ [Validator] Failed to persist violation:`, err);
    }
  }
}
