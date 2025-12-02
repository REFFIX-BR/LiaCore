import { storage } from "../storage";
import { redis } from "./redis-config";

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
 * PRIVATE: Consulta a API check_pppoe_status (sem cache) para obter informações de pontos de instalação
 * IMPORTANTE: Usa check_pppoe_status porque retorna o ENDEREÇO DE INSTALAÇÃO correto de cada login
 * A API infoscontrato retorna apenas o endereço de cobrança (mesmo para todos os pontos)
 * Use `fetchClientInstallationPoints` com cache ao invés dessa função
 */
async function fetchClientInstallationPointsFromCRM(cpfCnpj: string): Promise<InstallationPoint[] | null> {
  const CRM_API_URL = "https://webhook.trtelecom.net/webhook/check_pppoe_status";
  
  if (!cpfCnpj) {
    console.log("⚠️ [Installation Points] CPF/CNPJ não fornecido");
    return null;
  }

  try {
    // IMPORTANTE: check_pppoe_status é POST com body JSON
    const response = await fetch(CRM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documento: cpfCnpj }),
    });

    if (!response.ok) {
      console.error(`❌ [Installation Points] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    // Verificar se a resposta tem conteúdo antes de tentar fazer parse
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log(`⚠️ [Installation Points] API retornou resposta vazia para CPF/CNPJ ${cpfCnpj}`);
      return null;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`❌ [Installation Points] Erro ao fazer parse do JSON. Resposta: "${text.substring(0, 200)}"`);
      return null;
    }
    
    // check_pppoe_status retorna array de conexões (cliente pode ter múltiplos pontos)
    const connections = Array.isArray(data) ? data : [data];
    
    if (connections.length === 0) {
      console.log("⚠️ [Installation Points] Nenhuma conexão encontrada");
      return null;
    }

    // Mapear conexões para pontos de instalação
    // check_pppoe_status retorna o ENDEREÇO DE INSTALAÇÃO correto de cada login
    const points: InstallationPoint[] = connections
      .filter((conn: any) => conn.BAIRRO && conn.CIDADE)
      .map((conn: any, index: number) => {
        return {
          numero: (index + 1).toString(),
          nomeCliente: conn.nomeCliente || conn.NOME || "Cliente",
          endereco: conn.ENDERECO || "",
          bairro: conn.BAIRRO || "",
          cidade: conn.CIDADE || "",
          complemento: conn.COMPLEMENTO || "",
          login: conn.LOGIN || "",
          plano: conn.plano || conn.PLANO || "",
        };
      });

    if (points.length === 0) {
      console.log("⚠️ [Installation Points] Nenhum ponto válido encontrado (BAIRRO/CIDADE ausentes)");
      return null;
    }

    console.log(`✅ [Installation Points] ${points.length} ponto(s) de instalação encontrado(s) via check_pppoe_status`);
    points.forEach(p => {
      console.log(`   📍 Ponto ${p.numero} (Login ${p.login}): ${p.cidade}/${p.bairro} - ${p.endereco} ${p.complemento}`);
    });

    return points;
  } catch (error) {
    console.error("❌ [Installation Points] Erro ao consultar API:", error);
    return null;
  }
}

/**
 * Consulta pontos de instalação do cliente com CACHE de 5 minutos
 * Evita consultas repetidas ao CRM durante o mesmo atendimento
 * @param cpfCnpj - CPF/CNPJ do cliente
 * @returns Array de pontos de instalação ou null se não encontrado
 */
export async function fetchClientInstallationPoints(cpfCnpj: string): Promise<InstallationPoint[] | null> {
  if (!cpfCnpj) {
    return null;
  }

  const cacheKey = `massive:points:${cpfCnpj}`;
  const CACHE_TTL = 300; // 5 minutos

  try {
    // 1. Tentar obter do cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      // Upstash Redis pode retornar string ou objeto já parseado
      const points = typeof cached === 'string' ? JSON.parse(cached) : cached;
      console.log(`💾 [Massive Failure Cache] Cache HIT para CPF ${cpfCnpj} - ${points.length} pontos`);
      return points;
    }

    // 2. Cache MISS - buscar do CRM
    console.log(`🔍 [Massive Failure Cache] Cache MISS para CPF ${cpfCnpj} - consultando CRM...`);
    const points = await fetchClientInstallationPointsFromCRM(cpfCnpj);

    // 3. Armazenar no cache se encontrou pontos
    if (points && points.length > 0) {
      await redis.set(cacheKey, JSON.stringify(points), { ex: CACHE_TTL });
      console.log(`💾 [Massive Failure Cache] Pontos armazenados no cache (TTL: ${CACHE_TTL}s)`);
    }

    return points;
  } catch (error) {
    console.error("❌ [Massive Failure Cache] Erro no sistema de cache:", error);
    // Fallback: tentar buscar direto do CRM se cache falhar
    return await fetchClientInstallationPointsFromCRM(cpfCnpj);
  }
}

/**
 * Resultado da verificação de falha massiva
 */
export interface MassiveFailureCheckResult {
  hasMultiplePoints: boolean;
  points?: InstallationPoint[];
  justNotified: boolean; // Acabou de notificar AGORA (primeira vez)
  alreadyNotified: boolean; // Cliente já foi notificado ANTES
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
    return { hasMultiplePoints: false, justNotified: false, alreadyNotified: false, needsPointSelection: false };
  }

  // 1. Consultar CRM para obter pontos de instalação
  const points = await fetchClientInstallationPoints(cpfCnpj);
  
  if (!points || points.length === 0) {
    console.log("⚠️ [Massive Failure] Nenhum ponto de instalação encontrado");
    return { hasMultiplePoints: false, justNotified: false, alreadyNotified: false, needsPointSelection: false };
  }

  // 2. Verificar falhas massivas em TODOS os pontos de instalação
  const pointsWithFailures: Array<{ point: InstallationPoint; failure: any }> = [];
  
  for (const point of points) {
    const activeFailure = await storage.checkActiveFailureForRegion(point.cidade, point.bairro);
    if (activeFailure) {
      console.log(`🚨 [Massive Failure] Falha detectada em ${point.cidade}/${point.bairro}: ${activeFailure.name}`);
      pointsWithFailures.push({ point, failure: activeFailure });
    }
  }

  // 3. Se NENHUM ponto tem falha massiva
  if (pointsWithFailures.length === 0) {
    console.log(`✅ [Massive Failure] Nenhuma falha ativa nos ${points.length} ponto(s) do cliente`);
    
    // Se houver múltiplos pontos sem falhas, ainda retornar flag para IA gerenciar
    if (points.length > 1) {
      return {
        hasMultiplePoints: true,
        points,
        justNotified: false,
        alreadyNotified: false,
        needsPointSelection: true,
      };
    }
    
    return { hasMultiplePoints: false, justNotified: false, alreadyNotified: false, needsPointSelection: false };
  }

  // 4. Há falha(s) massiva(s) em um ou mais pontos
  console.log(`⚠️ [Massive Failure] ${pointsWithFailures.length} ponto(s) com falha massiva ativa`);

  // 5. Verificar se cliente já foi notificado de ALGUMA dessas falhas
  const allFailureIds = pointsWithFailures.map(pf => pf.failure.id);
  let alreadyNotified = false;
  
  for (const failureId of allFailureIds) {
    const notifications = await storage.getFailureNotificationsByFailureId(failureId);
    if (notifications.some(n => n.clientPhone === clientPhone)) {
      alreadyNotified = true;
      console.log(`⏭️ [Massive Failure] Cliente ${clientPhone} já foi notificado de falha ${failureId}`);
      break;
    }
  }

  if (alreadyNotified) {
    console.log(`✅ [Massive Failure] Cliente já notificado - IA continua atendimento normalmente`);
    // Ainda retornar múltiplos pontos se aplicável para contexto da IA
    if (points.length > 1) {
      return {
        hasMultiplePoints: true,
        points,
        justNotified: false,
        alreadyNotified: true,
        needsPointSelection: true,
      };
    }
    return { hasMultiplePoints: false, justNotified: false, alreadyNotified: true, needsPointSelection: false };
  }

  // 6. Montar mensagem de notificação considerando múltiplos pontos
  let notificationMessage = '';
  
  if (pointsWithFailures.length === 1) {
    // Apenas 1 ponto com falha
    const { point, failure } = pointsWithFailures[0];
    
    if (points.length > 1) {
      // Cliente tem múltiplos pontos, mas só 1 está em área de falha
      notificationMessage = `🚨 *AVISO DE FALHA MASSIVA*\n\n${failure.notificationMessage}\n\n📍 *Endereço afetado:* ${point.bairro}, ${point.cidade}\n${point.endereco}${point.complemento ? ', ' + point.complemento : ''}`;
    } else {
      // Cliente tem apenas 1 ponto e está em área de falha
      notificationMessage = failure.notificationMessage;
    }
    
  } else {
    // Múltiplos pontos com falhas
    const affectedAddresses = pointsWithFailures
      .map(pf => `• ${pf.point.bairro}, ${pf.point.cidade} - ${pf.point.endereco}`)
      .join('\n');
    
    notificationMessage = `🚨 *AVISO DE FALHAS MASSIVAS*\n\nDetectamos falhas massivas em ${pointsWithFailures.length} dos seus endereços:\n\n${affectedAddresses}\n\n${pointsWithFailures[0].failure.notificationMessage}`;
  }

  // 7. Enviar mensagem de notificação via WhatsApp
  const messageSent = await sendWhatsAppMessage(
    clientPhone,
    notificationMessage,
    evolutionInstance
  );

  if (!messageSent.success) {
    console.error(`❌ [Massive Failure] Falha ao enviar mensagem de notificação para ${clientPhone}`);
    return { hasMultiplePoints: points.length > 1, points, justNotified: false, alreadyNotified: false, needsPointSelection: points.length > 1 };
  }

  console.log(`✅ [Massive Failure] Mensagem de notificação enviada para ${clientPhone}`);

  // 8. Registrar TODAS as notificações no banco
  for (const { failure } of pointsWithFailures) {
    try {
      await storage.addFailureNotification({
        failureId: failure.id,
        conversationId,
        clientPhone,
        notificationType: "failure",
        messageSent: notificationMessage,
        wasRead: false,
      });
      console.log(`📝 [Massive Failure] Notificação registrada para falha ${failure.id}`);
    } catch (error) {
      console.error(`❌ [Massive Failure] Erro ao registrar notificação para falha ${failure.id}:`, error);
    }
  }

  // 9. IA continua o atendimento após notificar sobre a falha massiva
  console.log(`🤖 [Massive Failure] Cliente ACABOU DE SER notificado - IA continua o atendimento normalmente`);

  return { 
    hasMultiplePoints: points.length > 1, 
    points, 
    justNotified: true, 
    alreadyNotified: false,
    needsPointSelection: points.length > 1 
  };
}
