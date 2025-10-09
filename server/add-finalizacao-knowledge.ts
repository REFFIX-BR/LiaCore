import { addKnowledgeChunk } from "./lib/upstash";

async function addFinalizacaoKnowledge() {
  console.log("📚 Adicionando documento sobre finalização de conversas...");
  
  const content = `PROCEDIMENTO: FINALIZAÇÃO DE CONVERSAS E ENVIO DE PESQUISA NPS

⚠️ REGRA CRÍTICA: Quando o problema do cliente estiver COMPLETAMENTE RESOLVIDO, você DEVE usar a ferramenta finalizar_conversa.

QUANDO FINALIZAR:
1. Problema do cliente foi 100% resolvido ✅
2. Não há pendências técnicas ou comerciais ✅
3. Cliente confirmou satisfação com frases como: "Tudo certo", "Resolvido", "Obrigado", "Valeu", "Funcionou", "Até mais" ✅

COMO FINALIZAR:
1. PRIMEIRO: Envie mensagem de despedida ao cliente
   Exemplo: "Que bom que pude ajudar! Qualquer coisa, estou por aqui 😊"

2. SEGUNDO: IMEDIATAMENTE após enviar a despedida, chame a ferramenta:
   finalizar_conversa({ motivo: "Problema resolvido" })

NÃO FINALIZE SE:
❌ Cliente ainda tem dúvidas
❌ Problema não foi totalmente resolvido  
❌ Vai transferir para atendimento humano (use transferir_para_humano)
❌ Precisa de mais informações

O QUE ACONTECE AO FINALIZAR:
✅ Conversa marcada como resolvida
✅ Cliente recebe pesquisa de satisfação NPS automaticamente via WhatsApp
✅ Sistema registra conclusão do atendimento
✅ Métricas são atualizadas

EXEMPLO PRÁTICO:
Cliente: "Funcionou! Muito obrigado!"
Assistente: "Que ótimo! Fico feliz em ajudar. Até mais! 😊"
[CHAMA finalizar_conversa com motivo: "Problema de conexão resolvido"]

IMPORTANTE: Sem chamar finalizar_conversa, o cliente NÃO receberá a pesquisa NPS e a conversa ficará em aberto.`;

  try {
    await addKnowledgeChunk(
      "kb-finalizar-conversa",
      content,
      "Manual de Procedimentos - Finalização de Conversas",
      "Como e Quando Finalizar Conversas - Função finalizar_conversa",
      {
        category: "procedimentos",
        topic: "finalizacao",
        priority: "critical",
        addedAt: new Date().toISOString()
      }
    );
    
    console.log("✅ Documento adicionado com sucesso!");
    console.log("📝 Os assistentes agora podem consultar: 'como finalizar conversa' ou 'quando usar finalizar_conversa'");
  } catch (error) {
    console.error("❌ Erro ao adicionar documento:", error);
    throw error;
  }
}

// Execute
addFinalizacaoKnowledge()
  .then(() => {
    console.log("🎉 Concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Falha:", error);
    process.exit(1);
  });
