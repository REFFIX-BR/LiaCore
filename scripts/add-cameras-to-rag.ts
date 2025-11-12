import { addKnowledgeChunks } from "../server/lib/upstash";

/**
 * Script para adicionar conhecimento sobre TR Telecom Câmeras ao RAG
 */
async function addCamerasKnowledge() {
  console.log("🎬 Iniciando adição de conhecimento sobre TR Telecom Câmeras...");

  const chunks = [
    {
      id: "cameras-overview",
      name: "TR Telecom Câmeras - Visão Geral",
      content: `O TR Telecom Câmeras é uma solução completa de monitoramento por assinatura que combina equipamento, software e armazenamento das imagens na nuvem. É um serviço de câmeras por assinatura que oferece o conforto do armazenamento em nuvem e uma plataforma de automonitoramento baseada em Cloud Computing. Com o TR Telecom Câmeras, você pode visualizar e gerenciar suas imagens de forma prática e eficiente.

O objetivo é fornecer um sistema avançado e eficiente para acelerar o tempo de resposta em casos de crimes contra pessoas, patrimônio e até mesmo para cuidar do seu pet que fica em casa sozinho.`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-seguranca" }
    },
    {
      id: "cameras-differential",
      name: "TR Telecom Câmeras - Diferencial",
      content: `Grande diferencial do TR Telecom Câmeras: Em comparação com outras soluções de câmeras com gravação em nuvem, entregamos a imagem em tempo real, sem atrasos, e com armazenamento em um Data Center certificado, garantindo segurança, confiabilidade e disponibilidade dos dados.

Diferente de soluções comuns, oferece streaming instantâneo e armazenamento confiável. As imagens são transmitidas de forma segura pela internet para o data center da TR Telecom, localizado no Brasil e certificado para alta segurança.`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-diferenciais" }
    },
    {
      id: "cameras-how-it-works",
      name: "TR Telecom Câmeras - Como Funciona",
      content: `Como funciona o TR Telecom Câmeras:

1. CAPTURA DAS IMAGENS: As câmeras de alta resolução são instaladas no local desejado (casa, escritório ou estabelecimento). Elas capturam as imagens em tempo real, 24 horas por dia, sem necessidade de configurações complexas. As câmeras suportam visualização ao vivo e gravação automática.

2. ENVIO E ARMAZENAMENTO NA NUVEM: As imagens são transmitidas de forma segura pela internet para o data center da TR Telecom, localizado no Brasil e certificado para alta segurança. Lá, elas são processadas, analisadas (para detecção de movimentos ou eventos) e armazenadas em nuvem, garantindo disponibilidade, backup automático e proteção contra perdas locais (como falhas de energia ou roubo do equipamento). O armazenamento mínimo é de 1 dia, mas pode ser personalizado.

3. ACESSO VIA APLICATIVO: Pelo app TR Telecom Câmeras (disponível para iOS e Android), você recebe os registros em tempo real no seu smartphone ou tablet.`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-funcionamento" }
    },
    {
      id: "cameras-features",
      name: "TR Telecom Câmeras - Funcionalidades",
      content: `Funcionalidades do TR Telecom Câmeras:

• Navegação pela linha do tempo das gravações armazenadas
• Visualização das câmeras em formato de mosaico
• Gerenciamento dos registros salvos, com opção de excluir ou compartilhar arquivos
• Possibilidade de favoritar câmeras específicas para acesso rápido
• Ferramenta de pesquisa para localizar vídeos salvos
• Armazenamento mínimo de 1 dia de imagens gravadas, com personalização disponível
• Acesso simultâneo e ilimitado de usuários - Compartilhe com pessoas de confiança para acompanharem as imagens em tempo real junto com você
• Monitoramento ao vivo 24 horas por dia
• Visualizar múltiplas câmeras em mosaico
• Pesquisar vídeos específicos
• Favoritar dispositivos
• Excluir ou compartilhar arquivos
• Grupos de câmeras e configurações personalizadas`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-funcionalidades" }
    },
    {
      id: "cameras-benefits",
      name: "TR Telecom Câmeras - Benefícios",
      content: `Benefícios principais do TR Telecom Câmeras:

• TEMPO REAL E SEM ATRASOS: Diferente de soluções comuns, oferece streaming instantâneo e armazenamento confiável
• SEGURANÇA AVANÇADA: Ideal para proteção contra crimes, monitoramento de patrimônio ou até pets em casa, acelerando respostas em emergências
• FACILIDADE PARA TODOS: Atende pessoas físicas, jurídicas e até órgãos governamentais, com instalação profissional e suporte da TR Telecom
• MOBILIDADE TOTAL: Monitore de qualquer lugar, com notificações push para alertas
• DATA CENTER CERTIFICADO: Armazenamento em data center brasileiro certificado, garantindo segurança, confiabilidade e disponibilidade dos dados
• BACKUP AUTOMÁTICO: Proteção contra perdas locais como falhas de energia ou roubo do equipamento
• APP INTUITIVO: Interface simples e fácil de usar, disponível para iOS e Android`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-beneficios" }
    },
    {
      id: "cameras-target-audience",
      name: "TR Telecom Câmeras - Público-Alvo",
      content: `O TR Telecom Câmeras atende a todos:

• PESSOAS FÍSICAS: Ideal para monitorar sua casa, família e pets
• PESSOAS JURÍDICAS: Perfeito para escritórios, lojas, estabelecimentos comerciais
• GOVERNO: Solução para órgãos governamentais que precisam de segurança e monitoramento

Casos de uso:
- Proteção contra crimes contra pessoas e patrimônio
- Monitoramento de pets em casa
- Segurança residencial
- Segurança comercial
- Vigilância de estabelecimentos
- Aceleração do tempo de resposta em emergências`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-publico" }
    },
    {
      id: "cameras-availability",
      name: "TR Telecom Câmeras - Disponibilidade",
      content: `Disponibilidade do TR Telecom Câmeras:

Embora o serviço ainda não esteja disponível em toda a nossa área de cobertura, estamos animados e trabalhando duro para expandir sua disponibilidade o mais rápido possível.

Se o serviço ainda não estiver disponível na sua região, fique de olho nas atualizações! Esta é uma oportunidade exclusiva de ser um dos primeiros a contratar essa inovação em segurança.

Para contratar ou mais detalhes, acesse o site da TR Telecom ou baixe o app TR Telecom Câmeras.`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-disponibilidade" }
    },
    {
      id: "cameras-app",
      name: "TR Telecom Câmeras - Aplicativo",
      content: `Aplicativo TR Telecom Câmeras:

O app TR Telecom Câmeras está disponível para iOS e Android, permitindo que você monitore de qualquer lugar, a qualquer momento.

Recursos do app:
• Monitoramento ao vivo em tempo real
• Navegação pela linha do tempo de gravações
• Visualização de múltiplas câmeras em mosaico
• Pesquisa de vídeos específicos
• Favoritar dispositivos para acesso rápido
• Excluir ou compartilhar arquivos
• Conceder acesso simultâneo e ilimitado a outros usuários de confiança (como familiares)
• Grupos de câmeras
• Configurações personalizadas
• Notificações push para alertas
• Interface intuitiva e fácil de usar

O app é intuitivo, com funções que garantem uma experiência sem complicações.`,
      source: "TR Telecom Câmeras - Documentação",
      metadata: { category: "produto", tipo: "cameras-app" }
    },
    {
      id: "cameras-pricing",
      name: "TR Telecom Câmeras - Preços e Condições Comerciais",
      content: `VALORES E CONDIÇÕES COMERCIAIS - TR TELECOM CÂMERAS

💰 PREÇOS:
• INSTALAÇÃO: R$ 50,00 por câmera (taxa única, cobrada uma só vez)
• MENSALIDADE: R$ 30,00 por câmera (recorrente)

📋 CARACTERÍSTICAS TÉCNICAS:
• GRAVAÇÃO: Até 72 horas (3 dias) de áudio e vídeo armazenados na nuvem
• ARMAZENAMENTO: Mínimo de 1 dia personalizável para até 72 horas
• QUALIDADE: Alta resolução (Full HD ou superior)
• DISPONIBILIDADE: Monitoramento 24 horas por dia, 7 dias por semana

📝 CONDIÇÕES CONTRATUAIS:
• FIDELIDADE: Contrato de 18 meses
• INSTALAÇÃO PROFISSIONAL: Incluída no valor de R$ 50,00 por câmera
• SUPORTE TÉCNICO: Incluso na mensalidade

🎯 EXEMPLOS DE CÁLCULO:
• 1 câmera: R$ 50,00 instalação + R$ 30,00/mês
• 2 câmeras: R$ 100,00 instalação + R$ 60,00/mês
• 3 câmeras: R$ 150,00 instalação + R$ 90,00/mês
• 4 câmeras: R$ 200,00 instalação + R$ 120,00/mês

⚠️ IMPORTANTE PARA VENDAS:
Quando cliente perguntar sobre câmeras, videomonitoramento ou segurança:
✅ SEMPRE informe que o serviço EXISTE e está disponível
✅ SEMPRE cite os valores: R$50 instalação + R$30/mês por câmera
✅ SEMPRE mencione gravação de até 72 horas
✅ NUNCA diga "não temos esse serviço" ou "não está disponível"

O serviço está em EXPANSÃO e disponível em algumas regiões de cobertura da TR Telecom.`,
      source: "TR Telecom Câmeras - Tabela de Preços 2025",
      metadata: { 
        category: "produto", 
        tipo: "cameras-precos",
        keywords: "videomonitoramento, preço, valor, quanto custa, mensalidade, instalação, câmera, segurança, CFTV"
      }
    }
  ];

  try {
    await addKnowledgeChunks(chunks);
    console.log("✅ Conhecimento sobre TR Telecom Câmeras adicionado com sucesso!");
    console.log(`📊 Total de chunks adicionados: ${chunks.length}`);
  } catch (error) {
    console.error("❌ Erro ao adicionar conhecimento:", error);
    process.exit(1);
  }
}

// Executar o script
addCamerasKnowledge()
  .then(() => {
    console.log("🎉 Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
