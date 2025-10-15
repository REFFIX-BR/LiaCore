import { addKnowledgeChunks } from "../server/lib/upstash";

const devolucaoKnowledge = [
  {
    id: "rag-devolucao-001",
    name: "Devolução de Equipamentos - Modalidade Comodato",
    content: "IMPORTANTE: Todos os equipamentos fornecidos pela TR Telecom (roteadores, ONUs, fontes de energia, cabos) são de propriedade da empresa e entregues na modalidade COMODATO. Isso significa que o cliente tem apenas o direito de uso temporário dos equipamentos durante a vigência do contrato. Em caso de cancelamento, inadimplência ou suspensão do serviço, o cliente tem a OBRIGAÇÃO LEGAL de devolver TODOS os equipamentos em até 15 dias. A não devolução pode resultar em: 1) Cobrança do valor dos equipamentos (até R$ 500,00), 2) Negativação do nome em órgãos de proteção ao crédito (SPC/Serasa), 3) Processo judicial de busca e apreensão. A devolução evita essas consequências e encerra o relacionamento de forma cordial.",
    source: "Manual de Políticas e Procedimentos TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "comodato-obrigatoriedade",
      keywords: ["comodato", "obrigação", "devolução", "equipamentos", "cancelamento", "inadimplência", "negativação"]
    }
  },
  {
    id: "rag-devolucao-002", 
    name: "Pontos de Devolução - Três Rios",
    content: "TRÊS RIOS - Pontos autorizados para devolução de equipamentos:\n\n1. Loja TR Telecom - Rua Nelson Viana, 513, Centro (ponto oficial, aceita devolução em qualquer horário comercial de seg a sex 8h-18h e sáb 8h-12h)\n\n2. Barbearia Palácius - Rua Professor Moreira, 597, Vila Isabel (parceiro autorizado, seg a sáb 9h-19h)\n\n3. Mercadinho do Carlinho - Av. Prefeito Samir Nasser, 777, Palmital (parceiro autorizado, seg a dom 7h-20h)\n\nRECOMENDAÇÃO: Para clientes da região central, a Loja TR Telecom é a opção mais conveniente. Para moradores de Vila Isabel, a Barbearia Palácius fica mais próxima. Clientes do bairro Palmital podem usar o Mercadinho do Carlinho.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-tres-rios",
      cidade: "Três Rios",
      keywords: ["três rios", "endereço", "local", "onde devolver", "ponto de devolução", "centro", "vila isabel", "palmital"]
    }
  },
  {
    id: "rag-devolucao-003",
    name: "Pontos de Devolução - Paraíba do Sul",
    content: "PARAÍBA DO SUL - Pontos autorizados para devolução de equipamentos:\n\n1. Loja TR Telecom - Rua Dr. Alexandre Abraão, 31 (Descida do Andrade Figueira) - ponto oficial, seg a sex 8h-18h e sáb 8h-12h\n\n2. Loja Pro Lar - Av. Randolfo Pena, 849 (em frente ao CIEP) - parceiro autorizado, seg a sáb 8h-18h\n\nRECOMENDAÇÃO: Para clientes da região central/Andrade Figueira, a Loja TR Telecom é a melhor opção. Clientes próximos ao CIEP podem usar a Loja Pro Lar.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-paraiba-do-sul",
      cidade: "Paraíba do Sul",
      keywords: ["paraíba do sul", "endereço", "local", "onde devolver", "andrade figueira", "ciep"]
    }
  },
  {
    id: "rag-devolucao-004",
    name: "Pontos de Devolução - Bemposta",
    content: "BEMPOSTA - Ponto autorizado para devolução de equipamentos:\n\nPadaria São José - Rua Werneck, próximo à praça (parceiro autorizado, seg a dom 6h-20h)\n\nRECOMENDAÇÃO: Único ponto em Bemposta, atende toda a região. Localização central, próximo à praça principal.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-bemposta",
      cidade: "Bemposta",
      keywords: ["bemposta", "endereço", "local", "onde devolver", "praça"]
    }
  },
  {
    id: "rag-devolucao-005",
    name: "Pontos de Devolução - Chiador, Parada Braga e Penha Longa",
    content: "CHIADOR / PARADA BRAGA / PENHA LONGA - Pontos autorizados para devolução de equipamentos:\n\n1. Doctor Cell (Loja do Luam) - Rua Tenente Ademar Martins, 91 (parceiro autorizado, seg a sáb 9h-18h)\n\n2. Mercadinho do Luam - Rua João Braga (parceiro autorizado, seg a dom 7h-20h)\n\n3. LN Materiais de Construção (Ratão) - Rua Mariano Ribeiro, 342 (parceiro autorizado, seg a sex 8h-18h, sáb 8h-12h)\n\nRECOMENDAÇÃO: Para clientes de Chiador, a Doctor Cell é mais conveniente. Moradores de Parada Braga podem usar o Mercadinho do Luam. Clientes de Penha Longa têm a LN Materiais de Construção como opção próxima.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-chiador-region",
      cidade: "Chiador, Parada Braga, Penha Longa",
      keywords: ["chiador", "parada braga", "penha longa", "endereço", "local", "onde devolver"]
    }
  },
  {
    id: "rag-devolucao-006",
    name: "Pontos de Devolução - Levy Gasparian",
    content: "LEVY GASPARIAN - Ponto autorizado para devolução de equipamentos:\n\nV Versatol Store - Rua Dr. Melo Brandão, 44 (parceiro autorizado, seg a sex 9h-18h, sáb 9h-13h)\n\nRECOMENDAÇÃO: Único ponto em Levy Gasparian, atende toda a região. Localização central na Rua Dr. Melo Brandão.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-levy-gasparian",
      cidade: "Levy Gasparian",
      keywords: ["levy gasparian", "endereço", "local", "onde devolver"]
    }
  },
  {
    id: "rag-devolucao-007",
    name: "Pontos de Devolução - Santana do Deserto",
    content: "SANTANA DO DESERTO - Ponto autorizado para devolução de equipamentos:\n\nBarbearia Cortes e Cia - Praça Antônio Porto, 194, Centro (parceiro autorizado, seg a sáb 9h-19h)\n\nRECOMENDAÇÃO: Único ponto em Santana do Deserto, atende toda a região. Localização central na Praça Antônio Porto.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-santana-deserto",
      cidade: "Santana do Deserto",
      keywords: ["santana do deserto", "endereço", "local", "onde devolver", "praça antônio porto"]
    }
  },
  {
    id: "rag-devolucao-008",
    name: "Pontos de Devolução - Simão Pereira",
    content: "SIMÃO PEREIRA - Ponto autorizado para devolução de equipamentos:\n\nPadaria e Mercearia do Grande Luiz - Rua Giacomo, 160, Centro (parceiro autorizado, seg a dom 6h-20h)\n\nRECOMENDAÇÃO: Único ponto em Simão Pereira, atende toda a região. Localização central na Rua Giacomo.",
    source: "Guia de Pontos de Atendimento TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "pontos-simao-pereira",
      cidade: "Simão Pereira",
      keywords: ["simão pereira", "endereço", "local", "onde devolver"]
    }
  },
  {
    id: "rag-devolucao-009",
    name: "Procedimento de Devolução e Tom de Atendimento",
    content: "FLUXO DE ATENDIMENTO PARA DEVOLUÇÃO:\n\n1. SAUDAÇÃO EMPÁTICA: 'Olá! Que bom falar com você novamente! Estamos aqui para te ajudar a resolver qualquer pendência.'\n\n2. ORIENTAÇÃO SOBRE DEVOLUÇÃO: 'Ok, sentiremos a sua falta! Por gentileza, leve os equipamentos da TR Telecom até um de nossos pontos autorizados para devolução. Isso evita cobranças futuras e negativação.'\n\n3. INFORMAR PONTOS DE DEVOLUÇÃO: Listar os pontos mais próximos da LOCALIDADE DO CLIENTE (perguntar onde mora se necessário)\n\n4. ENCERRAMENTO CORDIAL: 'Ficamos à disposição caso precise de ajuda! A TR Telecom agradece seu contato.'\n\nTOM DE VOZ: Cordial, empático e profissional. Sempre mostre disposição para ajudar. Emojis permitidos com moderação (1-2 por mensagem). NUNCA seja agressivo ou ameaçador ao falar sobre cobranças - apenas informe os fatos de forma clara e respeitosa.",
    source: "Manual de Atendimento ao Cliente TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "procedimento-atendimento",
      keywords: ["atendimento", "tom de voz", "como falar", "script", "procedimento", "empatia"]
    }
  },
  {
    id: "rag-devolucao-010",
    name: "Equipamentos que Devem Ser Devolvidos",
    content: "EQUIPAMENTOS QUE DEVEM SER DEVOLVIDOS:\n\n1. Roteador Wi-Fi (fornecido em comodato pela TR Telecom)\n2. ONU/ONT (equipamento de fibra óptica)\n3. Fonte de alimentação do roteador\n4. Fonte de alimentação da ONU\n5. Cabos de rede (cabo ethernet fornecido pela TR)\n6. Qualquer outro equipamento identificado com o logo ou patrimônio TR Telecom\n\nIMPORTANTE: Cliente pode ficar com cabos de rede que ele mesmo comprou. Devolver APENAS equipamentos fornecidos pela TR Telecom em comodato. Se houver dúvida sobre qual equipamento devolver, orientar o cliente a levar todos os equipamentos relacionados à instalação - o atendente no ponto de devolução fará a triagem.",
    source: "Manual de Equipamentos TR Telecom",
    metadata: { 
      category: "devolucao", 
      topic: "lista-equipamentos",
      keywords: ["quais equipamentos", "o que devolver", "roteador", "onu", "fonte", "cabo"]
    }
  }
];

async function main() {
  console.log("📚 Adicionando conhecimento sobre devolução de equipamentos ao RAG...");
  
  try {
    await addKnowledgeChunks(devolucaoKnowledge);
    console.log("✅ RAG de devolução de equipamentos adicionado com sucesso!");
    console.log(`📊 Total de chunks adicionados: ${devolucaoKnowledge.length}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao adicionar RAG:", error);
    process.exit(1);
  }
}

main();
