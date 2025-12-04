/**
 * Extrai CPF do histórico de mensagens e injeta no contexto da IA
 * Solução para LGPD: CPF não é armazenado no DB, mas recuperado do histórico quando necessário
 */

interface MessageWithContent {
  content: string;
  role: 'user' | 'assistant';
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
    
    const matches = message.content.match(cpfRegex);
    if (matches && matches.length > 0) {
      // Pegamos o primeiro match (pode haver vários)
      const cpfRaw = matches[0];
      
      // Remover formatação e validar tamanho
      const cpfClean = cpfRaw.replace(/\D/g, '');
      if (cpfClean.length === 11) {
        // Re-formatar: XXX.XXX.XXX-XX
        const formatted = `${cpfClean.slice(0, 3)}.${cpfClean.slice(3, 6)}.${cpfClean.slice(6, 9)}-${cpfClean.slice(9)}`;
        console.log(`✅ [CPF Injector] CPF encontrado no histórico: ${formatted}`);
        return cpfClean; // Retornar sem formatação para comparação
      }
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
