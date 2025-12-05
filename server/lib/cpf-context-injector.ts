/**
 * Extrai CPF do histórico de mensagens e injeta no contexto da IA
 * Solução para LGPD: CPF não é armazenado no DB, mas recuperado do histórico quando necessário
 */

interface MessageWithContent {
  content: string;
  role: 'user' | 'assistant';
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
      console.log(`✅ [CPF Injector] CPF encontrado no histórico: ${formatted}`);
      return cpfClean; // Retornar sem formatação para comparação
    }
  }
  
  console.log(`⚠️ [CPF Injector] Nenhum CPF encontrado no histórico`);
  return null;
}

/**
 * Injeta contexto de CPF na mensagem se não estiver explícito
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
