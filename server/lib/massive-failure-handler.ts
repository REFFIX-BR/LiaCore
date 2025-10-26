import { storage } from "../storage";

/**
 * Consulta a API CRM para obter informações de região do cliente
 * @param cpfCnpj - CPF/CNPJ do cliente
 * @returns {city, neighborhood} ou null se não encontrado
 */
export async function fetchClientRegionFromCRM(cpfCnpj: string): Promise<{ city: string; neighborhood: string } | null> {
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

    if (data && data.BAIRRO && data.CIDADE) {
      console.log(`✅ [Massive Failure] Região obtida do CRM: ${data.CIDADE}/${data.BAIRRO}`);
      return {
        city: data.CIDADE,
        neighborhood: data.BAIRRO,
      };
    }

    console.log("⚠️ [Massive Failure] Região não encontrada no CRM");
    return null;
  } catch (error) {
    console.error("❌ [Massive Failure] Erro ao consultar CRM:", error);
    return null;
  }
}

/**
 * Verifica se há falha massiva ativa para a região do cliente
 * Se houver, notifica o cliente automaticamente
 * @param conversationId - ID da conversa
 * @param clientPhone - Telefone do cliente
 * @param cpfCnpj - CPF/CNPJ do cliente
 * @param evolutionInstance - Instância Evolution API
 * @returns true se cliente foi notificado de falha massiva, false caso contrário
 */
export async function checkAndNotifyMassiveFailure(
  conversationId: string,
  clientPhone: string,
  cpfCnpj: string | null,
  evolutionInstance: string,
  sendWhatsAppMessage: (phone: string, text: string, instance: string) => Promise<{success: boolean}>
): Promise<boolean> {
  
  if (!cpfCnpj) {
    console.log("⚠️ [Massive Failure] CPF/CNPJ não disponível, pulando verificação");
    return false;
  }

  // 1. Consultar CRM para obter região
  const region = await fetchClientRegionFromCRM(cpfCnpj);
  
  if (!region) {
    console.log("⚠️ [Massive Failure] Região não disponível, pulando verificação");
    return false;
  }

  // 2. Verificar se há falha ativa para esta região
  const activeFailure = await storage.checkActiveFailureForRegion(region.city, region.neighborhood);
  
  if (!activeFailure) {
    return false;
  }

  console.log(`🚨 [Massive Failure] Falha ativa detectada: ${activeFailure.name} - ${activeFailure.description}`);
  console.log(`📍 [Massive Failure] Região afetada: ${region.city}/${region.neighborhood}`);

  // 3. Verificar se cliente já foi notificado desta falha
  const existingNotifications = await storage.getFailureNotificationsByFailureId(activeFailure.id);
  const alreadyNotified = existingNotifications.some(n => n.clientPhone === clientPhone);

  if (alreadyNotified) {
    console.log(`⏭️ [Massive Failure] Cliente ${clientPhone} já foi notificado desta falha`);
    return true; // Retorna true pois existe falha ativa (não processar normalmente)
  }

  // 4. Enviar mensagem de notificação via WhatsApp
  const messageSent = await sendWhatsAppMessage(
    clientPhone,
    activeFailure.notificationMessage,
    evolutionInstance
  );

  if (!messageSent.success) {
    console.error(`❌ [Massive Failure] Falha ao enviar mensagem de notificação para ${clientPhone}`);
    return false;
  }

  console.log(`✅ [Massive Failure] Mensagem de notificação enviada para ${clientPhone}`);

  // 5. Registrar notificação no banco
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

  // 6. Transferir conversa para atendimento humano (semi-bloqueio)
  try {
    await storage.updateConversation(conversationId, {
      transferredToHuman: true,
      department: "support"
    });
    console.log(`👤 [Massive Failure] Conversa transferida para atendimento humano`);
  } catch (error) {
    console.error("❌ [Massive Failure] Erro ao transferir conversa:", error);
  }

  return true;
}
