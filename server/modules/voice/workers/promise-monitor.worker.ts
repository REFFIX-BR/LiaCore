import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES } from '../../../lib/queue';
import { db } from '../../../db';
import { voicePromises, voiceCampaignTargets } from '../../../../shared/schema';
import { and, eq, lte, gte, lt } from 'drizzle-orm';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';

console.log('👁️ [Promise Monitor] Worker starting...');

/**
 * Worker Unificado de Monitoramento de Promessas
 * 
 * Funções:
 * 1. LEMBRETE: Envia lembretes no dia do vencimento
 * 2. QUEBRA: Marca como 'broken' promessas vencidas não cumpridas
 * 3. CUMPRIMENTO: Marca como 'fulfilled' promessas pagas
 */

const worker = new Worker(
  QUEUE_NAMES.VOICE_PROMISE_MONITOR,
  async (job: Job) => {
    console.log('👁️ [Promise Monitor] Running scheduled check...');
    
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // ===== TAREFA 1: ENVIAR LEMBRETES =====
      console.log('🔔 [Promise Monitor] Checking for payment reminders...');
      
      const promisesToRemind = await db.query.voicePromises.findMany({
        where: and(
          eq(voicePromises.status, 'pending'),
          gte(voicePromises.dueDate, startOfDay),
          lte(voicePromises.dueDate, endOfDay),
          eq(voicePromises.reminderSent, false)
        )
      });

      console.log(`📊 [Promise Monitor] Found ${promisesToRemind.length} promise(s) needing reminders`);

      let remindersSent = 0;
      for (const promise of promisesToRemind) {
        try {
          const amount = promise.promisedAmount ? (promise.promisedAmount / 100).toFixed(2) : 'não especificado';
          
          const message = `Olá ${promise.contactName}! 😊

Aqui é a Lia da TR Telecom. 

🔔 **Lembrete Amigável**

Hoje é o dia que você se comprometeu a regularizar o pagamento de R$ ${amount}.

Você pode pagar agora mesmo via PIX ou Boleto. É só me chamar que eu te envio!

Obrigada pela sua confiança! 💙`;

          await sendWhatsAppMessage(
            promise.phoneNumber.replace(/\D/g, ''),
            message,
            'Cobrança'
          );

          await db.update(voicePromises)
            .set({
              reminderSent: true,
              reminderSentAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(voicePromises.id, promise.id));

          console.log(`✅ [Promise Monitor] Reminder sent to ${promise.contactName}`);
          remindersSent++;

        } catch (error) {
          console.error(`❌ [Promise Monitor] Failed to send reminder:`, error);
        }
      }

      // ===== TAREFA 2: DETECTAR PROMESSAS QUEBRADAS =====
      console.log('💔 [Promise Monitor] Checking for broken promises...');
      
      const overduePromises = await db.query.voicePromises.findMany({
        where: and(
          eq(voicePromises.status, 'pending'),
          lt(voicePromises.dueDate, now)
        )
      });

      console.log(`📊 [Promise Monitor] Found ${overduePromises.length} overdue promise(s)`);

      let broken = 0;
      let fulfilled = 0;

      for (const promise of overduePromises) {
        try {
          // ============================================================================
          // CRITICAL: Verificação segura de pagamento via CRM
          // ============================================================================
          // Só marcamos a promessa como 'broken' se CONFIRMARMOS que o cliente NÃO pagou.
          // Se houver erro na consulta ao CRM, NÃO assumimos nada e pulamos essa promessa
          // para evitar marcar como inadimplente um cliente que já pagou.
          // ============================================================================
          
          let hasPaid = false;
          let verificationSuccessful = false;
          
          if (promise.contactDocument) {
            try {
              const documentoNormalizado = promise.contactDocument.replace(/\D/g, '');
              
              const response = await fetch("https://webhook.trtelecom.net/webhook/consulta_boleto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documento: documentoNormalizado }),
              });
              
              if (response.ok) {
                const boletos = await response.json() as any[];
                hasPaid = !boletos || boletos.length === 0;
                verificationSuccessful = true; // Verificação bem-sucedida!
              } else {
                console.warn(`⚠️ [Promise Monitor] CRM retornou HTTP ${response.status} - pulando promessa ${promise.id}`);
              }
            } catch (error) {
              console.error(`❌ [Promise Monitor] Erro ao verificar pagamento (CRM indisponível) - pulando promessa ${promise.id}:`, error);
            }
          } else {
            console.warn(`⚠️ [Promise Monitor] Promessa ${promise.id} sem CPF/CNPJ - impossível verificar pagamento`);
          }

          // ============================================================================
          // Só processar se a verificação foi bem-sucedida
          // ============================================================================
          if (!verificationSuccessful) {
            console.log(`⏭️ [Promise Monitor] Pulando promessa ${promise.id} - verificação não conclusiva (será tentada novamente)`);
            continue; // Pula para a próxima promessa
          }

          if (hasPaid) {
            // Cliente pagou!
            await db.update(voicePromises)
              .set({
                status: 'fulfilled',
                fulfilledAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(voicePromises.id, promise.id));

            console.log(`✅ [Promise Monitor] Promise ${promise.id} fulfilled - cliente pagou!`);
            fulfilled++;

          } else {
            // Cliente NÃO pagou (confirmado via CRM) - quebrou a promessa
            await db.update(voicePromises)
              .set({
                status: 'broken',
                brokenAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(voicePromises.id, promise.id));

            console.log(`💔 [Promise Monitor] Promise ${promise.id} broken - pagamento não detectado`);
            broken++;

            // Atualizar target para permitir novas cobranças
            if (promise.targetId) {
              await db.update(voiceCampaignTargets)
                .set({
                  state: 'contacted',
                  outcome: 'promise_broken',
                  outcomeDetails: 'Promessa não cumprida - cliente pode receber cobranças novamente',
                  updatedAt: new Date()
                })
                .where(eq(voiceCampaignTargets.id, promise.targetId));
            }
          }

        } catch (error) {
          console.error(`❌ [Promise Monitor] Failed to process promise:`, error);
        }
      }

      console.log(`📊 [Promise Monitor] Summary: ${remindersSent} reminders sent, ${broken} broken, ${fulfilled} fulfilled`);

      return {
        success: true,
        remindersSent,
        broken,
        fulfilled
      };

    } catch (error) {
      console.error('❌ [Promise Monitor] Worker error:', error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`✅ [Promise Monitor] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Promise Monitor] Job ${job?.id} failed:`, err);
});

console.log('✅ [Promise Monitor] Worker ready');

export default worker;
