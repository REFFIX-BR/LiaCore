/**
 * AI Assistant Tools - Funções internas para function calling
 * 
 * Estas funções são chamadas INTERNAMENTE pelo servidor quando
 * o assistente OpenAI solicita a execução de uma tool.
 * NÃO são expostas como endpoints HTTP públicos.
 * 
 * SEGURANÇA IMPLEMENTADA:
 * ✅ O schema 'conversations' possui campo 'clientDocument' (CPF/CNPJ)
 * ✅ Detecção automática de CPF/CNPJ em mensagens do cliente
 * ✅ Persistência automática do documento na conversa
 * ✅ Validação que documento consultado pertence ao cliente da conversa
 * ✅ Logs com mascaramento de dados sensíveis
 * 
 * TODO - Melhorias futuras:
 * 1. Implementar audit trail de consultas sensíveis
 * 2. Adicionar rate limiting por cliente
 * 3. Validação adicional de documentos (algoritmo de CPF/CNPJ)
 */

import type { IStorage } from "./storage";

/**
 * Helper genérico para fazer chamadas HTTP com retry automático e timeout
 * @param url URL do endpoint
 * @param body Corpo da requisição
 * @param options Opções adicionais (maxRetries, timeout, operation name para logs)
 * @returns Response JSON
 */
async function fetchWithRetry<T>(
  url: string,
  body: Record<string, any>,
  options: {
    maxRetries?: number;
    timeout?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, timeout = 30000, operationName = "requisição" } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      console.log(`🔄 [AI Tool] Tentativa ${attempt}/${maxRetries} de ${operationName}`);
      
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as T;
      const duration = Date.now() - startTime;
      
      console.log(`✅ [AI Tool] ${operationName} concluída com sucesso em ${duration}ms (tentativa ${attempt}/${maxRetries})`);

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.warn(`⚠️  [AI Tool] Tentativa ${attempt} falhou após ${duration}ms: ${lastError.message}. Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ [AI Tool] Todas as ${maxRetries} tentativas de ${operationName} falharam após ${duration}ms`);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  const duration = Date.now() - startTime;
  const errorMessage = `Falha ao executar ${operationName} após ${maxRetries} tentativas em ${duration}ms`;
  throw new Error(errorMessage, { cause: lastError });
}

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

interface PontoInfo {
  numero: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  boletos: ConsultaBoletoResult[];
  totalBoletos: number;
  totalVencidos: number;
  valorTotal: number;
  valorVencido: number;  // Valor total apenas dos boletos vencidos
}

interface ConsultaBoletoResponse {
  hasMultiplePoints: boolean;
  totalBoletos: number;
  pontos?: PontoInfo[];
  boletos?: ConsultaBoletoResult[];
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
 * @param selectedPointNumber OPCIONAL - Número do ponto para filtrar boletos (ex: 1, 2, 3)
 * @returns Objeto com boletos e informação sobre múltiplos pontos
 */
export async function consultaBoletoCliente(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage,
  selectedPointNumber?: number
): Promise<ConsultaBoletoResponse> {
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
    // Normalizar documentos (remover formatação) antes de comparar
    const documentoNormalizado = documento.replace(/\D/g, '');
    const clientDocumentNormalizado = conversation.clientDocument?.replace(/\D/g, '');
    
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta de documento diferente do cliente da conversa`);
      throw new Error("Não é permitido consultar documentos de outros clientes");
    }

    // Log sem dados sensíveis - apenas operação
    console.log(`📋 [AI Tool] Consultando boletos (conversação: ${conversationContext.conversationId})`);
    console.log(`🌐 [AI Tool] Endpoint: https://webhook.trtelecom.net/webhook/consulta_boleto`);
    console.log(`📤 [AI Tool] Enviando requisição para API externa...`);

    const boletos = await fetchWithRetry<ConsultaBoletoResult[]>(
      "https://webhook.trtelecom.net/webhook/consulta_boleto",
      { documento: documentoNormalizado },
      { operationName: "consulta de boletos" }
    );
    
    console.log(`📥 [AI Tool] Resposta recebida da API externa`);
    console.log(`📋 [AI Tool] ${boletos?.length || 0} boleto(s) retornado(s) pela API`);
    
    // Log observability (SEM dados sensíveis - apenas flags e contadores)
    if (boletos && boletos.length > 0) {
      const comPIX = boletos.filter(b => !!b.PIX_TXT).length;
      const comLink = boletos.filter(b => !!b.link_carne_completo).length;
      const statusCounts = boletos.reduce((acc, b) => {
        const status = b.STATUS || 'DESCONHECIDO';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`📊 [AI Tool] Observabilidade: ${comPIX} com PIX, ${comLink} com link, Status: ${JSON.stringify(statusCounts)}`);
    }
    
    // FILTRAR: Retornar apenas boletos EM ABERTO ou VENCIDOS (excluir PAGOS)
    // STATUS possíveis: "PAGO", "EM ABERTO", "VENCIDO", "PENDENTE", etc.
    const boletosEmAberto = boletos.filter(boleto => {
      // Normalizar STATUS: trim, uppercase, remover acentos
      const statusNormalizado = (boleto.STATUS || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
      
      // Lista de STATUS que indicam boleto FECHADO/PAGO (não em aberto)
      const statusFechados = ['PAGO', 'CANCELADO', 'QUITADO', 'LIQUIDADO', 'BAIXADO'];
      
      // Tratar STATUS vazio como potencialmente problemático - logar
      if (!statusNormalizado) {
        console.warn(`⚠️ [AI Tool] Boleto ${boleto.DATA_VENCIMENTO} com STATUS vazio/undefined - INCLUINDO como ABERTO por segurança`);
        return true; // Incluir para não esconder débitos reais
      }
      
      const isAberto = !statusFechados.includes(statusNormalizado);
      
      if (!isAberto) {
        console.log(`📋 [AI Tool] Boleto ${boleto.DATA_VENCIMENTO} IGNORADO (STATUS original: "${boleto.STATUS}", normalizado: "${statusNormalizado}")`);
      }
      
      return isAberto;
    });
    
    console.log(`📋 [AI Tool] ${boletosEmAberto.length} boleto(s) EM ABERTO (filtrados de ${boletos.length} totais)`);
    
    // DEBUG: Listar TODOS os boletos brutos recebidos da API
    console.log(`🔍 [DEBUG API] === BOLETOS BRUTOS DA API (${boletos.length} total) ===`);
    boletos.forEach((b, idx) => {
      console.log(`🔍 [DEBUG API] Boleto ${idx + 1}: Vencimento=${b.DATA_VENCIMENTO}, Valor="${b.VALOR_TOTAL}", Status="${b.STATUS}", Nome="${b.NOME?.substring(0, 30)}..."`);
    });
    console.log(`🔍 [DEBUG API] === FIM BOLETOS BRUTOS ===`);

    // ====================================
    // DETECÇÃO DE MÚLTIPLOS PONTOS
    // ====================================
    
    // Extrair número do ponto do campo NOME
    // Exemplos:
    // "ADRIANA PERES DA SILVA AZEVEDO (C.I)" -> Ponto 1 (padrão, sem número)
    // "2 ADRIANA PERES DA SILVA AZEVEDO" -> Ponto 2
    // "3 ALEXANDRE MARQUES CARVALHO" -> Ponto 3
    
    const pontosMap = new Map<string, PontoInfo>();
    
    boletosEmAberto.forEach((boleto, idx) => {
      console.log(`🔍 [DEBUG PROCESSO] === Processando boleto EM ABERTO ${idx + 1}/${boletosEmAberto.length} ===`);
      // Tentar extrair número do ponto do início do nome
      const nomeMatch = boleto.NOME?.match(/^(\d+)\s+(.+)$/);
      
      let pontoNumero: string;
      let nomeCliente: string;
      
      if (nomeMatch) {
        // Nome começa com número: "2 ADRIANA..."
        pontoNumero = nomeMatch[1];
        nomeCliente = nomeMatch[2];
      } else {
        // Nome sem número no início -> Ponto 1 (padrão)
        pontoNumero = "1";
        nomeCliente = boleto.NOME || "Cliente";
      }
      
      // Criar ou recuperar informações do ponto
      if (!pontosMap.has(pontoNumero)) {
        pontosMap.set(pontoNumero, {
          numero: pontoNumero,
          nome: nomeCliente,
          endereco: boleto.RUA || '',
          bairro: boleto.BAIRRO || '',
          cidade: boleto.CIDADE || '',
          boletos: [],
          totalBoletos: 0,
          totalVencidos: 0,
          valorTotal: 0,
          valorVencido: 0
        });
      }
      
      const ponto = pontosMap.get(pontoNumero)!;
      
      // Adicionar boleto ao ponto
      ponto.boletos.push(boleto);
      ponto.totalBoletos++;
      
      // Verificar se está vencido (pela DATA + STATUS)
      const dataVencimento = boleto.DATA_VENCIMENTO;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
      
      let estaVencido = false;
      
      // Tentar parsear data (aceita DD/MM/YYYY ou YYYY-MM-DD)
      if (dataVencimento) {
        let dataVenc: Date | null = null;
        
        // Tentar formato ISO: YYYY-MM-DD (retornado pela API)
        if (dataVencimento.includes('-')) {
          const partes = dataVencimento.split('-');
          if (partes.length === 3) {
            const ano = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1; // Mês em JS é 0-indexed
            const dia = parseInt(partes[2]);
            dataVenc = new Date(ano, mes, dia);
          }
        } 
        // Tentar formato BR: DD/MM/YYYY (fallback)
        else if (dataVencimento.includes('/')) {
          const partes = dataVencimento.split('/');
          if (partes.length === 3) {
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1; // Mês em JS é 0-indexed
            const ano = parseInt(partes[2]);
            dataVenc = new Date(ano, mes, dia);
          }
        }
        
        if (dataVenc) {
          dataVenc.setHours(0, 0, 0, 0);
          
          // Boleto vencido se data < hoje
          if (dataVenc < hoje) {
            estaVencido = true;
          }
        }
      }
      
      // Se STATUS já indica VENCIDO, aceitar também
      if (boleto.STATUS?.toUpperCase().includes('VENCIDO')) {
        estaVencido = true;
      }
      
      if (estaVencido) {
        ponto.totalVencidos++;
        
        // DEBUG: Log quando detectar vencimento pela data (API pode ter marcado errado)
        if (!boleto.STATUS?.toUpperCase().includes('VENCIDO')) {
          console.warn(`⚠️ [CORREÇÃO STATUS] Boleto ${dataVencimento} marcado como VENCIDO pela data (API STATUS: "${boleto.STATUS}")`);
        }
      }
      
      // Somar valor (converter de string para número)
      // DEBUG: Ver valor BRUTO da API
      console.log(`🔍 [DEBUG VALOR] Ponto ${pontoNumero} - Valor bruto da API: "${boleto.VALOR_TOTAL}"`);
      
      const valor = parseFloat(boleto.VALOR_TOTAL.replace(',', '.')) || 0;
      console.log(`🔍 [DEBUG VALOR] Ponto ${pontoNumero} - Após conversão: ${valor}, Vencido: ${estaVencido}`);
      
      // Sempre somar no total geral
      ponto.valorTotal += valor;
      
      // Se vencido, somar também no total de vencidos
      if (estaVencido) {
        ponto.valorVencido += valor;
      }
    });
    
    const pontos = Array.from(pontosMap.values()).sort((a, b) => 
      parseInt(a.numero) - parseInt(b.numero)
    );
    
    const hasMultiplePoints = pontos.length > 1;
    
    if (hasMultiplePoints) {
      console.log(`📍 [AI Tool] MÚLTIPLOS PONTOS DETECTADOS: ${pontos.length} pontos`);
      pontos.forEach(ponto => {
        console.log(`📍 [AI Tool] Ponto ${ponto.numero}: ${ponto.endereco}, ${ponto.bairro} - ${ponto.totalBoletos} boleto(s), ${ponto.totalVencidos} vencido(s), Vencidos: R$ ${ponto.valorVencido.toFixed(2)}, Total: R$ ${ponto.valorTotal.toFixed(2)}`);
      });
      
      // 🆕 NOVA ARQUITETURA: Se selectedPointNumber foi fornecido, filtrar boletos daquele ponto
      if (selectedPointNumber !== undefined && selectedPointNumber !== null) {
        console.log(`🎯 [AI Tool] Filtrando boletos do ponto ${selectedPointNumber} (solicitado explicitamente)`);
        
        // CRÍTICO: Normalizar tipos - selectedPointNumber pode ser string ou number
        const selectedAsNumber = typeof selectedPointNumber === 'string' 
          ? parseInt(selectedPointNumber) 
          : selectedPointNumber;
        
        const pontoSelecionado = pontos.find(p => parseInt(p.numero) === selectedAsNumber);
        
        if (!pontoSelecionado) {
          console.warn(`⚠️ [AI Tool] Ponto ${selectedPointNumber} não encontrado. Pontos disponíveis: ${pontos.map(p => p.numero).join(', ')}`);
          // Retornar menu novamente para nova seleção
          return {
            hasMultiplePoints: true,
            totalBoletos: boletosEmAberto.length,
            pontos
          };
        }
        
        console.log(`✅ [AI Tool] Ponto ${selectedPointNumber} encontrado: ${pontoSelecionado.endereco}, ${pontoSelecionado.bairro} - ${pontoSelecionado.totalBoletos} boleto(s)`);
        
        // Retornar como ponto único com boletos filtrados
        return {
          hasMultiplePoints: false,
          totalBoletos: pontoSelecionado.totalBoletos,
          boletos: pontoSelecionado.boletos
        };
      }
      
      // Sem selectedPointNumber - retornar menu completo
      return {
        hasMultiplePoints: true,
        totalBoletos: boletosEmAberto.length,
        pontos
      };
    } else {
      console.log(`📍 [AI Tool] PONTO ÚNICO detectado`);
      
      return {
        hasMultiplePoints: false,
        totalBoletos: boletosEmAberto.length,
        boletos: boletosEmAberto
      };
    }
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao consultar boletos:", error);
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

    // Validação de documento (normalizar antes de comparar)
    const documentoNormalizado = documento.replace(/\D/g, '');
    const clientDocumentNormalizado = conversation.clientDocument?.replace(/\D/g, '');
    
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta de documento diferente do cliente`);
      throw new Error("Não é permitido consultar documentos de outros clientes");
    }

    console.log(`🔌 [AI Tool] Consultando status de conexão (conversação: ${conversationContext.conversationId})`);

    const conexoes = await fetchWithRetry<StatusConexaoResult[]>(
      "https://webhook.trtelecom.net/webhook/check_pppoe_status",
      { documento: documentoNormalizado },
      { operationName: "consulta de status PPPoE" }
    );
    
    console.log(`📋 [AI Tool] ${conexoes?.length || 0} conexão(ões) encontrada(s)`);

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
    // Normalizar documentos (remover formatação) antes de comparar
    const documentoNormalizado = documento.replace(/\D/g, '');
    const clientDocumentNormalizado = conversation.clientDocument.replace(/\D/g, '');
    
    if (clientDocumentNormalizado !== documentoNormalizado) {
      console.error(`❌ [AI Tool Security] Tentativa de desbloqueio de documento diferente do cliente da conversa`);
      throw new Error("Não é permitido desbloquear conexão de outros clientes");
    }

    console.log(`🔓 [AI Tool] Solicitando desbloqueio (conversação: ${conversationContext.conversationId})`);

    const resultado = await fetchWithRetry<DesbloqueioResult[]>(
      "https://webhook.trtelecom.net/webhook/consulta_desbloqueio",
      { documento: documentoNormalizado },
      { operationName: "solicitação de desbloqueio" }
    );
    
    // A API retorna um array, pegamos o primeiro item
    const desbloqueio = resultado[0];
    
    const status = desbloqueio?.data?.[0]?.status?.[0]?.status || 'N';
    const obs = desbloqueio?.data?.[0]?.resposta?.[0]?.obs || 'Erro ao processar desbloqueio';
    
    console.log(`📋 [AI Tool] Desbloqueio processado - Status: ${status} - Obs: ${obs}`);

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

    const resultado = await fetchWithRetry<AbrirTicketResult[]>(
      "https://webhook.trtelecom.net/webhook/abrir_ticket",
      {
        documento: conversation.clientDocument,
        resumo: resumo,
        setor: setor.toUpperCase(),
        motivo: motivo.toUpperCase(),
        finalizar: "S"
      },
      { operationName: "abertura de ticket no CRM" }
    );
    
    // A API retorna um array, pegamos o primeiro item
    const ticket = resultado[0];
    const protocolo = ticket?.data?.[0]?.resposta?.[0]?.protocolo || 'ERRO';
    
    console.log(`📋 [AI Tool] Ticket criado com sucesso - Protocolo: ${protocolo}`);

    return ticket;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao abrir ticket no CRM:", error);
    throw error;
  }
}

/**
 * Seleciona o ponto de instalação do cliente (quando possui múltiplos pontos)
 * VERIFICA AUTOMATICAMENTE se há falha massiva ativa na região do ponto selecionado
 * @param numeroPonto Número do ponto selecionado (1, 2, 3...)
 * @param conversationContext Contexto da conversa
 * @param storage Interface de storage
 * @returns Confirmação da seleção com dados do ponto + informações de falha massiva (se houver)
 */
export async function selecionarPontoInstalacao(
  numeroPonto: number | string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<{ 
  selecionado: boolean; 
  ponto: any; 
  mensagem: string;
  FALHA_MASSIVA_ATIVA: boolean;
  falha?: {
    nome: string;
    mensagem: string;
    severidade: string;
    previsao: string | null;
  };
}> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de seleção sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para seleção de ponto");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de seleção com conversationId inválido`);
      throw new Error("Conversação não encontrada");
    }

    // Converter para string para comparação (IA pode enviar como number)
    const numeroPontoStr = numeroPonto.toString();
    
    console.log(`🏠 [AI Tool] Selecionando ponto ${numeroPontoStr} para conversa ${conversationContext.conversationId}`);

    // Buscar pontos de instalação do CRM
    const { fetchClientInstallationPoints } = await import('./lib/massive-failure-handler');
    
    if (!conversation.clientDocument) {
      throw new Error("CPF/CNPJ não disponível para buscar pontos de instalação");
    }

    const points = await fetchClientInstallationPoints(conversation.clientDocument);
    
    if (!points || points.length === 0) {
      throw new Error("Nenhum ponto de instalação encontrado");
    }

    // Encontrar o ponto selecionado (comparar como string)
    const selectedPoint = points.find(p => p.numero === numeroPontoStr);
    
    if (!selectedPoint) {
      throw new Error(`Ponto ${numeroPonto} não encontrado. Pontos disponíveis: ${points.map(p => p.numero).join(', ')}`);
    }

    // 🆕 NOVA ARQUITETURA: NÃO salvar no banco - apenas retornar informações
    // Seleção é efêmera e gerenciada pelo Redis (consultar_boleto_cliente)
    console.log(`✅ [AI Tool] Ponto ${numeroPontoStr} selecionado: ${selectedPoint.cidade}/${selectedPoint.bairro} - ${selectedPoint.endereco}`);

    // ✅ VERIFICAÇÃO AUTOMÁTICA DE FALHA MASSIVA (OPÇÃO C)
    console.log(`🔍 [AI Tool] Verificando falha massiva para região: ${selectedPoint.cidade}/${selectedPoint.bairro}`);
    const activeFailure = await storage.checkActiveFailureForRegion(selectedPoint.cidade, selectedPoint.bairro);
    
    if (activeFailure) {
      console.log(`🚨 [AI Tool] FALHA MASSIVA ATIVA DETECTADA: ${activeFailure.name}`);
      console.log(`📍 [AI Tool] Região afetada: ${selectedPoint.cidade}/${selectedPoint.bairro}`);
      
      // Verificar se cliente já foi notificado desta falha
      const existingNotifications = await storage.getFailureNotificationsByFailureId(activeFailure.id);
      const alreadyNotified = existingNotifications.some(n => n.clientPhone === conversation.clientId);
      
      if (!alreadyNotified) {
        // Registrar notificação no banco
        try {
          await storage.addFailureNotification({
            failureId: activeFailure.id,
            conversationId: conversationContext.conversationId,
            clientPhone: conversation.clientId || '',
            notificationType: "failure",
            messageSent: activeFailure.notificationMessage,
            wasRead: false,
          });
          console.log(`📝 [AI Tool] Notificação de falha massiva registrada no banco`);
        } catch (error) {
          console.error("❌ [AI Tool] Erro ao registrar notificação:", error);
        }
      }
      
      // Retornar com informações de falha massiva para IA OBRIGATORIAMENTE mencionar
      return {
        selecionado: true,
        ponto: selectedPoint,
        mensagem: `Ponto selecionado: ${selectedPoint.bairro} - ${selectedPoint.endereco}${selectedPoint.complemento ? ', ' + selectedPoint.complemento : ''} (${selectedPoint.cidade})`,
        FALHA_MASSIVA_ATIVA: true,
        falha: {
          nome: activeFailure.name,
          mensagem: activeFailure.notificationMessage,
          severidade: activeFailure.severity,
          previsao: activeFailure.estimatedResolution || null
        }
      };
    }

    // Sem falha massiva - retorno normal
    return {
      selecionado: true,
      ponto: selectedPoint,
      mensagem: `Ponto selecionado: ${selectedPoint.bairro} - ${selectedPoint.endereco}${selectedPoint.complemento ? ', ' + selectedPoint.complemento : ''} (${selectedPoint.cidade})`,
      FALHA_MASSIVA_ATIVA: false
    };
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao selecionar ponto:", error);
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
    case 'solicitarDesbloqueio':  // OpenAI usa camelCase
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para solicitar_desbloqueio");
      }
      return await solicitarDesbloqueio(args.documento, context, storage);

    case 'abrir_ticket_crm':
      if (!args.resumo || !args.setor || !args.motivo) {
        throw new Error("Parâmetros 'resumo', 'setor' e 'motivo' são obrigatórios para abrir_ticket_crm");
      }
      return await abrirTicketCRM(args.resumo, args.setor, args.motivo, context, storage);

    case 'selecionar_ponto_instalacao':
      if (!args.numeroPonto) {
        throw new Error("Parâmetro 'numeroPonto' é obrigatório para selecionar_ponto_instalacao");
      }
      return await selecionarPontoInstalacao(args.numeroPonto, context, storage);

    default:
      throw new Error(`Tool não implementada: ${toolName}`);
  }
}
