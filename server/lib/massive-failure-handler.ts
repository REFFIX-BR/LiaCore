import { storage } from "../storage";

/**
 * Interface para representar um ponto de instalação
 */
export interface InstallationPoint {
  numero: string;
  nomeCliente: string;
  endereco: string;
  bairro: string;
  cidade: string;
  complemento: string;
  login: string;
  plano: string;
}

/**
 * Consulta a API CRM para obter informações de pontos de instalação do cliente
 * @param cpfCnpj - CPF/CNPJ do cliente
 * @returns Array de pontos de instalação ou null se não encontrado
 */
export async function fetchClientInstallationPoints(cpfCnpj: string): Promise<InstallationPoint[] | null> {
  const CRM_API_URL = "https://webhook.trtelecom.net/webhook/consultar/cliente/infoscontrato";
  
  if (!cpfCnpj) {
    console.log("⚠️ [Massive Failure] CPF/CNPJ não fornecido");
    return null;
  }

  try {
    const response = await fetch(`${CRM_API_URL}?documento=${cpfCnpj}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`❌ [Massive Failure] CRM API error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // CRM retorna array de contratos (cliente pode ter múltiplos pontos)
    const contracts = Array.isArray(data) ? data : [data];
    
    if (contracts.length === 0) {
      console.log("⚠️ [Massive Failure] Nenhum contrato encontrado no CRM");
      return null;
    }

    // Mapear contratos para pontos de instalação
    const points: InstallationPoint[] = contracts
      .filter((contract: any) => contract.BAIRRO && contract.CIDADE)
      .map((contract: any, index: number) => {
        // Extrair número do ponto (se começar com número no nome)
        const nomeMatch = contract.nomeCliente?.match(/^(\d+)\s+(.+)$/) || null;
        const pontoNumero = nomeMatch ? nomeMatch[1] : (index + 1).toString();
        const nomeCliente = nomeMatch ? nomeMatch[2] : contract.nomeCliente;

        return {
          numero: pontoNumero,
          nomeCliente: nomeCliente || "Cliente",
          endereco: contract.ENDERECO || "",
          bairro: contract.BAIRRO || "",
          cidade: contract.CIDADE || "",
          complemento: contract.COMPLEMENTO || "",
          login: contract.LOGIN || "",
          plano: contract.plano || "",
        };
      });

    if (points.length === 0) {
      console.log("⚠️ [Massive Failure] Nenhum ponto válido encontrado (BAIRRO/CIDADE ausentes)");
      return null;
    }

    console.log(`✅ [Massive Failure] ${points.length} ponto(s) de instalação encontrado(s) no CRM`);
    points.forEach(p => {
      console.log(`   📍 Ponto ${p.numero}: ${p.cidade}/${p.bairro} - ${p.endereco}`);
    });

    return points;
  } catch (error) {
    console.error("❌ [Massive Failure] Erro ao consultar CRM:", error);
    return null;
  }
}

/**
 * Resultado da verificação de falha massiva
 */
export interface MassiveFailureCheckResult {
  hasMultiplePoints: boolean;
  points?: InstallationPoint[];
  notified: boolean;
  needsPointSelection: boolean;
}

/**
 * Verifica se há falha massiva ativa para a região do cliente
 * Se houver múltiplos pontos, retorna flag indicando necessidade de seleção
 * Se houver apenas 1 ponto com falha, notifica o cliente automaticamente
 * @param conversationId - ID da conversa
 * @param clientPhone - Telefone do cliente
 * @param cpfCnpj - CPF/CNPJ do cliente
 * @param evolutionInstance - Instância Evolution API
 * @returns Resultado da verificação com flags de múltiplos pontos
 */
export async function checkAndNotifyMassiveFailure(
  conversationId: string,
  clientPhone: string,
  cpfCnpj: string | null,
  evolutionInstance: string,
  sendWhatsAppMessage: (phone: string, text: string, instance: string) => Promise<{success: boolean}>
): Promise<MassiveFailureCheckResult> {
  
  if (!cpfCnpj) {
    console.log("⚠️ [Massive Failure] CPF/CNPJ não disponível, pulando verificação");
    return { hasMultiplePoints: false, notified: false, needsPointSelection: false };
  }

  // 1. Consultar CRM para obter pontos de instalação
  const points = await fetchClientInstallationPoints(cpfCnpj);
  
  if (!points || points.length === 0) {
    console.log("⚠️ [Massive Failure] Nenhum ponto de instalação encontrado");
    return { hasMultiplePoints: false, notified: false, needsPointSelection: false };
  }

  // 2. Se houver múltiplos pontos, retornar flag para IA perguntar ao cliente
  if (points.length > 1) {
    console.log(`🔀 [Massive Failure] Cliente possui ${points.length} pontos de instalação - requer seleção`);
    return {
      hasMultiplePoints: true,
      points,
      notified: false,
      needsPointSelection: true,
    };
  }

  // 3. Apenas 1 ponto - verificar falha automaticamente
  const singlePoint = points[0];
  const activeFailure = await storage.checkActiveFailureForRegion(singlePoint.cidade, singlePoint.bairro);
  
  if (!activeFailure) {
    console.log(`✅ [Massive Failure] Nenhuma falha ativa para ${singlePoint.cidade}/${singlePoint.bairro}`);
    return { hasMultiplePoints: false, notified: false, needsPointSelection: false };
  }

  console.log(`🚨 [Massive Failure] Falha ativa detectada: ${activeFailure.name} - ${activeFailure.description}`);
  console.log(`📍 [Massive Failure] Região afetada: ${singlePoint.cidade}/${singlePoint.bairro}`);

  // 4. Verificar se cliente já foi notificado desta falha
  const existingNotifications = await storage.getFailureNotificationsByFailureId(activeFailure.id);
  const alreadyNotified = existingNotifications.some(n => n.clientPhone === clientPhone);

  if (alreadyNotified) {
    console.log(`⏭️ [Massive Failure] Cliente ${clientPhone} já foi notificado desta falha`);
    return { hasMultiplePoints: false, notified: true, needsPointSelection: false };
  }

  // 5. Enviar mensagem de notificação via WhatsApp
  const messageSent = await sendWhatsAppMessage(
    clientPhone,
    activeFailure.notificationMessage,
    evolutionInstance
  );

  if (!messageSent.success) {
    console.error(`❌ [Massive Failure] Falha ao enviar mensagem de notificação para ${clientPhone}`);
    return { hasMultiplePoints: false, notified: false, needsPointSelection: false };
  }

  console.log(`✅ [Massive Failure] Mensagem de notificação enviada para ${clientPhone}`);

  // 6. Registrar notificação no banco
  try {
    await storage.addFailureNotification({
      failureId: activeFailure.id,
      conversationId,
      clientPhone,
      notificationType: "failure",
      wasRead: false,
    });
    console.log(`📝 [Massive Failure] Notificação registrada no banco`);
  } catch (error) {
    console.error("❌ [Massive Failure] Erro ao registrar notificação:", error);
  }

  // 7. Transferir conversa para atendimento humano (semi-bloqueio)
  try {
    await storage.updateConversation(conversationId, {
      transferredToHuman: true,
      department: "support"
    });
    console.log(`👤 [Massive Failure] Conversa transferida para atendimento humano`);
  } catch (error) {
    console.error("❌ [Massive Failure] Erro ao transferir conversa:", error);
  }

  return { hasMultiplePoints: false, notified: true, needsPointSelection: false };
}
