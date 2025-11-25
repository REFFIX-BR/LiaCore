/**
 * Comercial API Integration
 * 
 * Helper para integração com o sistema comercial da TR Telecom
 * Base URL: https://comercial.trtelecom.net
 * 
 * Endpoints utilizados:
 * - POST /api/vendachat - Cadastro completo de venda (chatbot)
 * - POST /api/site-lead - Lead com interesse
 * - POST /api/leads - Lead simples (nome + telefone)
 * - GET /api/plans - Consultar planos ativos
 */

const COMERCIAL_API_URL = process.env.COMERCIAL_API_URL || 'https://comercial.trtelecom.net';
const COMERCIAL_VENDEDOR_CODIGO = process.env.COMERCIAL_VENDEDOR_CODIGO || 'LIA';
const COMERCIAL_API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

interface ComercialEnderecoPayload {
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  complemento?: string;
  referencia?: string;
}

interface ComercialVendaChatPayload {
  vendedor: {
    codigo: string;
  };
  nome_cliente: string;
  telefone_cliente: string;
  email_cliente?: string;
  cpf_cliente?: string;
  nome_mae?: string;
  data_nascimento?: string;
  rg?: string;
  sexo?: string;
  estado_civil?: string;
  dia_vencimento?: number;
  forma_pagamento_instalacao?: string;
  plano_id?: number | string;
  status?: string;
  observacoes?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  endereco?: ComercialEnderecoPayload;
}

interface ComercialSiteLeadPayload {
  nome_cliente: string;
  telefone_cliente: string;
  email_cliente?: string;
  cpf_cliente?: string;
  plano_id?: number | string;
  plano_interesse?: string;
  observacoes?: string;
  endereco?: ComercialEnderecoPayload;
}

interface ComercialLeadSimplesPayload {
  nomeCompleto: string;
  telefone: string;
  descricao?: string;
  origem?: string;
}

interface ComercialApiResponse {
  success: boolean;
  message?: string;
  sale_id?: string;
  status?: string;
  vendedor?: {
    id: string;
    nome: string;
    codigo_indicacao: string;
  };
  itens_pendentes?: string[];
  error?: string;
  duplicated?: boolean;
}

interface ComercialPlan {
  id: number | string;
  nome: string;
  preco: number;
  tipo: string;
  ativo: boolean;
}

/**
 * Faz requisição à API Comercial com retry automático
 */
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = MAX_RETRIES
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMERCIAL_API_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (retries > 0 && (error.name === 'AbortError' || error.code === 'ECONNRESET')) {
      console.log(`🔄 [Comercial API] Retry ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} para ${url}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (MAX_RETRIES - retries + 1)));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Mapeia dados internos do LIA para formato da API Comercial
 */
function mapEnderecoToComercial(endereco: any): ComercialEnderecoPayload | undefined {
  if (!endereco) return undefined;
  
  return {
    endereco: endereco.logradouro || endereco.address || '',
    numero: endereco.numero || endereco.number || '',
    bairro: endereco.bairro || endereco.neighborhood || '',
    cidade: endereco.cidade || endereco.city || '',
    estado: endereco.estado || endereco.state || '',
    cep: (endereco.cep || '').replace(/\D/g, ''),
    complemento: endereco.complemento || endereco.complement || undefined,
    referencia: endereco.referencia || endereco.reference || undefined,
  };
}

/**
 * Normaliza telefone para formato brasileiro com DDD
 */
function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  return phone;
}

/**
 * POST /api/vendachat - Enviar cadastro completo de venda
 * 
 * Usado para vendas completas vindas do chatbot com todos os dados coletados
 */
export async function enviarVendaChat(dados: {
  tipo_pessoa?: string;
  nome_cliente: string;
  cpf_cnpj?: string;
  telefone_cliente: string;
  email_cliente?: string;
  nome_mae?: string;
  data_nascimento?: string;
  rg?: string;
  sexo?: string;
  estado_civil?: string;
  plano_id?: string | number;
  endereco?: any;
  dia_vencimento?: string | number;
  forma_pagamento?: string;
  observacoes?: string;
  conversationId?: string;
}): Promise<ComercialApiResponse> {
  const url = `${COMERCIAL_API_URL}/api/vendachat`;
  
  console.log(`📤 [Comercial API] Enviando venda para ${url}`);
  console.log(`   - Cliente: ${dados.nome_cliente}`);
  console.log(`   - Vendedor: ${COMERCIAL_VENDEDOR_CODIGO}`);
  
  const payload: ComercialVendaChatPayload = {
    vendedor: {
      codigo: COMERCIAL_VENDEDOR_CODIGO,
    },
    nome_cliente: dados.nome_cliente,
    telefone_cliente: normalizePhone(dados.telefone_cliente),
    email_cliente: dados.email_cliente || undefined,
    cpf_cliente: dados.cpf_cnpj?.replace(/\D/g, '') || undefined,
    nome_mae: dados.nome_mae || undefined,
    data_nascimento: dados.data_nascimento || undefined,
    rg: dados.rg || undefined,
    sexo: dados.sexo || undefined,
    estado_civil: dados.estado_civil || undefined,
    dia_vencimento: dados.dia_vencimento ? parseInt(String(dados.dia_vencimento)) : undefined,
    forma_pagamento_instalacao: dados.forma_pagamento || undefined,
    plano_id: dados.plano_id || undefined,
    status: 'Aguardando Análise',
    observacoes: dados.observacoes || `Via LIA Bot - Conversa: ${dados.conversationId || 'N/A'}`,
    utm_source: 'whatsapp',
    utm_medium: 'bot',
    utm_campaign: 'lia-cortex',
    endereco: mapEnderecoToComercial(dados.endereco),
  };
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ [Comercial API] Venda enviada com sucesso!`);
      console.log(`   - Sale ID: ${result.sale_id}`);
      console.log(`   - Status: ${result.status}`);
      return {
        success: true,
        ...result,
      };
    } else {
      console.error(`❌ [Comercial API] Erro ao enviar venda: ${response.status}`);
      console.error(`   - Resposta: ${JSON.stringify(result)}`);
      return {
        success: false,
        error: result.message || result.error || `Erro ${response.status}`,
        ...result,
      };
    }
  } catch (error: any) {
    console.error(`❌ [Comercial API] Erro de conexão:`, error.message);
    return {
      success: false,
      error: `Erro de conexão: ${error.message}`,
    };
  }
}

/**
 * POST /api/site-lead - Enviar lead com interesse
 * 
 * Usado para leads de prospecção que demonstraram interesse mas não completaram cadastro
 */
export async function enviarSiteLead(dados: {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  cidade?: string;
  estado?: string;
  plano_id?: string | number;
  plano_interesse?: string;
  observacoes?: string;
  endereco?: any;
}): Promise<ComercialApiResponse> {
  const url = `${COMERCIAL_API_URL}/api/site-lead`;
  
  console.log(`📤 [Comercial API] Enviando site-lead para ${url}`);
  console.log(`   - Cliente: ${dados.nome}`);
  
  const payload: ComercialSiteLeadPayload = {
    nome_cliente: dados.nome,
    telefone_cliente: normalizePhone(dados.telefone),
    email_cliente: dados.email || undefined,
    cpf_cliente: dados.cpf?.replace(/\D/g, '') || undefined,
    plano_id: dados.plano_id || undefined,
    plano_interesse: dados.plano_interesse || undefined,
    observacoes: dados.observacoes || 'Lead via LIA Bot',
    endereco: dados.endereco ? mapEnderecoToComercial(dados.endereco) : undefined,
  };
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ [Comercial API] Site-lead enviado com sucesso!`);
      return {
        success: true,
        ...result,
      };
    } else {
      console.error(`❌ [Comercial API] Erro ao enviar site-lead: ${response.status}`);
      return {
        success: false,
        error: result.message || result.error || `Erro ${response.status}`,
        duplicated: response.status === 409,
        ...result,
      };
    }
  } catch (error: any) {
    console.error(`❌ [Comercial API] Erro de conexão:`, error.message);
    return {
      success: false,
      error: `Erro de conexão: ${error.message}`,
    };
  }
}

/**
 * POST /api/leads - Enviar lead simples
 * 
 * Usado para leads sem cobertura ou cadastros rápidos (apenas nome + telefone)
 */
export async function enviarLeadSimples(dados: {
  nome: string;
  telefone: string;
  cidade?: string;
  descricao?: string;
  origem?: string;
}): Promise<ComercialApiResponse> {
  const url = `${COMERCIAL_API_URL}/api/leads`;
  
  console.log(`📤 [Comercial API] Enviando lead simples para ${url}`);
  console.log(`   - Cliente: ${dados.nome}`);
  
  const payload: ComercialLeadSimplesPayload = {
    nomeCompleto: dados.nome,
    telefone: normalizePhone(dados.telefone),
    descricao: dados.cidade 
      ? `${dados.descricao || 'Interesse em serviços'} - Cidade: ${dados.cidade}`
      : dados.descricao || 'Interesse em serviços - Via LIA Bot',
    origem: dados.origem || 'LIA Bot',
  };
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ [Comercial API] Lead simples enviado com sucesso!`);
      return {
        success: true,
        ...result,
      };
    } else {
      console.error(`❌ [Comercial API] Erro ao enviar lead simples: ${response.status}`);
      return {
        success: false,
        error: result.message || result.error || `Erro ${response.status}`,
        duplicated: response.status === 409,
        ...result,
      };
    }
  } catch (error: any) {
    console.error(`❌ [Comercial API] Erro de conexão:`, error.message);
    return {
      success: false,
      error: `Erro de conexão: ${error.message}`,
    };
  }
}

/**
 * GET /api/plans - Consultar planos ativos
 * 
 * Retorna lista de planos ativos do sistema comercial
 */
export async function consultarPlanosComercial(): Promise<{
  success: boolean;
  planos?: ComercialPlan[];
  error?: string;
}> {
  const url = `${COMERCIAL_API_URL}/api/plans`;
  
  console.log(`📤 [Comercial API] Consultando planos em ${url}`);
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ [Comercial API] Planos consultados: ${result.length || 0} encontrados`);
      return {
        success: true,
        planos: result,
      };
    } else {
      console.error(`❌ [Comercial API] Erro ao consultar planos: ${response.status}`);
      return {
        success: false,
        error: result.message || result.error || `Erro ${response.status}`,
      };
    }
  } catch (error: any) {
    console.error(`❌ [Comercial API] Erro de conexão:`, error.message);
    return {
      success: false,
      error: `Erro de conexão: ${error.message}`,
    };
  }
}

/**
 * Verifica se a API Comercial está acessível
 */
export async function verificarConexaoComercial(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${COMERCIAL_API_URL}/api/plans`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export {
  COMERCIAL_API_URL,
  COMERCIAL_VENDEDOR_CODIGO,
};
