import { addKnowledgeChunks } from '../lib/upstash';

async function addCarneKnowledge() {
  console.log('📚 Adicionando documento sobre Carnê de Pagamento...');
  
  const chunks = [{
    id: "kb-carne-pagamento-2025",
    name: "Carnê de Pagamento - Físico e Digital",
    content: `🟩 Informativo Importante – Emissão de Carnê Físico e Digital

Prezado cliente,

Informamos que o carnê físico somente pode ser adquirido presencialmente em uma de nossas lojas.

📍 Unidades disponíveis:

Três Rios: Rua Nelson Viana, nº 513

Paraíba do Sul: Rua Dr. Alexandre Abraão, nº 31
📌 Referência: Descida do Andrade Figueira

🕒 Horário de funcionamento:

Segunda a sexta-feira: das 8h00 às 18h00

Sábados: das 8h00 às 13h00

Ao visitar uma de nossas lojas, basta solicitar o carnê na recepção, e ele será emitido na hora, de forma rápida e prática.

💻 Opção digital:
Caso prefira, você também pode solicitar o carnê digital diretamente a um de nossos atendentes humanos.
O carnê digital é enviado pelo WhatsApp, em formato PDF, contendo todos os boletos dos próximos meses, garantindo ainda mais comodidade e praticidade para você.

📱 Central do Assinante TR Telecom:
Outra opção é acessar a Central do Assinante TR Telecom, onde você pode consultar seus boletos e muito mais!
Basta baixar o aplicativo no seu celular:

Android: busque por Central do Assinante TR Telecom na Play Store

iPhone (iOS): busque por Central do Assinante TR Telecom na App Store

Caso tenha qualquer dúvida, nossa equipe está à disposição para orientar e fornecer as informações necessárias para que você possa acessar o app com facilidade.

Agradecemos sua compreensão e preferência!`,
    source: "Manual de Atendimento TR Telecom 2025",
    metadata: {
      category: "financeiro",
      topic: "pagamento",
      subtopic: "carnê",
      date: "2025-01-28"
    }
  }];

  try {
    await addKnowledgeChunks(chunks);
    console.log('✅ Documento sobre Carnê de Pagamento adicionado com sucesso!');
    console.log(`   - ID: ${chunks[0].id}`);
    console.log(`   - Nome: ${chunks[0].name}`);
    console.log(`   - Categoria: ${chunks[0].metadata?.category}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao adicionar documento:', error);
    process.exit(1);
  }
}

addCarneKnowledge();
