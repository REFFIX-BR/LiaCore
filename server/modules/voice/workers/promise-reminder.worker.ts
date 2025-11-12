import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../../lib/redis-config';
import { QUEUE_NAMES } from '../../../lib/queue';
import { db } from '../../../db';
import { voicePromises } from '../../../../shared/schema';
import { and, eq, lte, gte, isNull, sql } from 'drizzle-orm';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';

console.log('🔔 [Promise Reminder] Worker starting...');

/**
 * Worker que envia lembretes de pagamento no dia da promessa
 * 
 * Fluxo:
 * 1. Busca promessas que vencem HOJE
 * 2. Que ainda não receberam lembrete (reminderSent: false)
 * 3. Envia mensagem via WhatsApp
 * 4. Marca reminderSent: true
 */

const worker = new Worker(
  QUEUE_NAMES.VOICE_PROMISE_MONITOR,
  async (job: Job) => {
    console.log('🔔 [Promise Reminder] Checking for payment reminders...');
    
    try {
      // Data de hoje (início e fim do dia)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      console.log(`📅 [Promise Reminder] Searching promises due today: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);

      // Buscar promessas que vencem hoje e ainda não receberam lembrete
      const promisesToRemind = await db.query.voicePromises.findMany({
        where: and(
          eq(voicePromises.status, 'pending'),
          gte(voicePromises.dueDate, startOfDay),
          lte(voicePromises.dueDate, endOfDay),
          eq(voicePromises.reminderSent, false)
        )
      });

      console.log(`📊 [Promise Reminder] Found ${promisesToRemind.length} promise(s) to remind`);

      let sent = 0;
      let failed = 0;

      for (const promise of promisesToRemind) {
        try {
          console.log(`📱 [Promise Reminder] Sending reminder to ${promise.contactName} (${promise.phoneNumber})`);

          const amount = promise.promisedAmount ? (promise.promisedAmount / 100).toFixed(2) : 'não especificado';
          
          // Mensagem humanizada de lembrete
          const message = `Olá ${promise.contactName}! 😊

Aqui é a Lia da TR Telecom. 

🔔 **Lembrete Amigável**

Hoje é o dia que você se comprometeu a regularizar o pagamento de R$ ${amount}.

Você pode pagar agora mesmo via PIX ou Boleto. É só me chamar que eu te envio!

Obrigada pela sua confiança! 💙`;

          // Enviar via WhatsApp (instância Cobrança)
          await sendWhatsAppMessage(
            promise.phoneNumber.replace(/\D/g, ''), // Remove formatação
            message,
            'Cobrança'
          );

          // Marcar lembrete como enviado
          await db.update(voicePromises)
            .set({
              reminderSent: true,
              reminderSentAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(voicePromises.id, promise.id));

          console.log(`✅ [Promise Reminder] Reminder sent to ${promise.contactName}`);
          sent++;

        } catch (error) {
          console.error(`❌ [Promise Reminder] Failed to send reminder to ${promise.contactName}:`, error);
          failed++;
        }
      }

      console.log(`📊 [Promise Reminder] Summary: ${sent} sent, ${failed} failed`);

      return {
        success: true,
        checked: promisesToRemind.length,
        sent,
        failed
      };

    } catch (error) {
      console.error('❌ [Promise Reminder] Worker error:', error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Processar um por vez
  }
);

worker.on('completed', (job) => {
  console.log(`✅ [Promise Reminder] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Promise Reminder] Job ${job?.id} failed:`, err);
});

console.log('✅ [Promise Reminder] Worker ready');

export default worker;
