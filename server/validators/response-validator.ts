/**
 * AI Response Validator - Sistema Anti-Alucinação
 * 
 * Intercepta respostas da IA ANTES de enviar ao cliente,
 * detectando e corrigindo padrões de alucinação.
 * 
 * Regras:
 * 1. validateNoEmptyPromises - Detecta "vou verificar/consultar" sem function_call
 * 2. validateClientName - Verifica se nome usado = client_name da conversa
 * 3. validateTransferClaims - Detecta "transferi/acionado" sem função real
 * 4. validateScopeViolation - Assistente falando de assunto fora do escopo
 * 5. validateResponseLength - Resposta muito longa (>500 chars)
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

// Frases que indicam promessas vazias (sem ação real)
const EMPTY_PROMISE_PATTERNS = [
  /vou verificar/i,
  /vou consultar/i,
  /vou checar/i,
  /estou verificando/i,
  /estou consultando/i,
  /estou checando/i,
  /vou confirmar/i,
  /estou confirmando/i,
  /vou analisar/i,
  /estou analisando/i,
  /deixa eu ver/i,
  /deixa eu verificar/i,
  /aguarde enquanto (eu )?(verifico|consulto|analiso)/i,
  /vou retornar com/i,
  /retorno com (a )?informação/i,
  /vou te retornar/i,
  /já te retorno/i,
  /um momento que/i,
];

// Frases que indicam transferência falsa (sem função real)
const FALSE_TRANSFER_PATTERNS = [
  /transferi para/i,
  /encaminhei para/i,
  /acionei (o |a |um |uma )?atendente/i,
  /acionei (o |a )?supervisor/i,
  /acionei (o |a |um |uma )?técnico/i,
  /atendente foi acionado/i,
  /supervisor foi acionado/i,
  /técnico foi acionado/i,
  /foi transferido para/i,
  /seu atendimento foi encaminhado/i,
  /estou transferindo/i,
  /estou encaminhando/i,
  /vou acionar/i,
];

// Frases que indicam incapacidade (deve transferir em vez de dizer isso)
const INABILITY_PATTERNS = [
  /estou com dificuldade/i,
  /não consigo (acessar|consultar|verificar)/i,
  /não consegui (acessar|consultar|verificar)/i,
  /sistema (está|parece) indisponível/i,
  /não estou conseguindo/i,
  /infelizmente não consigo/i,
];

// Mapeamento de escopo por assistente
const ASSISTANT_SCOPE: Record<string, string[]> = {
  financeiro: ['boleto', 'fatura', 'pagamento', 'débito', 'crédito', 'cobrança', 'pix', 'segunda via', 'desbloqueio'],
  suporte: ['internet', 'conexão', 'lenta', 'wifi', 'roteador', 'técnico', 'instável', 'sem sinal', 'caindo'],
  comercial: ['plano', 'upgrade', 'migração', 'contrato', 'assinatura', 'velocidade', 'novo plano'],
  cobranca: ['dívida', 'atraso', 'negativação', 'acordo', 'parcelamento', 'quitação'],
};

// Tópicos que são de outro escopo
const SCOPE_VIOLATIONS: Record<string, { patterns: RegExp[]; shouldRouteTo: string }[]> = {
  financeiro: [
    { patterns: [/internet (lenta|caindo|instável)/i, /sem (internet|conexão|sinal)/i], shouldRouteTo: 'suporte' },
    { patterns: [/mudar de plano/i, /upgrade/i, /novo plano/i], shouldRouteTo: 'comercial' },
  ],
  suporte: [
    { patterns: [/boleto/i, /fatura/i, /pagamento/i, /segunda via/i], shouldRouteTo: 'financeiro' },
    { patterns: [/mudar de plano/i, /upgrade/i, /novo plano/i], shouldRouteTo: 'comercial' },
  ],
  comercial: [
    { patterns: [/boleto/i, /fatura/i, /pagamento/i], shouldRouteTo: 'financeiro' },
    { patterns: [/internet (lenta|caindo)/i, /sem internet/i], shouldRouteTo: 'suporte' },
  ],
  cobranca: [
    { patterns: [/internet (lenta|caindo)/i, /sem internet/i], shouldRouteTo: 'suporte' },
    { patterns: [/mudar de plano/i, /novo plano/i], shouldRouteTo: 'comercial' },
  ],
};

/**
 * Regra 1: Detecta promessas vazias sem function_call correspondente
 */
function validateNoEmptyPromises(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls } = ctx;
  
  // Se chamou alguma função de consulta, está OK
  const consultaFunctions = ['consultar_boleto', 'consultar_cliente', 'consultar_plano_cliente', 'verificar_status_os', 'check_pppoe_status'];
  const hasConsultaFunction = functionCalls?.some(fc => consultaFunctions.includes(fc.name));
  
  if (hasConsultaFunction) {
    return null; // OK - está de fato consultando
  }
  
  // Verificar se resposta contém promessa vazia
  for (const pattern of EMPTY_PROMISE_PATTERNS) {
    if (pattern.test(response)) {
      return {
        valid: false,
        severity: 'block',
        rule: 'no_empty_promises',
        message: `Resposta contém promessa vazia "${response.match(pattern)?.[0]}" sem função de consulta`,
        originalResponse: response,
        correctedResponse: undefined, // Será bloqueada
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
    /senhor[a]?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /sr[a]?\.?\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = response.match(pattern);
    if (match && match[1]) {
      const usedName = match[1].toLowerCase();
      const expectedName = clientName.split(' ')[0].toLowerCase();
      
      if (usedName !== expectedName && usedName !== 'cliente') {
        return {
          valid: false,
          severity: 'auto_correct',
          rule: 'client_name_mismatch',
          message: `IA usou nome "${match[1]}" mas cliente é "${clientName}"`,
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
 */
function validateTransferClaims(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls, transferred, routed } = ctx;
  
  // Se de fato transferiu/roteou, está OK
  if (transferred || routed) {
    return null;
  }
  
  // Verificar se chamou função de transferência
  const transferFunctions = ['transferir_para_humano', 'rotear_para_assistente'];
  const hasTransferFunction = functionCalls?.some(fc => transferFunctions.includes(fc.name));
  
  if (hasTransferFunction) {
    return null; // OK - está de fato transferindo
  }
  
  // Verificar se resposta afirma ter transferido
  for (const pattern of FALSE_TRANSFER_PATTERNS) {
    if (pattern.test(response)) {
      return {
        valid: false,
        severity: 'block',
        rule: 'false_transfer_claim',
        message: `IA afirmou "${response.match(pattern)?.[0]}" sem chamar função de transferência`,
        originalResponse: response,
      };
    }
  }
  
  // Verificar frases de incapacidade (deve transferir)
  for (const pattern of INABILITY_PATTERNS) {
    if (pattern.test(response)) {
      return {
        valid: false,
        severity: 'block',
        rule: 'inability_without_transfer',
        message: `IA disse "${response.match(pattern)?.[0]}" mas não transferiu - deve transferir`,
        originalResponse: response,
      };
    }
  }
  
  return null;
}

/**
 * Regra 4: Detecta assistente falando de assunto fora do escopo
 */
function validateScopeViolation(ctx: ValidationContext): ValidationResult | null {
  const { response, assistantType, routed } = ctx;
  
  if (!assistantType || routed) {
    return null; // Sem tipo de assistente ou já roteou
  }
  
  const violations = SCOPE_VIOLATIONS[assistantType];
  if (!violations) {
    return null;
  }
  
  for (const violation of violations) {
    for (const pattern of violation.patterns) {
      if (pattern.test(response)) {
        return {
          valid: false,
          severity: 'warn',
          rule: 'scope_violation',
          message: `Assistente ${assistantType} respondendo sobre assunto de ${violation.shouldRouteTo}: "${response.match(pattern)?.[0]}"`,
          originalResponse: response,
        };
      }
    }
  }
  
  return null;
}

/**
 * Regra 5: Detecta respostas muito longas
 */
function validateResponseLength(ctx: ValidationContext): ValidationResult | null {
  const { response } = ctx;
  const MAX_LENGTH = 500;
  
  if (response.length > MAX_LENGTH) {
    return {
      valid: false,
      severity: 'warn',
      rule: 'response_too_long',
      message: `Resposta muito longa (${response.length} chars, máximo recomendado: ${MAX_LENGTH})`,
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
    // Resposta bloqueada - usar fallback genérico ou forçar transferência
    console.error(`🚫 [Validator] BLOCKED: ${violations.find(v => v.severity === 'block')?.message}`);
    
    return {
      status: 'blocked',
      finalResponse: 'Vou transferir você para um atendente que poderá ajudar melhor. Um momento!',
      violations,
    };
  }
  
  if (hasAutoCorrect) {
    // Corrigir automaticamente
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
 * Log de violações para analytics
 */
export function logValidationMetrics(
  output: ValidationOutput,
  conversationId?: string,
  assistantType?: string
): void {
  if (output.violations.length === 0) {
    return;
  }
  
  for (const violation of output.violations) {
    console.log(`📊 [Validator Metrics] ${JSON.stringify({
      timestamp: new Date().toISOString(),
      conversationId,
      assistantType,
      rule: violation.rule,
      severity: violation.severity,
      status: output.status,
      message: violation.message.substring(0, 100),
    })}`);
  }
}
