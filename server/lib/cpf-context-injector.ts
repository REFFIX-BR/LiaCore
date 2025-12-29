/**
 * Extrai CPF/CNPJ do histórico de mensagens e injeta no contexto da IA
 * Solução para LGPD: CPF/CNPJ não é armazenado no DB, mas recuperado do histórico quando necessário
 */

interface MessageWithContent {
  content: string;
  role: 'user' | 'assistant';
}

export interface DocumentoExtraido {
  documento: string;  // Número limpo (só dígitos)
  tipo: 'CPF' | 'CNPJ';
  formatado: string;  // Formato visual (XXX.XXX.XXX-XX ou XX.XXX.XXX/XXXX-XX)
}

/**
 * CNPJs conhecidos que NÃO devem ser confundidos com CPF
 * Ex: CNPJ da TR Telecom 22.915.355/0001-43 poderia ser pego como CPF 22915355000
 */
const CNPJ_BLACKLIST = [
  '22915355000143', // TR Telecom - CNPJ completo
  '22915355000',    // Primeiros 11 dígitos do CNPJ da TR Telecom (parece CPF!)
  '22896431000110', // PicPay
  '18236120000158', // Nu Pagamentos
];

/**
 * Valida CPF usando algoritmo de dígitos verificadores
 * Retorna true se CPF é válido
 */
function validarCPF(cpf: string): boolean {
  // Remover caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
  
  if (cpf.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais (inválido)
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Calcular primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;
  
  // Calcular segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ usando algoritmo de dígitos verificadores
 * Retorna true se CNPJ é válido
 */
function validarCNPJ(cnpj: string): boolean {
  // Remover caracteres não numéricos
  cnpj = cnpj.replace(/\D/g, '');
  
  if (cnpj.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais (inválido)
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  // Pesos para cálculo dos dígitos verificadores
  const pesosPrimeiroDigito = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosSegundoDigito = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  // Calcular primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj.charAt(i)) * pesosPrimeiroDigito[i];
  }
  let resto = soma % 11;
  const primeiroDigito = resto < 2 ? 0 : 11 - resto;
  if (primeiroDigito !== parseInt(cnpj.charAt(12))) return false;
  
  // Calcular segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj.charAt(i)) * pesosSegundoDigito[i];
  }
  resto = soma % 11;
  const segundoDigito = resto < 2 ? 0 : 11 - resto;
  if (segundoDigito !== parseInt(cnpj.charAt(13))) return false;
  
  return true;
}

/**
 * Verifica se um possível CPF é na verdade parte de um CNPJ conhecido
 */
function isBlacklistedCNPJ(cpfClean: string): boolean {
  // Verifica se é exatamente um CNPJ blacklistado ou parte dele
  for (const cnpj of CNPJ_BLACKLIST) {
    if (cnpj.startsWith(cpfClean) || cpfClean === cnpj.slice(0, 11)) {
      return true;
    }
  }
  return false;
}

/**
 * Verifica se o número parece ser parte de um CNPJ (contexto ao redor)
 */
function isPartOfCNPJ(content: string, match: string): boolean {
  // Verifica se há /0001- ou /0002- etc logo após o match (indicando CNPJ completo)
  const matchIndex = content.indexOf(match);
  if (matchIndex === -1) return false;
  
  const afterMatch = content.slice(matchIndex + match.length, matchIndex + match.length + 10);
  
  // Se logo após tiver /0001 ou padrão de CNPJ, é CNPJ não CPF
  if (/^[\s.\-\/]?0001[\-\s]?[0-9]{2}/.test(afterMatch)) {
    return true;
  }
  
  return false;
}

/**
 * Extrai CPF válido do histórico de mensagens (busca do mais recente para o mais antigo)
 */
export function extractCPFFromHistory(messages: MessageWithContent[]): string | null {
  // Regex para CPF: XXX.XXX.XXX-XX ou XXXXXXXXXXX ou XXX XXX XXX XX (com espaços)
  const cpfRegex = /(\d{3})[\s.\-]?(\d{3})[\s.\-]?(\d{3})[\s.\-]?(\d{2})/g;
  
  // Buscar do MAIS RECENTE para o MAIS ANTIGO
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    
    // Só buscar em mensagens do usuário (não da IA)
    if (message.role !== 'user') continue;
    
    // Resetar o regex para cada mensagem
    cpfRegex.lastIndex = 0;
    
    let match;
    while ((match = cpfRegex.exec(message.content)) !== null) {
      const cpfRaw = match[0];
      
      // Remover formatação e validar tamanho
      const cpfClean = cpfRaw.replace(/\D/g, '');
      
      if (cpfClean.length !== 11) continue;
      
      // CRÍTICO: Validar dígitos verificadores do CPF
      if (!validarCPF(cpfClean)) {
        console.log(`⚠️ [CPF Injector] CPF ${cpfClean.slice(0, 3)}***${cpfClean.slice(-2)} falhou na validação de dígitos verificadores`);
        continue;
      }
      
      // NOVO: Verificar se é um CNPJ blacklistado
      if (isBlacklistedCNPJ(cpfClean)) {
        console.log(`⚠️ [CPF Injector] Ignorando CNPJ conhecido (blacklist): ${cpfClean.slice(0, 3)}...`);
        continue;
      }
      
      // NOVO: Verificar se parece ser parte de um CNPJ no contexto
      if (isPartOfCNPJ(message.content, cpfRaw)) {
        console.log(`⚠️ [CPF Injector] Ignorando número que parece ser parte de CNPJ`);
        continue;
      }
      
      // NOVO: CPFs que começam com 000 ou 229 (TR Telecom) são suspeitos
      if (cpfClean.startsWith('229153')) {
        console.log(`⚠️ [CPF Injector] Ignorando número suspeito (padrão TR Telecom): ${cpfClean.slice(0, 3)}...`);
        continue;
      }
      
      // Re-formatar: XXX.XXX.XXX-XX
      const formatted = `${cpfClean.slice(0, 3)}.${cpfClean.slice(3, 6)}.${cpfClean.slice(6, 9)}-${cpfClean.slice(9)}`;
      console.log(`✅ [CPF Injector] CPF VÁLIDO encontrado no histórico: ${formatted}`);
      return cpfClean; // Retornar sem formatação para comparação
    }
  }
  
  console.log(`⚠️ [CPF Injector] Nenhum CPF encontrado no histórico`);
  return null;
}

/**
 * Extrai CNPJ válido do histórico de mensagens (busca do mais recente para o mais antigo)
 * CNPJ: XX.XXX.XXX/XXXX-XX ou 14 dígitos seguidos
 */
export function extractCNPJFromHistory(messages: MessageWithContent[]): string | null {
  // Regex para CNPJ: XX.XXX.XXX/XXXX-XX ou XXXXXXXXXXXXXX (14 dígitos)
  const cnpjRegex = /(\d{2})[\s.\-]?(\d{3})[\s.\-]?(\d{3})[\s.\/\-]?(\d{4})[\s.\-]?(\d{2})/g;
  
  // Buscar do MAIS RECENTE para o MAIS ANTIGO
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    
    // Só buscar em mensagens do usuário (não da IA)
    if (message.role !== 'user') continue;
    
    // Resetar o regex para cada mensagem
    cnpjRegex.lastIndex = 0;
    
    let match;
    while ((match = cnpjRegex.exec(message.content)) !== null) {
      const cnpjRaw = match[0];
      
      // Remover formatação e validar tamanho
      const cnpjClean = cnpjRaw.replace(/\D/g, '');
      
      if (cnpjClean.length !== 14) continue;
      
      // CRÍTICO: Validar dígitos verificadores do CNPJ
      // Isso evita confundir datas (ex: 10.573.521/2025-12) com CNPJs
      if (!validarCNPJ(cnpjClean)) {
        console.log(`⚠️ [CNPJ Injector] CNPJ ${cnpjClean.slice(0, 8)}...${cnpjClean.slice(-2)} falhou na validação de dígitos verificadores (provavelmente NÃO é CNPJ)`);
        continue;
      }
      
      // Ignorar CNPJs conhecidos (TR Telecom, PicPay, etc.)
      if (CNPJ_BLACKLIST.includes(cnpjClean)) {
        console.log(`⚠️ [CNPJ Injector] Ignorando CNPJ conhecido (blacklist): ${cnpjClean.slice(0, 8)}...`);
        continue;
      }
      
      // Re-formatar: XX.XXX.XXX/XXXX-XX
      const formatted = `${cnpjClean.slice(0, 2)}.${cnpjClean.slice(2, 5)}.${cnpjClean.slice(5, 8)}/${cnpjClean.slice(8, 12)}-${cnpjClean.slice(12)}`;
      console.log(`✅ [CNPJ Injector] CNPJ VÁLIDO encontrado no histórico: ${formatted}`);
      return cnpjClean; // Retornar sem formatação para comparação
    }
  }
  
  console.log(`⚠️ [CNPJ Injector] Nenhum CNPJ encontrado no histórico`);
  return null;
}

/**
 * Extrai documento (CPF ou CNPJ) do histórico - tenta CNPJ primeiro (mais específico), depois CPF
 */
export function extractDocumentoFromHistory(messages: MessageWithContent[]): DocumentoExtraido | null {
  // Tentar CNPJ primeiro (14 dígitos é mais específico que 11)
  const cnpj = extractCNPJFromHistory(messages);
  if (cnpj) {
    return {
      documento: cnpj,
      tipo: 'CNPJ',
      formatado: `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
    };
  }
  
  // Se não encontrou CNPJ, tentar CPF
  const cpf = extractCPFFromHistory(messages);
  if (cpf) {
    return {
      documento: cpf,
      tipo: 'CPF',
      formatado: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
    };
  }
  
  return null;
}

/**
 * Injeta contexto de CPF na mensagem se não estiver explícito
 * @deprecated Use injectDocumentoContext() para suportar CPF e CNPJ
 */
export function injectCPFContext(message: string, cpf: string | null, assistantType: string): string {
  if (!cpf) {
    return message;
  }
  
  // Verificar se a mensagem já menciona CPF
  if (message.toLowerCase().includes('cpf') || message.includes(cpf)) {
    console.log(`ℹ️ [CPF Injector] CPF já mencionado na mensagem, não injeta contexto`);
    return message;
  }
  
  // Injetar contexto de CPF formatado para assistentes financeiro e suporte
  if (assistantType === 'financeiro' || assistantType === 'suporte') {
    const cpfFormatted = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    const contextInjection = `\n\n---\n[CONTEXTO INTERNO]\nCPF do cliente (extraído do histórico): ${cpfFormatted}\n---`;
    
    console.log(`✅ [CPF Injector] Contexto de CPF injetado para ${assistantType}`);
    return message + contextInjection;
  }
  
  return message;
}

/**
 * Injeta contexto de documento (CPF ou CNPJ) na mensagem se não estiver explícito
 */
export function injectDocumentoContext(message: string, documento: DocumentoExtraido | null, assistantType: string): string {
  if (!documento) {
    return message;
  }
  
  // Verificar se a mensagem já menciona o documento
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('cpf') || lowerMessage.includes('cnpj') || message.includes(documento.documento)) {
    console.log(`ℹ️ [Documento Injector] ${documento.tipo} já mencionado na mensagem, não injeta contexto`);
    return message;
  }
  
  // Injetar contexto de documento formatado para assistentes financeiro e suporte
  if (assistantType === 'financeiro' || assistantType === 'suporte') {
    const contextInjection = `\n\n---\n[CONTEXTO INTERNO]\n${documento.tipo} do cliente (extraído do histórico): ${documento.formatado}\n---`;
    
    console.log(`✅ [Documento Injector] Contexto de ${documento.tipo} injetado para ${assistantType}: ${documento.formatado}`);
    return message + contextInjection;
  }
  
  return message;
}
