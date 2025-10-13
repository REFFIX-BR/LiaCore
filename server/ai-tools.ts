/**
 * AI Assistant Tools - Funções internas para function calling
 * 
 * Estas funções são chamadas INTERNAMENTE pelo servidor quando
 * o assistente OpenAI solicita a execução de uma tool.
 * NÃO são expostas como endpoints HTTP públicos.
 * 
 * IMPORTANTE - Limitações de segurança atuais:
 * - O schema de 'conversations' NÃO possui campo 'clientDocument' (CPF/CNPJ)
 * - Validação de documento do cliente depende desse campo ser implementado
 * - Por ora, apenas validamos que a conversationId existe no banco de dados
 * 
 * TODO - Melhorias de segurança futuras:
 * 1. Adicionar campo 'clientDocument' em conversations schema
 * 2. Capturar e armazenar CPF/CNPJ do cliente durante a conversa
 * 3. Validar que documento consultado pertence ao cliente da conversa
 * 4. Implementar audit trail de consultas sensíveis
 */

import type { IStorage } from "./storage";

interface ConsultaBoletoResult {
  NOME?: string;
  CIDADE?: string;
  BAIRRO?: string;
  RUA?: string;
  DATA_VENCIMENTO: string;
  VALOR_TOTAL: string;
  PIX_TXT: string;
  CODIGO_BARRA_TRANSACAO: string;
  link_carne_completo: string;
  STATUS: string;
}

interface StatusConexaoResult {
  COD_CLIENTE: string;
  nomeCliente: string;
  CPF: string;
  plano: string;
  velocidadeContratada: string;
  LOGIN: string;
  statusIP: string;
  statusPPPoE: string;
  conectadoDesde: string;
  minutosConectado: number;
  ipv4: string;
  ENDERECO: string;
  BAIRRO: string;
  CIDADE: string;
  COMPLEMENTO: string;
  CTO: string;
  PON: string;
  OLT: string;
  STATUS_TIPO: string;
  SERIAL: string;
  os_aberta: string;
  onu_run_state: string;
  onu_last_down_cause: string;
  massiva: boolean;
}

interface DesbloqueioResult {
  data: Array<{
    resposta: Array<{
      obs: string;
    }>;
    status: Array<{
      status: string;
    }>;
  }>;
}

interface AbrirTicketResult {
  data: Array<{
    resposta: Array<{
      protocolo: string;
    }>;
  }>;
}

/**
 * Consulta boletos do cliente no sistema externo
 * @param documento CPF ou CNPJ do cliente
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Array de boletos encontrados
 */
export async function consultaBoletoCliente(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<ConsultaBoletoResult[]> {
  const startTime = Date.now();
  const maxRetries = 3;
  let lastError: Error | null = null;

  try {
    // Validação de segurança OBRIGATÓRIA: contexto da conversa deve ser fornecido
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para consulta de boletos");
    }

    // Validação: conversa deve existir no banco de dados
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // CRÍTICO: Validação de documento usando valor do BANCO DE DADOS (fonte confiável)
    // Não confiar em parâmetros do caller - usar apenas dados persistidos
    if (conversation.clientDocument && conversation.clientDocument !== documento) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta de documento diferente do cliente da conversa`);
      throw new Error("Não é permitido consultar documentos de outros clientes");
    }

    // Log sem dados sensíveis - apenas operação
    console.log(`📋 [AI Tool] Consultando boletos (conversação: ${conversationContext.conversationId}) - tentativas máximas: ${maxRetries}`);

    // Retry com backoff exponencial
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [AI Tool] Tentativa ${attempt}/${maxRetries} de consulta à API de boletos`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_boleto", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ documento }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const boletos = await response.json() as ConsultaBoletoResult[];
        const duration = Date.now() - startTime;
        
        console.log(`✅ [AI Tool] Consulta concluída com sucesso - ${boletos?.length || 0} boletos encontrados em ${duration}ms (tentativa ${attempt}/${maxRetries})`);

        return boletos;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const duration = Date.now() - startTime;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Backoff exponencial: 1s, 2s, 4s (max 5s)
          console.warn(`⚠️  [AI Tool] Tentativa ${attempt} falhou após ${duration}ms: ${lastError.message}. Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ [AI Tool] Todas as ${maxRetries} tentativas falharam após ${duration}ms`);
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError || new Error("Falha ao consultar boletos após múltiplas tentativas");
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [AI Tool] Erro ao consultar boletos após ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Consulta status de conexão PPPoE do cliente
 * @param documento CPF ou CNPJ do cliente
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Array com status de conexão(ões) do cliente
 */
export async function consultaStatusConexao(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<StatusConexaoResult[]> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para consulta de conexão");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // Validação de documento
    if (conversation.clientDocument && conversation.clientDocument !== documento) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta de documento diferente do cliente`);
      throw new Error("Não é permitido consultar documentos de outros clientes");
    }

    console.log(`🔌 [AI Tool] Consultando status de conexão (conversação: ${conversationContext.conversationId})`);

    const response = await fetch("https://webhook.trtelecom.net/webhook/check_pppoe_status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documento }),
    });

    if (!response.ok) {
      console.error(`❌ [AI Tool] Erro na consulta de conexão: ${response.status} ${response.statusText}`);
      throw new Error(`Erro ao consultar status de conexão: ${response.statusText}`);
    }

    const conexoes = await response.json() as StatusConexaoResult[];
    console.log(`✅ [AI Tool] Consulta concluída - ${conexoes?.length || 0} conexão(ões) encontrada(s)`);

    return conexoes;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao consultar status de conexão:", error);
    throw error;
  }
}

/**
 * Solicita desbloqueio/liberação em confiança da conexão do cliente
 * @param documento CPF ou CNPJ do cliente
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Resultado da solicitação de desbloqueio
 */
export async function solicitarDesbloqueio(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<DesbloqueioResult> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de desbloqueio sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para desbloqueio");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de desbloqueio com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // CRÍTICO: clientDocument deve existir OBRIGATORIAMENTE
    if (!conversation.clientDocument) {
      console.error(`❌ [AI Tool Security] Tentativa de desbloqueio sem documento do cliente armazenado`);
      throw new Error("Para solicitar desbloqueio, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento.");
    }

    // CRÍTICO: Validação de documento usando valor do BANCO DE DADOS (fonte confiável)
    if (conversation.clientDocument !== documento) {
      console.error(`❌ [AI Tool Security] Tentativa de desbloqueio de documento diferente do cliente da conversa`);
      throw new Error("Não é permitido desbloquear conexão de outros clientes");
    }

    console.log(`🔓 [AI Tool] Solicitando desbloqueio (conversação: ${conversationContext.conversationId})`);

    const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_desbloqueio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documento }),
    });

    if (!response.ok) {
      console.error(`❌ [AI Tool] Erro na solicitação de desbloqueio: ${response.status} ${response.statusText}`);
      throw new Error(`Erro ao solicitar desbloqueio: ${response.statusText}`);
    }

    const resultado = await response.json() as DesbloqueioResult[];
    
    // A API retorna um array, pegamos o primeiro item
    const desbloqueio = resultado[0];
    
    const status = desbloqueio?.data?.[0]?.status?.[0]?.status || 'N';
    const obs = desbloqueio?.data?.[0]?.resposta?.[0]?.obs || 'Erro ao processar desbloqueio';
    
    console.log(`✅ [AI Tool] Desbloqueio processado - Status: ${status} - Obs: ${obs}`);

    return desbloqueio;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao solicitar desbloqueio:", error);
    throw error;
  }
}

// Mapeamento válido de setor -> motivos permitidos
const SETOR_MOTIVO_MAP: Record<string, string[]> = {
  "ADMINISTRAÇÃO": [
    "INFORMAÇÃO", "RECLAMAÇÃO", "CONTRATO", "PONTO ELÉTRICO", "NOTA FISCAL", "PERMUTA"
  ],
  "SUPORTE": [
    "SEM CONEXÃO", "SEM INTERNET", "LENTIDÃO", "CABO DESCONECTADO", "TROCA DE EQUIPAMENTO",
    "PROBLEMA EMAIL", "TROCA MAC", "TROCA LOGIN", "TROCA SENHA", "INTERMITÊNCIA",
    "INFORMAÇÃO LOGIN/SENHA", "RECONFIGURAÇÃO PPPOE", "REPARO NA REDE", "INFORMAÇÃO", "TELEFONIA"
  ],
  "FINANCEIRO": [
    "2.VIA BOLETO", "MUDANÇA ENDEREÇO DE COBRANÇA", "SOLICITAÇÃO DE DESCONTO",
    "INFORMAR PAGAMENTO", "BLOQUEIO", "SEMIBLOQUEIO", "PROMOÇÃO BANDA EM DOBRO",
    "PAGAMENTO", "INFORMAÇÃO", "DESBLOQUEIO", "MUDANÇA DE VENCIMENTO"
  ],
  "COMERCIAL": [
    "PEDIDO DE INSTALAÇÃO", "MUDANÇA DE PLANO", "MUDANÇA DE ENDEREÇO", "EXTENSÃO DE CABO",
    "INFORMAÇÃO PLANOS/INSTALAÇÃO", "PEDIDO VIABILIDADE", "PONTO ADICIONAL",
    "REATIVAÇÃO", "UPGRADE", "MUDANÇA DE CÔMODO", "VENDA REALIZADA"
  ],
  "RECEPÇÃO": [
    "ATENDIMENTO", "RECLAMAÇÃO", "CANCELAMENTO", "SUSPENSÃO", "MUDANÇA TITULARIDADE", "2.VIA BOLETO"
  ],
  "COBRANÇA": [
    "RENEGOCIAÇÃO / ACORDO", "RECOLHIMENTO DE EQUIPAMENTOS", "COBRANÇA INADIMPLÊNCIA"
  ],
  "TÉCNICO": [
    "ATENDIMENTO", "RETIRADA DE MATERIAL", "RECONFIGURAÇÃO/TROCA CONECTOR", "LINK LOSS", "LENTIDÃO", "POTÊNCIA ALTA"
  ],
  "OUVIDORIA": [
    "ATENDIMENTO", "RECLAMAÇÃO"
  ],
  "LOCAÇÃO": [
    "INSTALAÇAO DE CAMERA", "MANUNTENÇAO DE CAMERA", "INSTALAÇAO TVBOX", "REPARO TVBOX"
  ]
};

/**
 * Valida se a combinação setor/motivo é válida
 */
function validarSetorMotivo(setor: string, motivo: string): { valido: boolean; erro?: string } {
  const setorUpper = setor.toUpperCase();
  const motivoUpper = motivo.toUpperCase();
  
  // Verifica se setor existe
  if (!SETOR_MOTIVO_MAP[setorUpper]) {
    const setoresValidos = Object.keys(SETOR_MOTIVO_MAP).join(", ");
    return {
      valido: false,
      erro: `Setor "${setor}" não é válido. Setores válidos: ${setoresValidos}`
    };
  }
  
  // Verifica se motivo é compatível com o setor
  const motivosValidos = SETOR_MOTIVO_MAP[setorUpper];
  if (!motivosValidos.includes(motivoUpper)) {
    return {
      valido: false,
      erro: `Motivo "${motivo}" não é compatível com setor "${setor}". Motivos válidos para ${setor}: ${motivosValidos.join(", ")}`
    };
  }
  
  return { valido: true };
}

/**
 * Abre ticket no CRM externo ao finalizar atendimento
 * @param resumo Resumo breve do atendimento e resolução
 * @param setor Setor responsável pelo atendimento
 * @param motivo Motivo do atendimento (deve ser compatível com o setor)
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Protocolo do ticket criado
 */
export async function abrirTicketCRM(
  resumo: string,
  setor: string,
  motivo: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<AbrirTicketResult> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de abrir ticket sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para abertura de ticket");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de abrir ticket com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // CRÍTICO: clientDocument deve existir OBRIGATORIAMENTE
    if (!conversation.clientDocument) {
      console.error(`❌ [AI Tool Security] Tentativa de abrir ticket sem documento do cliente armazenado`);
      throw new Error("Não é possível abrir ticket sem o CPF ou CNPJ do cliente. Por favor, solicite o documento ao cliente primeiro usando: 'Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ.'");
    }

    // Validação de setor/motivo ANTES de enviar ao webhook
    const validacao = validarSetorMotivo(setor, motivo);
    if (!validacao.valido) {
      console.error(`❌ [AI Tool] Combinação setor/motivo inválida: ${validacao.erro}`);
      throw new Error(validacao.erro);
    }

    console.log(`🎫 [AI Tool] Abrindo ticket no CRM (conversação: ${conversationContext.conversationId}, setor: ${setor}, motivo: ${motivo})`);

    const response = await fetch("https://webhook.trtelecom.net/webhook/abrir_ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documento: conversation.clientDocument,
        resumo: resumo,
        setor: setor.toUpperCase(),
        motivo: motivo.toUpperCase(),
        finalizar: "S"
      }),
    });

    if (!response.ok) {
      console.error(`❌ [AI Tool] Erro na abertura de ticket: ${response.status} ${response.statusText}`);
      throw new Error(`Erro ao abrir ticket no CRM: ${response.statusText}`);
    }

    const resultado = await response.json() as AbrirTicketResult[];
    
    // A API retorna um array, pegamos o primeiro item
    const ticket = resultado[0];
    const protocolo = ticket?.data?.[0]?.resposta?.[0]?.protocolo || 'ERRO';
    
    console.log(`✅ [AI Tool] Ticket criado com sucesso - Protocolo: ${protocolo}`);

    return ticket;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao abrir ticket no CRM:", error);
    throw error;
  }
}

/**
 * Roteia conversa para assistente especializado (NÃO marca como transferido para humano)
 * @param departamento Nome do departamento/assistente especializado
 * @param motivo Motivo do roteamento
 * @returns Confirmação do roteamento
 */
export async function rotearParaAssistenteEspecializado(
  departamento: string,
  motivo: string
): Promise<{ roteado: boolean; assistente: string; motivo: string }> {
  console.log(`🎭 [AI Tool] Roteamento interno: ${departamento} - Motivo: ${motivo}`);
  
  // Retorna estrutura que será processada pelo handler
  return {
    roteado: true,
    assistente: departamento,
    motivo: motivo
  };
}

/**
 * Executa uma tool do assistente OpenAI
 * @param toolName Nome da tool a ser executada
 * @param args Argumentos da tool
 * @param context Contexto OBRIGATÓRIO de segurança da conversa (apenas conversationId)
 * @param storage Interface de storage para validação
 * @returns Resultado da execução
 */
export async function executeAssistantTool(
  toolName: string, 
  args: any,
  context: { conversationId: string },
  storage: IStorage
): Promise<any> {
  // Validação de segurança: contexto é obrigatório
  if (!context || !context.conversationId) {
    console.error(`❌ [AI Tool Security] Tentativa de executar tool sem contexto de segurança`);
    throw new Error("Contexto de segurança é obrigatório para executar tools");
  }

  console.log(`🔧 [AI Tool Executor] Executando tool: ${toolName} (conv: ${context.conversationId})`);

  switch (toolName) {
    case 'consulta_boleto_cliente':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para consulta_boleto_cliente");
      }
      return await consultaBoletoCliente(args.documento, context, storage);

    case 'rotear_para_assistente':
      if (!args.departamento || !args.motivo) {
        throw new Error("Parâmetros 'departamento' e 'motivo' são obrigatórios para rotear_para_assistente");
      }
      return await rotearParaAssistenteEspecializado(args.departamento, args.motivo);

    case 'verificar_conexao':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para verificar_conexao");
      }
      return await consultaStatusConexao(args.documento, context, storage);

    case 'solicitar_desbloqueio':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para solicitar_desbloqueio");
      }
      return await solicitarDesbloqueio(args.documento, context, storage);

    case 'abrir_ticket_crm':
      if (!args.resumo || !args.setor || !args.motivo) {
        throw new Error("Parâmetros 'resumo', 'setor' e 'motivo' são obrigatórios para abrir_ticket_crm");
      }
      return await abrirTicketCRM(args.resumo, args.setor, args.motivo, context, storage);

    default:
      throw new Error(`Tool não implementada: ${toolName}`);
  }
}
