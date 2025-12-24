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
 * Regra 6: Detecta confirmações de agendamento/protocolo SEM chamada de API
 * v1.0 - Nova regra anti-alucinação para detectar IA inventando agendamentos
 * 
 * PROBLEMA: IA disse "agendamento confirmado para 15/12, protocolo #123456"
 * sem ter chamado nenhuma função para verificar/criar agendamento.
 */
function validateAppointmentConfirmations(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls } = ctx;
  
  // Padrões que indicam CONFIRMAÇÃO de agendamento/visita/protocolo
  const APPOINTMENT_CONFIRMATION_PATTERNS = [
    // Agendamento confirmado
    /agendamento.{0,20}(confirmado|marcado|registrado)/i,
    /visita.{0,20}(agendada|confirmada|marcada)/i,
    /técnico.{0,20}(agendado|confirmado|irá|vai)/i,
    /equipe.{0,20}(irá|vai|estará).{0,20}(no local|endereço|casa)/i,
    
    // Afirmações de data específica de visita
    /confirmado para (o dia |amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}\/\d{1,2})/i,
    /agendado para (o dia |amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}\/\d{1,2})/i,
    /a (equipe|técnico|visita).{0,30}(amanhã|hoje|\d{1,2}\/\d{1,2})/i,
    
    // Protocolo gerado (formato comum: #123456 ou protocolo: 123456)
    /protocolo[:\s#]+\d{6,}/i,
    /número do protocolo[:\s]+\d+/i,
    /seu protocolo (é|foi)[:\s]+/i,
    
    // Ordem de serviço criada
    /ordem de serviço.{0,20}(criada|aberta|registrada|gerada)/i,
    /OS.{0,10}(criada|aberta|registrada|número)/i,
    
    // Confirmações genéricas de serviço agendado
    /seu (serviço|atendimento).{0,20}(agendado|confirmado)/i,
    /troca.{0,20}(agendada|confirmada|marcada)/i,
    /instalação.{0,20}(agendada|confirmada|marcada)/i,
  ];
  
  // Funções que LEGITIMAM confirmações de agendamento
  const SCHEDULING_FUNCTIONS = [
    'agendar_visita',
    'verificar_status_os',
    'criar_ordem_servico',
    'consultar_agendamento',
    'registrar_protocolo',
    'abrir_ticket',
    'criar_ticket',
    'check_pppoe_status', // Pode retornar info de OS existente
    'consultar_cliente', // Pode retornar agendamentos existentes
  ];
  
  // Verificar se chamou alguma função de agendamento/OS
  const hasSchedulingFunction = functionCalls?.some(fc => 
    SCHEDULING_FUNCTIONS.includes(fc.name)
  );
  
  if (hasSchedulingFunction) {
    return null; // OK - chamou função que pode ter retornado agendamento real
  }
  
  // Frases que indicam que está PERGUNTANDO sobre agendamento (não confirmando)
  const ASKING_PATTERNS = [
    /gostaria de agendar/i,
    /quer (agendar|marcar)/i,
    /posso agendar/i,
    /vou (agendar|transferir para agendar)/i,
    /para agendar/i,
    /você.{0,20}(agendar|marcar)/i,
  ];
  
  const isAsking = ASKING_PATTERNS.some(p => p.test(response));
  if (isAsking) {
    return null; // OK - está perguntando, não confirmando
  }
  
  // Frases que indicam referência a agendamento do PASSADO (feito por humano)
  const PAST_REFERENCE_PATTERNS = [
    /conforme.{0,20}(agendado|combinado)/i,
    /como (você |o cliente )?(solicitou|pediu)/i,
    /de acordo com.{0,20}(agendamento|protocolo)/i,
  ];
  
  const isPastReference = PAST_REFERENCE_PATTERNS.some(p => p.test(response));
  // Mesmo referência ao passado pode ser alucinação - verificar com cuidado
  
  // Verificar se resposta contém confirmação de agendamento
  for (const pattern of APPOINTMENT_CONFIRMATION_PATTERNS) {
    if (pattern.test(response)) {
      const match = response.match(pattern)?.[0] || '';
      
      // Se é referência ao passado, só warn (pode ser legítimo)
      if (isPastReference) {
        return {
          valid: false,
          severity: 'warn',
          rule: 'appointment_confirmation_without_api',
          message: `Referência a agendamento sem verificação de API: "${match}"`,
          originalResponse: response,
        };
      }
      
      // Se não chamou função E não é referência ao passado, BLOCK
      return {
        valid: false,
        severity: 'block',
        rule: 'appointment_confirmation_without_api',
        message: `🚨 ALUCINAÇÃO: Confirmou agendamento/protocolo sem chamar API: "${match}"`,
        originalResponse: response,
      };
    }
  }
  
  return null;
}

/**
 * Regra 7: Detecta afirmações sobre status de boletos SEM ter chamado consultar_boleto_cliente
 * v1.1 - CRÍTICA: Casos reais de alucinação (Lohaine, Carla)
 * 
 * PROBLEMA: IA disse "não há boletos pendentes" ou "está em dia" sem chamar a API
 */
function validateBoletoStatusClaims(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls, assistantType } = ctx;
  
  // Só aplica para assistentes que lidam com boletos
  if (assistantType && !['financeiro', 'recepcao', 'recepcionista'].includes(assistantType)) {
    return null;
  }
  
  // Padrões que indicam AFIRMAÇÃO sobre status de pagamento/boleto
  const BOLETO_STATUS_CLAIMS = [
    // Afirmações de que está em dia
    /você está em dia/i,
    /sua conta está em dia/i,
    /está tudo (em dia|regularizado|ok|certo)/i,
    /situação (está )?regularizada/i,
    /não há (nenhuma? )?(pendência|débito|boleto)/i,
    /sem (pendência|débito|boleto)/i,
    
    // Afirmações de que não encontrou boletos
    /não (há|existe|tem|encontrei|localizei) boleto/i,
    /não (há|existe|tem|encontrei) (nenhum |nenhuma )?(fatura|conta|cobrança)/i,
    /verifiquei (aqui |e )?não (há|tem|encontrei)/i,
    /consultei e não (há|tem|encontrei)/i,
    
    // Afirmações sobre pagamento identificado (sem ter verificado)
    /pagamento (já )?(foi )?(identificado|confirmado|processado)/i,
    /seu pagamento (já )?consta/i,
    
    // Confirmações de "tudo certo" com cobrança
    /não há (nada|nenhuma cobrança) (pendente|em aberto)/i,
  ];
  
  // Frases que LEGITIMAM a afirmação (mencionam resultado da API)
  const LEGITIMATE_RESULT_INDICATORS = [
    /boleto.{0,30}(vencimento|valor|R\$)/i,
    /fatura.{0,30}(vencimento|valor|R\$)/i,
    /código de barras/i,
    /pix copia e cola/i,
    /link.{0,20}boleto/i,
    /R\$\s*\d+[.,]\d{2}/i, // Valor monetário específico
  ];
  
  // Verificar se chamou função de consulta de boleto
  const BOLETO_FUNCTIONS = [
    'consultar_boleto_cliente',
    'consultar_boleto',
    'consultar_faturas',
    'verificar_pagamento',
  ];
  
  const hasBoletoFunction = functionCalls?.some(fc => 
    BOLETO_FUNCTIONS.includes(fc.name)
  );
  
  if (hasBoletoFunction) {
    return null; // OK - chamou função de boleto
  }
  
  // Verificar se resposta tem dados reais de boleto (resultado de consulta anterior)
  const hasLegitimateResult = LEGITIMATE_RESULT_INDICATORS.some(p => p.test(response));
  if (hasLegitimateResult) {
    return null; // OK - resposta contém dados reais
  }
  
  // Verificar se está fazendo afirmação sobre status sem ter consultado
  for (const pattern of BOLETO_STATUS_CLAIMS) {
    if (pattern.test(response)) {
      const match = response.match(pattern)?.[0] || '';
      
      return {
        valid: false,
        severity: 'block',
        rule: 'boleto_status_without_api',
        message: `🚨 ALUCINAÇÃO: Afirmou status de boleto sem chamar consultar_boleto_cliente(): "${match}"`,
        originalResponse: response,
      };
    }
  }
  
  return null;
}

/**
 * Regra 8: Detecta afirmações sobre endereço não encontrado SEM ter consultado pontos
 * v1.1 - Caso real: Carla (cliente com 1 ponto, IA disse "não encontrei endereço")
 */
function validateAddressNotFoundClaims(ctx: ValidationContext): ValidationResult | null {
  const { response, functionCalls } = ctx;
  
  // Padrões que indicam "não encontrei endereço"
  const ADDRESS_NOT_FOUND_CLAIMS = [
    /não (encontrei|localizei|identifiquei).{0,30}endereço/i,
    /não (encontrei|localizei).{0,30}ponto/i,
    /endereço.{0,20}não (encontrado|localizado|identificado)/i,
    /não (há|existe|tem).{0,20}(esse|este) endereço/i,
    /não (consigo|consegui) (identificar|localizar).{0,20}endereço/i,
  ];
  
  // Funções que consultam pontos/endereços
  const ADDRESS_FUNCTIONS = [
    'consultar_boleto_cliente', // Retorna hasMultiplePoints
    'consultar_cliente',
    'check_pppoe_status',
    'buscar_pontos_instalacao',
  ];
  
  const hasAddressFunction = functionCalls?.some(fc => 
    ADDRESS_FUNCTIONS.includes(fc.name)
  );
  
  if (hasAddressFunction) {
    return null; // OK - consultou pontos
  }
  
  // Verificar se está fazendo afirmação sobre endereço não encontrado
  for (const pattern of ADDRESS_NOT_FOUND_CLAIMS) {
    if (pattern.test(response)) {
      const match = response.match(pattern)?.[0] || '';
      
      return {
        valid: false,
        severity: 'block',
        rule: 'address_not_found_without_api',
        message: `🚨 ALUCINAÇÃO: Afirmou "não encontrei endereço" sem consultar pontos: "${match}"`,
        originalResponse: response,
      };
    }
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
    validateAppointmentConfirmations, // v1.0 - Anti-alucinação para agendamentos
    validateBoletoStatusClaims,       // v1.1 - Anti-alucinação para boletos
    validateAddressNotFoundClaims,    // v1.1 - Anti-alucinação para endereços
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
