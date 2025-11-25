/**
 * Comercial API Integration
 * 
 * Helper para integração com o sistema comercial da TR Telecom
 * Base URL: https://comercial.trtelecom.net
 * 
 * Endpoints disponíveis (Nov 2025):
 * - POST /api/leads - Lead simples (público, não requer auth)
 * - GET /api/plans - Consultar planos ativos (público)
 * - POST /api/sales - Requer autenticação (usar auth/login primeiro)
 * 
 * NOTA: /api/vendachat e /api/site-lead NÃO existem.
 * Todas as vendas/leads devem ir para /api/leads (público) ou /api/sales (autenticado)
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
 * POST /api/leads - Enviar cadastro de venda como lead
 * 
 * Como /api/sales requer autenticação, usamos /api/leads (público)
 * com informações completas no campo descricao
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
  const url = `${COMERCIAL_API_URL}/api/leads`;
  
  console.log(`📤 [Comercial API] Enviando venda como lead para ${url}`);
  console.log(`   - Cliente: ${dados.nome_cliente}`);
  console.log(`   - Vendedor: ${COMERCIAL_VENDEDOR_CODIGO}`);
  
  // Montar descrição com dados completos da venda
  const descricaoParts: string[] = ['[VENDA VIA LIA BOT]'];
  
  if (dados.cpf_cnpj) descricaoParts.push(`CPF/CNPJ: ${dados.cpf_cnpj}`);
  if (dados.email_cliente) descricaoParts.push(`Email: ${dados.email_cliente}`);
  if (dados.plano_id) descricaoParts.push(`Plano ID: ${dados.plano_id}`);
  if (dados.dia_vencimento) descricaoParts.push(`Vencimento: ${dados.dia_vencimento}`);
  if (dados.forma_pagamento) descricaoParts.push(`Pagamento: ${dados.forma_pagamento}`);
  
  if (dados.endereco) {
    const end = dados.endereco;
    const enderecoStr = [
      end.logradouro || end.address,
      end.numero || end.number,
      end.bairro || end.neighborhood,
      end.cidade || end.city,
      end.estado || end.state,
      end.cep
    ].filter(Boolean).join(', ');
    if (enderecoStr) descricaoParts.push(`Endereço: ${enderecoStr}`);
  }
  
  if (dados.observacoes) descricaoParts.push(`Obs: ${dados.observacoes}`);
  if (dados.conversationId) descricaoParts.push(`Conversa: ${dados.conversationId}`);
  
  const payload = {
    nomeCompleto: dados.nome_cliente,
    telefone: normalizePhone(dados.telefone_cliente),
    descricao: descricaoParts.join(' | '),
    origem: `LIA Bot - Venda - ${COMERCIAL_VENDEDOR_CODIGO}`,
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
    
    if (response.ok && result.success) {
      console.log(`✅ [Comercial API] Venda enviada com sucesso!`);
      console.log(`   - Lead ID: ${result.lead?.id}`);
      return {
        success: true,
        sale_id: result.lead?.id,
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
 * POST /api/leads - Enviar lead de prospecção
 * 
 * Usado para leads de prospecção que demonstraram interesse
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
  const url = `${COMERCIAL_API_URL}/api/leads`;
  
  console.log(`📤 [Comercial API] Enviando lead de prospecção para ${url}`);
  console.log(`   - Cliente: ${dados.nome}`);
  
  // Montar descrição com dados do lead
  const descricaoParts: string[] = ['[LEAD PROSPECÇÃO VIA LIA BOT]'];
  
  if (dados.cpf) descricaoParts.push(`CPF: ${dados.cpf}`);
  if (dados.email) descricaoParts.push(`Email: ${dados.email}`);
  if (dados.plano_interesse) descricaoParts.push(`Plano Interesse: ${dados.plano_interesse}`);
  if (dados.plano_id) descricaoParts.push(`Plano ID: ${dados.plano_id}`);
  if (dados.cidade) descricaoParts.push(`Cidade: ${dados.cidade}`);
  if (dados.estado) descricaoParts.push(`Estado: ${dados.estado}`);
  
  if (dados.endereco) {
    const end = dados.endereco;
    const enderecoStr = [
      end.logradouro || end.address,
      end.numero || end.number,
      end.bairro || end.neighborhood,
      end.cidade || end.city,
      end.estado || end.state,
    ].filter(Boolean).join(', ');
    if (enderecoStr) descricaoParts.push(`Endereço: ${enderecoStr}`);
  }
  
  if (dados.observacoes) descricaoParts.push(`Obs: ${dados.observacoes}`);
  
  const payload = {
    nomeCompleto: dados.nome,
    telefone: normalizePhone(dados.telefone),
    descricao: descricaoParts.join(' | '),
    origem: `LIA Bot - Prospecção - ${COMERCIAL_VENDEDOR_CODIGO}`,
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
    
    if (response.ok && result.success) {
      console.log(`✅ [Comercial API] Lead de prospecção enviado com sucesso!`);
      console.log(`   - Lead ID: ${result.lead?.id}`);
      return {
        success: true,
        sale_id: result.lead?.id,
        ...result,
      };
    } else {
      console.error(`❌ [Comercial API] Erro ao enviar lead: ${response.status}`);
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
    
    if (response.ok && result.success) {
      console.log(`✅ [Comercial API] Lead simples enviado com sucesso!`);
      console.log(`   - Lead ID: ${result.lead?.id}`);
      return {
        success: true,
        sale_id: result.lead?.id,
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
