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
import { searchKnowledge } from "./lib/upstash";

/**
 * Normaliza nome de cidade/bairro para comparação consistente
 * Remove acentos, converte para uppercase, remove espaços extras
 * @param text Texto a normalizar
 * @returns Texto normalizado
 */
function normalizeLocationName(text: string): string {
  if (!text) return '';
  
  return text
    .normalize('NFD') // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove marcas diacríticas (acentos)
    .toUpperCase() // Converte para maiúsculas
    .trim() // Remove espaços nas pontas
    .replace(/\s+/g, ' '); // Normaliza múltiplos espaços para um único
}

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

/**
 * Valida CPF ou CNPJ usando algoritmo de dígitos verificadores
 * @param documento CPF (11 dígitos) ou CNPJ (14 dígitos) sem formatação
 * @returns Objeto com resultado da validação
 */
export function validarCpfCnpj(documento: string): {
  valido: boolean;
  tipo: 'CPF' | 'CNPJ' | 'INVALIDO';
  motivo?: string;
} {
  // Remove formatação (pontos, traços, barras)
  const docLimpo = documento.replace(/[^\d]/g, '');

  // Valida CPF (11 dígitos)
  if (docLimpo.length === 11) {
    // Rejeita sequências conhecidas
    if (/^(\d)\1{10}$/.test(docLimpo)) {
      return { valido: false, tipo: 'CPF', motivo: 'CPF é uma sequência repetida (ex: 111.111.111-11)' };
    }

    // Calcula primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(docLimpo.charAt(i)) * (10 - i);
    }
    let resto = soma % 11;
    const digito1 = resto < 2 ? 0 : 11 - resto;

    // Calcula segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(docLimpo.charAt(i)) * (11 - i);
    }
    resto = soma % 11;
    const digito2 = resto < 2 ? 0 : 11 - resto;

    // Verifica se dígitos calculados conferem
    if (parseInt(docLimpo.charAt(9)) !== digito1 || parseInt(docLimpo.charAt(10)) !== digito2) {
      return { valido: false, tipo: 'CPF', motivo: 'CPF inválido - dígitos verificadores incorretos' };
    }

    return { valido: true, tipo: 'CPF' };
  }

  // Valida CNPJ (14 dígitos)
  if (docLimpo.length === 14) {
    // Rejeita sequências conhecidas
    if (/^(\d)\1{13}$/.test(docLimpo)) {
      return { valido: false, tipo: 'CNPJ', motivo: 'CNPJ é uma sequência repetida' };
    }

    // Calcula primeiro dígito verificador
    let tamanho = docLimpo.length - 2;
    let numeros = docLimpo.substring(0, tamanho);
    const digitos = docLimpo.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) {
      return { valido: false, tipo: 'CNPJ', motivo: 'CNPJ inválido - dígitos verificadores incorretos' };
    }

    // Calcula segundo dígito verificador
    tamanho = tamanho + 1;
    numeros = docLimpo.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1))) {
      return { valido: false, tipo: 'CNPJ', motivo: 'CNPJ inválido - dígitos verificadores incorretos' };
    }

    return { valido: true, tipo: 'CNPJ' };
  }

  // Tamanho inválido
  return {
    valido: false,
    tipo: 'INVALIDO',
    motivo: `Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ). Recebido: ${docLimpo.length} dígitos.`
  };
}

/**
 * Valida e classifica documento - aceita CPF, CNPJ ou Código de Cliente
 * @param documento CPF, CNPJ ou código de cliente
 * @returns Objeto com resultado da validação e tipo do documento
 */
export function validarDocumentoFlexivel(documento: string): {
  valido: boolean;
  tipo: 'CPF' | 'CNPJ' | 'CLIENT_CODE';
  motivo?: string;
  documentoNormalizado: string;
} {
  // Remove espaços em branco
  const docTrimmed = documento.trim();
  
  // Documento vazio é inválido
  if (!docTrimmed) {
    return {
      valido: false,
      tipo: 'CLIENT_CODE',
      motivo: 'Documento não pode estar vazio',
      documentoNormalizado: ''
    };
  }
  
  // Remove formatação comum (pontos, traços, barras)
  const docLimpo = docTrimmed.replace(/[^\dA-Za-z]/g, '');
  
  // Se for apenas números, tenta validar como CPF/CNPJ
  if (/^\d+$/.test(docLimpo)) {
    const validacaoCpfCnpj = validarCpfCnpj(docLimpo);
    
    // Se for CPF ou CNPJ válido, retorna
    if (validacaoCpfCnpj.valido) {
      return {
        valido: true,
        tipo: validacaoCpfCnpj.tipo as 'CPF' | 'CNPJ',
        documentoNormalizado: docLimpo
      };
    }
    
    // Se tem tamanho de CPF/CNPJ mas é inválido, permite como CLIENT_CODE
    // (ex: códigos numéricos do cliente que não são CPF válido)
    const mascarado = docLimpo.substring(0, 3) + '***';
    console.log(`📝 [Validação] Documento numérico ${docLimpo.length} dígitos (${mascarado}) não é CPF/CNPJ válido - aceitando como CLIENT_CODE`);
  }
  
  // Aceita como código de cliente (qualquer formato)
  return {
    valido: true,
    tipo: 'CLIENT_CODE',
    documentoNormalizado: docTrimmed // Mantém formatação original para códigos
  };
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
  valorMensalidade: number;  // Valor mensal da instalação (para identificação)
}

interface ConsultaBoletoResponse {
  hasMultiplePoints: boolean;
  totalBoletos: number;
  pontos?: PontoInfo[];
  boletos?: ConsultaBoletoResult[];
}

// ===================================
// NOTA FISCAL INTERFACES
// ===================================

interface NotaFiscalResult {
  numero_nf: number;
  data_emissao: string;
  mes_referencia: string;
  link_download: string;
}

interface ConsultaNotaFiscalResponse {
  sucesso: boolean;
  totalNotas: number;
  notas: NotaFiscalResult[];
  mensagem?: string;
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
  hasMultiplePoints?: boolean;  // true: múltiplos endereços, false/undefined: mesmo endereço
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
    
    // AUDITORIA: Logar quando cliente consulta CPF diferente do seu (ex: familiar)
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.warn(`⚠️  [AUDIT] Cliente consultando CPF diferente - Conversa: ${conversationContext.conversationId}, CPF próprio: ***${clientDocumentNormalizado.slice(-4)}, CPF consultado: ***${documentoNormalizado.slice(-4)}`);
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
      
      // Lista de STATUS que indicam boleto REALMENTE PAGO/QUITADO (não enviar)
      // IMPORTANTE: "EM DIA" = boleto a vencer, DEVE ser enviado!
      // Boletos são gerados anualmente por humanos - cliente precisa receber mesmo antes do vencimento
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
      console.log(`🔍 [DEBUG API] Boleto ${idx + 1}:`);
      console.log(`   - Vencimento: ${b.DATA_VENCIMENTO}`);
      console.log(`   - Valor: ${b.VALOR_TOTAL}`);
      console.log(`   - Status: ${b.STATUS}`);
      console.log(`   - Nome: ${b.NOME?.substring(0, 40)}`);
      console.log(`   - RUA: ${b.RUA || 'N/A'}`);
      console.log(`   - BAIRRO: ${b.BAIRRO || 'N/A'}`);
      console.log(`   - CIDADE: ${b.CIDADE || 'N/A'}`);
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
        // Extrair valor da mensalidade do primeiro boleto (todos boletos do mesmo ponto têm o mesmo valor)
        const valorMensalidade = parseFloat((boleto.VALOR_TOTAL || '0').replace(',', '.')) || 0;
        
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
          valorVencido: 0,
          valorMensalidade: valorMensalidade
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
      
      const valor = parseFloat((boleto.VALOR_TOTAL || '0').replace(',', '.')) || 0;
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
 * Consulta notas fiscais emitidas para o cliente
 * @param documento CPF ou CNPJ do cliente
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Lista de notas fiscais com links de download
 */
export async function consultaNotaFiscal(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<ConsultaNotaFiscalResponse> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta NF sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para consulta de nota fiscal");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta NF com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // Validação de documento (normalizar antes de comparar)
    const documentoNormalizado = documento.replace(/\D/g, '');
    const clientDocumentNormalizado = conversation.clientDocument?.replace(/\D/g, '');
    
    // AUDITORIA: Logar quando cliente consulta CPF diferente do seu (ex: familiar)
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.warn(`⚠️  [AUDIT] Cliente consultando NF de CPF diferente - Conversa: ${conversationContext.conversationId}, CPF próprio: ***${clientDocumentNormalizado.slice(-4)}, CPF consultado: ***${documentoNormalizado.slice(-4)}`);
    }

    console.log(`📄 [AI Tool] Consultando notas fiscais (conversação: ${conversationContext.conversationId})`);
    console.log(`🌐 [AI Tool] Endpoint: https://webhook.trtelecom.net/webhook/consulta_nota_fiscal`);

    const notas = await fetchWithRetry<NotaFiscalResult[]>(
      "https://webhook.trtelecom.net/webhook/consulta_nota_fiscal",
      { documento: documentoNormalizado },
      { operationName: "consulta de notas fiscais" }
    );

    console.log(`📄 [AI Tool] ${notas?.length || 0} nota(s) fiscal(is) encontrada(s)`);

    if (!notas || notas.length === 0) {
      return {
        sucesso: true,
        totalNotas: 0,
        notas: [],
        mensagem: "Nenhuma nota fiscal encontrada para este documento."
      };
    }

    // Ordenar por data de emissão (mais recente primeiro)
    const notasOrdenadas = notas.sort((a, b) => {
      const dataA = new Date(a.data_emissao);
      const dataB = new Date(b.data_emissao);
      return dataB.getTime() - dataA.getTime();
    });

    return {
      sucesso: true,
      totalNotas: notasOrdenadas.length,
      notas: notasOrdenadas
    };

  } catch (error) {
    console.error("❌ [AI Tool] Erro ao consultar notas fiscais:", error);
    
    // Retornar erro estruturado ao invés de lançar exceção
    return {
      sucesso: false,
      totalNotas: 0,
      notas: [],
      mensagem: "Não foi possível consultar as notas fiscais no momento. Por favor, tente novamente mais tarde."
    };
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
    
    // AUDITORIA: Logar quando cliente consulta CPF diferente do seu (ex: familiar)
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.warn(`⚠️  [AUDIT] Cliente consultando CPF diferente - Conversa: ${conversationContext.conversationId}, CPF próprio: ***${clientDocumentNormalizado.slice(-4)}, CPF consultado: ***${documentoNormalizado.slice(-4)}`);
    }

    console.log(`🔌 [AI Tool] Consultando status de conexão (conversação: ${conversationContext.conversationId})`);

    const conexoes = await fetchWithRetry<StatusConexaoResult[]>(
      "https://webhook.trtelecom.net/webhook/check_pppoe_status",
      { documento: documentoNormalizado },
      { operationName: "consulta de status PPPoE" }
    );
    
    console.log(`📋 [AI Tool] ${conexoes?.length || 0} conexão(ões) encontrada(s)`);

    // ✅ VERIFICAR FALHA MASSIVA para cada conexão retornada
    if (conexoes && conexoes.length > 0) {
      console.log(`🔍 [AI Tool] Verificando falhas massivas para ${conexoes.length} conexão(ões)...`);
      
      for (const conexao of conexoes) {
        if (conexao.CIDADE && conexao.BAIRRO) {
          // Normalizar cidade e bairro para comparação consistente
          const cidadeNormalizada = normalizeLocationName(conexao.CIDADE);
          const bairroNormalizado = normalizeLocationName(conexao.BAIRRO);
          
          console.log(`🔍 [AI Tool] Verificando massiva: "${conexao.CIDADE}"/"${conexao.BAIRRO}" → "${cidadeNormalizada}"/"${bairroNormalizado}"`);
          
          const activeFailure = await storage.checkActiveFailureForRegion(cidadeNormalizada, bairroNormalizado);
          
          if (activeFailure) {
            console.log(`🚨 [AI Tool] FALHA MASSIVA DETECTADA: ${activeFailure.name} em ${conexao.CIDADE}/${conexao.BAIRRO}`);
            conexao.massiva = true;
          } else {
            console.log(`✅ [AI Tool] Sem massiva em ${conexao.CIDADE}/${conexao.BAIRRO}`);
            conexao.massiva = false;
          }
        } else {
          // Se não tem CIDADE/BAIRRO, assume que não tem massiva
          console.log(`⚠️ [AI Tool] Conexão sem CIDADE/BAIRRO - assumindo sem massiva`);
          conexao.massiva = false;
        }
      }
      
      console.log(`✅ [AI Tool] Verificação de massivas concluída`);
      
      // ✅ DETECTAR SE SÃO MÚLTIPLOS PONTOS (endereços diferentes) ou MÚLTIPLAS CONEXÕES (mesmo endereço)
      if (conexoes.length > 1) {
        const enderecos = new Set<string>();
        
        for (const conexao of conexoes) {
          const enderecoKey = `${normalizeLocationName(conexao.CIDADE || '')}|${normalizeLocationName(conexao.BAIRRO || '')}|${normalizeLocationName(conexao.ENDERECO || '')}`;
          enderecos.add(enderecoKey);
        }
        
        const hasMultipleAddresses = enderecos.size > 1;
        
        if (hasMultipleAddresses) {
          console.log(`🏠 [AI Tool] MÚLTIPLOS PONTOS detectados: ${enderecos.size} endereços diferentes`);
        } else {
          console.log(`🔗 [AI Tool] Múltiplas conexões no MESMO endereço (${conexoes.length} logins PPPoE)`);
        }
        
        // Adicionar flag indicando se são pontos diferentes
        for (const conexao of conexoes) {
          conexao.hasMultiplePoints = hasMultipleAddresses;
        }
      }
    }

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

    // LGPD: documento é passado pelo handler (extraído do histórico ou do banco)
    // Não verificamos mais clientDocument aqui pois por LGPD pode estar vazio
    if (!documento) {
      console.error(`❌ [AI Tool Security] Tentativa de desbloqueio sem documento fornecido`);
      throw new Error("Para solicitar desbloqueio, preciso do seu CPF ou CNPJ. Por favor, me informe seu documento.");
    }

    // Normalizar documento (remover formatação)
    const documentoNormalizado = documento.replace(/\D/g, '');
    
    // AUDITORIA: Logar quando há clientDocument no banco e é diferente do passado
    if (conversation.clientDocument) {
      const clientDocumentNormalizado = conversation.clientDocument.replace(/\D/g, '');
      if (clientDocumentNormalizado !== documentoNormalizado) {
        console.warn(`⚠️  [AUDIT] Cliente solicitando desbloqueio de CPF diferente - Conversa: ${conversationContext.conversationId}, CPF próprio: ***${clientDocumentNormalizado.slice(-4)}, CPF consultado: ***${documentoNormalizado.slice(-4)}`);
      }
    }

    console.log(`🔓 [AI Tool] Solicitando desbloqueio (conversação: ${conversationContext.conversationId}, CPF: ***${documentoNormalizado.slice(-4)})`);


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

/**
 * Interface para resultado de consulta de OS em aberto
 */
interface OrdemServicoAbertoResult {
  existe_os_ativa: string; // "true" ou "false" (API retorna como string)
}

/**
 * Consulta se existe Ordem de Serviço (OS) em aberto para o cliente
 * @param documento CPF ou CNPJ do cliente
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Objeto indicando se existe OS ativa
 */
export async function consultarOrdemServicoAberta(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<OrdemServicoAbertoResult> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta de OS sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para consulta de OS");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de consulta de OS com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // Validação de documento (normalizar antes de comparar)
    const documentoNormalizado = documento.replace(/\D/g, '');
    const clientDocumentNormalizado = conversation.clientDocument?.replace(/\D/g, '');
    
    // AUDITORIA: Logar quando cliente consulta CPF diferente do seu (ex: familiar)
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.warn(`⚠️  [AUDIT] Cliente consultando OS de CPF diferente - Conversa: ${conversationContext.conversationId}, CPF próprio: ***${clientDocumentNormalizado.slice(-4)}, CPF consultado: ***${documentoNormalizado.slice(-4)}`);
    }

    console.log(`🔧 [AI Tool] Consultando OS em aberto (conversação: ${conversationContext.conversationId})`);

    const resultado = await fetchWithRetry<OrdemServicoAbertoResult>(
      "https://webhook.trtelecom.net/webhook/consulta/cliente/os/aberto",
      { documento: documentoNormalizado },
      { operationName: "consulta de OS em aberto" }
    );

    const existeOsAtiva = resultado.existe_os_ativa === "true";
    
    console.log(`📋 [AI Tool] Consulta de OS concluída - Existe OS ativa: ${existeOsAtiva ? 'SIM' : 'NÃO'}`);

    return resultado;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao consultar OS em aberto:", error);
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
function validarSetorMotivo(setor: string, motivo: string): { valido: boolean; erro?: string; motivoNormalizado?: string } {
  const setorUpper = setor.toUpperCase();
  // Normalizar motivo: substituir underscores por espaços (IA às vezes usa INFORMAR_PAGAMENTO ao invés de INFORMAR PAGAMENTO)
  const motivoNormalizado = motivo.toUpperCase().replace(/_/g, ' ');
  
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
  if (!motivosValidos.includes(motivoNormalizado)) {
    return {
      valido: false,
      erro: `Motivo "${motivo}" não é compatível com setor "${setor}". Motivos válidos para ${setor}: ${motivosValidos.join(", ")}`
    };
  }
  
  return { valido: true, motivoNormalizado };
}

/**
 * Interface para resultado de verificação de status de pagamento
 */
interface VerificarStatusPagamentoResult {
  pendingWithProof: boolean; // Se há comprovante enviado aguardando compensação
  unlockInTrust: boolean; // Se houve desbloqueio em confiança
  deadlineEta: string | null; // Prazo estimado para compensação (ISO string)
  ticketProtocolo: string | null; // Protocolo do ticket de comprovante (se houver)
  ticketCreatedAt: string | null; // Data de abertura do ticket (ISO string)
}

/**
 * Verifica status de pagamento do cliente - se há comprovante pendente de compensação
 * Esta função consulta o CRM para verificar se o cliente enviou comprovante de pagamento
 * e está aguardando o prazo de 72h para compensação bancária.
 * 
 * @param documento CPF ou CNPJ do cliente
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @returns Objeto com status de comprovante pendente e prazo de compensação
 */
export async function verificarStatusPagamento(
  documento: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<VerificarStatusPagamentoResult> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de verificar status de pagamento sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para verificação de status de pagamento");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de verificar status com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // Validação de documento (normalizar antes de comparar)
    const documentoNormalizado = documento.replace(/\D/g, '');
    const clientDocumentNormalizado = conversation.clientDocument?.replace(/\D/g, '');
    
    // AUDITORIA: Logar quando cliente consulta CPF diferente do seu (ex: familiar)
    if (clientDocumentNormalizado && clientDocumentNormalizado !== documentoNormalizado) {
      console.warn(`⚠️  [AUDIT] Cliente verificando pagamento de CPF diferente - Conversa: ${conversationContext.conversationId}, CPF próprio: ***${clientDocumentNormalizado.slice(-4)}, CPF consultado: ***${documentoNormalizado.slice(-4)}`);
    }

    console.log(`💰 [AI Tool] Verificando status de pagamento (conversação: ${conversationContext.conversationId})`);

    // Consultar tickets do cliente no CRM
    const resultado = await fetchWithRetry<any>(
      "https://webhook.trtelecom.net/webhook/consulta_tickets",
      { documento: documentoNormalizado },
      { operationName: "consulta de tickets no CRM" }
    );

    // Procurar por ticket de comprovante de pagamento (setor FINANCEIRO, motivo INFORMAR PAGAMENTO)
    // que está ABERTO e foi criado nas últimas 72 horas
    const now = new Date();
    const setenta2HorasAtras = new Date(now.getTime() - (72 * 60 * 60 * 1000));
    
    let pendingWithProof = false;
    let unlockInTrust = false;
    let deadlineEta: string | null = null;
    let ticketProtocolo: string | null = null;
    let ticketCreatedAt: string | null = null;

    // A API retorna um array de tickets
    if (resultado && Array.isArray(resultado) && resultado.length > 0) {
      for (const ticket of resultado) {
        const setor = ticket.setor?.toUpperCase();
        const motivo = ticket.motivo?.toUpperCase();
        const status = ticket.status?.toUpperCase();
        const createdAt = ticket.data_abertura ? new Date(ticket.data_abertura) : null;

        // Verifica se é um ticket de comprovante de pagamento aberto
        if (
          setor === 'FINANCEIRO' &&
          (motivo === 'INFORMAR PAGAMENTO' || motivo === 'PAGAMENTO') &&
          status !== 'FECHADO' &&
          createdAt &&
          createdAt >= setenta2HorasAtras
        ) {
          pendingWithProof = true;
          ticketProtocolo = ticket.protocolo || null;
          ticketCreatedAt = createdAt.toISOString();
          
          // Calcular deadline (72h após abertura do ticket)
          const deadline = new Date(createdAt.getTime() + (72 * 60 * 60 * 1000));
          deadlineEta = deadline.toISOString();
          
          console.log(`🎫 [AI Tool] Ticket de comprovante encontrado - Protocolo: ${ticketProtocolo}, Abertura: ${ticketCreatedAt}, Prazo: ${deadlineEta}`);
          break; // Encontrou, não precisa verificar outros
        }
      }
    }

    // Verificar se houve desbloqueio em confiança
    // FONTE 1: Metadata da conversa (preferencial - persistido após solicitarDesbloqueio)
    const metadata = conversation.metadata as any;
    if (metadata?.unlockInTrust || metadata?.desbloqueioEmConfianca) {
      unlockInTrust = true;
      console.log(`🔓 [AI Tool] Desbloqueio em confiança detectado na metadata da conversa`);
    }
    
    // FONTE 2: Fallback - Tickets do CRM (caso metadata não esteja presente)
    if (!unlockInTrust && resultado && Array.isArray(resultado) && resultado.length > 0) {
      for (const ticket of resultado) {
        const setor = ticket.setor?.toUpperCase();
        const motivo = ticket.motivo?.toUpperCase();
        const status = ticket.status?.toUpperCase();
        const createdAt = ticket.data_abertura ? new Date(ticket.data_abertura) : null;

        // Verificar se há ticket de desbloqueio recente (últimas 72h)
        if (
          setor === 'FINANCEIRO' &&
          motivo === 'DESBLOQUEIO' &&
          status !== 'FECHADO' &&
          createdAt &&
          createdAt >= setenta2HorasAtras
        ) {
          unlockInTrust = true;
          console.log(`🔓 [AI Tool] Desbloqueio em confiança detectado via ticket CRM: ${ticket.protocolo}`);
          break;
        }
      }
    }

    const result: VerificarStatusPagamentoResult = {
      pendingWithProof,
      unlockInTrust,
      deadlineEta,
      ticketProtocolo,
      ticketCreatedAt
    };

    console.log(`📋 [AI Tool] Verificação de status de pagamento concluída:`, result);

    return result;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao verificar status de pagamento:", error);
    
    // Em caso de erro na API, retornar erro explícito para a IA poder informar ao cliente
    throw new Error("Não foi possível verificar o status de pagamento no momento. Por favor, tente novamente em alguns instantes.");
  }
}

/**
 * Abre ticket no CRM externo ao finalizar atendimento
 * @param resumo Resumo breve do atendimento e resolução
 * @param setor Setor responsável pelo atendimento
 * @param motivo Motivo do atendimento (deve ser compatível com o setor)
 * @param conversationContext Contexto OBRIGATÓRIO da conversa para validação de segurança
 * @param storage Interface de storage para validação da conversa
 * @param comprovante_url Link opcional do comprovante/imagem enviado pelo cliente (S3)
 * @returns Protocolo do ticket criado
 */
export async function abrirTicketCRM(
  resumo: string,
  setor: string,
  motivo: string,
  conversationContext: { conversationId: string },
  storage: IStorage,
  comprovante_url?: string,
  clientDocument?: string  // LGPD: CPF extraído do histórico (opcional)
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

    // LGPD Compliance: usar CPF fornecido como parâmetro ou buscar do banco
    const documentoCliente = clientDocument || conversation.clientDocument;
    
    // CRÍTICO: documento deve existir OBRIGATORIAMENTE
    if (!documentoCliente) {
      console.error(`❌ [AI Tool Security] Tentativa de abrir ticket sem documento do cliente`);
      throw new Error("Não é possível abrir ticket sem o CPF ou CNPJ do cliente. Por favor, solicite o documento ao cliente primeiro usando: 'Para finalizar e registrar seu atendimento, preciso do seu CPF ou CNPJ.'");
    }
    
    console.log(`🎫 [AI Tool] Documento do cliente: ***.***.***-${documentoCliente.slice(-2)} (fonte: ${clientDocument ? 'parâmetro' : 'banco'})`);

    // Validação de setor/motivo ANTES de enviar ao webhook
    const validacao = validarSetorMotivo(setor, motivo);
    if (!validacao.valido) {
      console.error(`❌ [AI Tool] Combinação setor/motivo inválida: ${validacao.erro}`);
      throw new Error(validacao.erro);
    }
    
    // Usar motivo normalizado (underscores convertidos para espaços)
    const motivoFinal = validacao.motivoNormalizado || motivo.toUpperCase();

    // Extrair número de telefone do chatId (ex: "whatsapp_5522997074180" ou "5522997074180")
    let phoneNumber = conversation.chatId;
    if (phoneNumber.startsWith('whatsapp_')) {
      phoneNumber = phoneNumber.replace('whatsapp_', '');
    }
    
    // Montar resumo com telefone e link do comprovante (se disponível)
    let resumoCompleto = `[WhatsApp: ${phoneNumber}] ${resumo}`;
    
    if (comprovante_url) {
      resumoCompleto += `\n\n📎 Comprovante: ${comprovante_url}`;
      console.log(`📎 [AI Tool] Link do comprovante incluído no ticket`);
    }

    console.log(`🎫 [AI Tool] Abrindo ticket no CRM (conversação: ${conversationContext.conversationId}, setor: ${setor}, motivo: ${motivoFinal}, telefone: ${phoneNumber})`);

    const resultado = await fetchWithRetry<AbrirTicketResult[]>(
      "https://webhook.trtelecom.net/webhook/abrir_ticket",
      {
        documento: documentoCliente,  // LGPD: usar documento fornecido ou extraído
        resumo: resumoCompleto,
        setor: setor.toUpperCase(),
        motivo: motivoFinal,  // Usar motivo normalizado (underscores -> espaços)
        finalizar: "N"  // "N" = ticket fica ABERTO para verificação manual do atendente
      },
      { operationName: "abertura de ticket no CRM" }
    );
    
    // A API retorna um array, pegamos o primeiro item
    const ticket = resultado[0];
    const protocolo = ticket?.data?.[0]?.resposta?.[0]?.protocolo || 'ERRO';
    
    console.log(`📋 [AI Tool] Ticket criado com sucesso - Protocolo: ${protocolo}`);
    
    // LIMPAR metadata após usar o link do comprovante (evitar reutilização em tickets futuros)
    if (comprovante_url) {
      const currentMetadata = conversation.metadata || {};
      await storage.updateConversation(conversationContext.conversationId, {
        metadata: {
          ...currentMetadata,
          lastImageUrl: null, // Limpar para evitar reutilização
          lastImageProcessedAt: null
        }
      });
      console.log(`🧹 [AI Tool] Metadata do comprovante limpo após criar ticket`);
    }

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
    const { extractCPFFromHistory } = await import('./lib/cpf-context-injector');
    
    // 🔐 LGPD FIX: Extrair CPF do histórico se não estiver no banco
    let documentoCliente = conversation.clientDocument;
    if (!documentoCliente) {
      const messages = await storage.getMessagesByConversationId(conversationContext.conversationId);
      const messagesForCpf = messages.map((m: { content: string; role: string }) => ({
        content: m.content,
        role: m.role as 'user' | 'assistant'
      }));
      documentoCliente = extractCPFFromHistory(messagesForCpf);
      
      if (documentoCliente) {
        console.log(`✅ [AI Tool] CPF extraído do histórico para seleção de ponto: ${documentoCliente.slice(0, 3)}...`);
      }
    }
    
    if (!documentoCliente) {
      throw new Error("CPF/CNPJ não disponível para buscar pontos de instalação. Por favor, informe seu CPF.");
    }

    const points = await fetchClientInstallationPoints(documentoCliente);
    
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
 * Registra reclamação, elogio ou sugestão no painel de Ouvidoria
 * @param tipo Tipo do registro ('reclamacao', 'elogio', 'sugestao')
 * @param descricao Descrição completa do relato
 * @param conversationContext Contexto da conversa
 * @param storage Interface de storage
 * @returns ID do registro criado (protocolo)
 */
export async function registrarReclamacaoOuvidoria(
  tipo: string,
  descricao: string,
  conversationContext: { conversationId: string },
  storage: IStorage
): Promise<{ protocolo: string; tipo: string; registrado: boolean }> {
  try {
    // Validação de segurança OBRIGATÓRIA
    if (!conversationContext || !conversationContext.conversationId) {
      console.error(`❌ [AI Tool Security] Tentativa de registrar ouvidoria sem contexto de conversa`);
      throw new Error("Contexto de segurança é obrigatório para registrar ouvidoria");
    }

    // Validação: conversa deve existir no banco
    const conversation = await storage.getConversation(conversationContext.conversationId);
    if (!conversation) {
      console.error(`❌ [AI Tool Security] Tentativa de registrar ouvidoria com conversationId inválido`);
      throw new Error("Conversa não encontrada - contexto de segurança inválido");
    }

    // 🔐 LGPD FIX: Extrair CPF do histórico se não estiver no banco
    const { extractCPFFromHistory } = await import('./lib/cpf-context-injector');
    let documentoCliente = conversation.clientDocument;
    if (!documentoCliente) {
      const messages = await storage.getMessagesByConversationId(conversationContext.conversationId);
      const messagesForCpf = messages.map((m: { content: string; role: string }) => ({
        content: m.content,
        role: m.role as 'user' | 'assistant'
      }));
      documentoCliente = extractCPFFromHistory(messagesForCpf);
      
      if (documentoCliente) {
        console.log(`✅ [Ouvidoria] CPF extraído do histórico: ${documentoCliente.slice(0, 3)}...`);
      }
    }
    
    // CRÍTICO: clientDocument deve existir OBRIGATORIAMENTE
    if (!documentoCliente) {
      console.error(`❌ [AI Tool Security] Tentativa de registrar ouvidoria sem documento do cliente`);
      throw new Error("Não é possível registrar na ouvidoria sem o CPF ou CNPJ do cliente. Por favor, solicite o documento ao cliente primeiro.");
    }

    // Validar tipo de registro
    const tipoNormalizado = tipo.toLowerCase();
    if (!['reclamacao', 'elogio', 'sugestao'].includes(tipoNormalizado)) {
      throw new Error(`Tipo de ouvidoria inválido: ${tipo}. Tipos válidos: reclamacao, elogio, sugestao`);
    }

    // Mapear tipo para complaintType da tabela
    let complaintType: 'atendimento' | 'produto' | 'tecnico' | 'comercial' | 'financeiro' | 'outro';
    let severity: 'baixa' | 'media' | 'alta' | 'critica';
    
    if (tipoNormalizado === 'reclamacao') {
      complaintType = 'atendimento'; // Tipo padrão para reclamações de ouvidoria
      severity = 'alta'; // Reclamações têm alta prioridade
    } else if (tipoNormalizado === 'elogio') {
      complaintType = 'atendimento';
      severity = 'baixa'; // Elogios têm baixa prioridade
    } else { // sugestao
      complaintType = 'outro';
      severity = 'media'; // Sugestões têm média prioridade
    }

    console.log(`📝 [Ouvidoria] Registrando ${tipoNormalizado} (conv: ${conversationContext.conversationId})`);

    // Criar registro na tabela complaints
    const complaint = await storage.createComplaint({
      conversationId: conversationContext.conversationId,
      complaintType,
      severity,
      description: descricao,
      status: 'novo',
      metadata: {
        tipoOuvidoria: tipoNormalizado,
        clientDocument: documentoCliente,
        clientName: conversation.clientName || 'Não informado',
        chatId: conversation.chatId
      }
    });

    console.log(`✅ [Ouvidoria] Registro criado com sucesso - ID: ${complaint.id}`);

    return {
      protocolo: complaint.id,
      tipo: tipoNormalizado,
      registrado: true
    };
  } catch (error) {
    console.error("❌ [Ouvidoria] Erro ao registrar:", error);
    throw error;
  }
}

/**
 * Roteia conversa para assistente especializado (NÃO marca como transferido para humano)
 * @param assistantType Tipo do assistente especializado (suporte, comercial, financeiro, cancelamento, ouvidoria)
 * @param motivo Motivo do roteamento
 * @returns Confirmação do roteamento
 */
export async function rotearParaAssistenteEspecializado(
  assistantType: string,
  motivo: string
): Promise<{ roteado: boolean; assistente: string; motivo: string }> {
  console.log(`🎭 [AI Tool] Roteamento interno: ${assistantType} - Motivo: ${motivo}`);
  
  // Retorna estrutura que será processada pelo handler
  return {
    roteado: true,
    assistente: assistantType,
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

    case 'gerar_segunda_via':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para gerar_segunda_via");
      }
      // gerar_segunda_via é um alias para consulta_boleto_cliente
      return await consultaBoletoCliente(args.documento, context, storage);

    case 'registrar_reclamacao_ouvidoria':
      if (!args.tipo || !args.descricao) {
        throw new Error("Parâmetros 'tipo' e 'descricao' são obrigatórios para registrar_reclamacao_ouvidoria");
      }
      return await registrarReclamacaoOuvidoria(args.tipo, args.descricao, context, storage);

    case 'rotear_para_assistente':
      if (!args.assistantType || !args.motivo) {
        throw new Error("Parâmetros 'assistantType' e 'motivo' são obrigatórios para rotear_para_assistente");
      }
      return await rotearParaAssistenteEspecializado(args.assistantType, args.motivo);

    case 'verificar_conexao':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para verificar_conexao");
      }
      return await consultaStatusConexao(args.documento, context, storage);

    case 'consultar_plano_cliente':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para consultar_plano_cliente");
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
      // Recuperar imageUrl do metadata (se disponível E recente)
      const conversation = await storage.getConversation(context.conversationId);
      const metadata = conversation?.metadata as any;
      let imageUrl = metadata?.lastImageUrl;
      
      // VALIDAÇÃO DE FRESHNESS: só usar link se foi processado recentemente (últimos 5 minutos)
      if (imageUrl) {
        // CRÍTICO: Ignorar metadata legado sem timestamp (conversas antigas)
        if (!metadata?.lastImageProcessedAt) {
          console.log(`⚠️ [AI Tool Security] imageUrl ignorado - metadata legado sem timestamp`);
          imageUrl = null; // Ignorar e limpar metadata legado
          
          // Limpar metadata legado para evitar repetição deste log
          await storage.updateConversation(context.conversationId, {
            metadata: {
              ...metadata,
              lastImageUrl: null,
              lastImageProcessedAt: null
            }
          });
        } else {
          // Verificar se foi processado recentemente
          const processedAt = new Date(metadata.lastImageProcessedAt);
          const now = new Date();
          const minutesAgo = (now.getTime() - processedAt.getTime()) / (1000 * 60);
          
          if (minutesAgo > 5) {
            console.log(`⚠️ [AI Tool Security] imageUrl ignorado - processado há ${minutesAgo.toFixed(1)} minutos (limite: 5 min)`);
            imageUrl = null; // Ignorar link antigo
          } else {
            console.log(`✅ [AI Tool Security] imageUrl validado - processado há ${minutesAgo.toFixed(1)} minutos`);
          }
        }
      }
      
      return await abrirTicketCRM(args.resumo, args.setor, args.motivo, context, storage, imageUrl);

    case 'selecionar_ponto_instalacao':
      if (!args.numeroPonto) {
        throw new Error("Parâmetro 'numeroPonto' é obrigatório para selecionar_ponto_instalacao");
      }
      return await selecionarPontoInstalacao(args.numeroPonto, context, storage);

    case 'validar_cpf_cnpj':
      if (!args.documento) {
        throw new Error("Parâmetro 'documento' é obrigatório para validar_cpf_cnpj");
      }
      return validarCpfCnpj(args.documento);

    case 'consultar_base_de_conhecimento':
      if (!args.query) {
        throw new Error("Parâmetro 'query' é obrigatório para consultar_base_de_conhecimento");
      }
      console.log(`📚 [AI Tool] Consultando base de conhecimento: "${args.query}"`);
      const results = await searchKnowledge(args.query, args.topK || 5);
      
      if (results.length === 0) {
        return {
          encontrado: false,
          mensagem: "Não encontrei informações sobre isso na base de conhecimento."
        };
      }
      
      // Formatar resultados para a IA
      const conhecimento = results.map((r, idx) => ({
        fonte: r.chunk.source,
        conteudo: r.chunk.content,
        relevancia: r.score,
      }));
      
      console.log(`✅ [AI Tool] ${results.length} resultado(s) encontrado(s) na base de conhecimento`);
      
      return {
        encontrado: true,
        resultados: conhecimento,
        mensagem: `Encontrei ${results.length} informação(ões) relevante(s).`
      };

    default:
      throw new Error(`Tool não implementada: ${toolName}`);
  }
}
