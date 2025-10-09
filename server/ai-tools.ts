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
    console.log(`📋 [AI Tool] Consultando boletos (conversação: ${conversationContext.conversationId})`);

    const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_boleto", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documento }),
    });

    if (!response.ok) {
      console.error(`❌ [AI Tool] Erro na consulta de boletos: ${response.status} ${response.statusText}`);
      throw new Error(`Erro ao consultar boletos: ${response.statusText}`);
    }

    const boletos = await response.json() as ConsultaBoletoResult[];
    console.log(`✅ [AI Tool] Consulta concluída - ${boletos?.length || 0} boletos encontrados`);

    return boletos;
  } catch (error) {
    console.error("❌ [AI Tool] Erro ao consultar boletos:", error);
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

    default:
      throw new Error(`Tool não implementada: ${toolName}`);
  }
}
