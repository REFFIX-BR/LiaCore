import { addKnowledgeChunks } from "../server/lib/upstash";

/**
 * Script para adicionar/atualizar informações de preços e especificações técnicas do TR Telecom Câmeras
 */
async function updateCamerasPricing() {
  console.log("💰 Atualizando informações de preços e especificações do TR Telecom Câmeras...");

  const chunks = [
    {
      id: "cameras-pricing",
      name: "TR Telecom Câmeras - Preços e Valores",
      content: `PREÇOS DO TR TELECOM CÂMERAS:

VALOR MENSAL: R$ 30,00 por câmera
- Inclui locação da câmera
- Inclui armazenamento de 3 dias na nuvem
- Total mensal = R$ 30,00 x número de câmeras
- Exemplo: 2 câmeras = R$ 60,00/mês, 3 câmeras = R$ 90,00/mês

TAXA DE INSTALAÇÃO: R$ 50,00 por câmera (valor único)
- Cobrança única no momento da instalação
- Instalação profissional pela equipe TR Telecom
- Exemplo: 2 câmeras = R$ 100,00 de instalação, 3 câmeras = R$ 150,00 de instalação

FIDELIDADE: 18 meses (1 ano e meio)
- Contrato de permanência mínima de 18 meses

EXEMPLO DE INVESTIMENTO COMPLETO:
- 1 câmera: R$ 50,00 (instalação) + R$ 30,00/mês
- 2 câmeras: R$ 100,00 (instalação) + R$ 60,00/mês
- 3 câmeras: R$ 150,00 (instalação) + R$ 90,00/mês`,
      source: "TR Telecom Câmeras - Documentação Comercial",
      metadata: { category: "produto", tipo: "cameras-pricing" }
    },
    {
      id: "cameras-storage-policy",
      name: "TR Telecom Câmeras - Política de Armazenamento",
      content: `POLÍTICA DE ARMAZENAMENTO DO TR TELECOM CÂMERAS:

PERÍODO DE ARMAZENAMENTO: 3 (três) dias consecutivos
- As imagens ficam armazenadas por 3 dias na plataforma TR Telecom
- Acesso 24 horas por dia para download ou visualização
- Acesso via app móvel (iOS/Android) ou portal web em https://camera.trtelecom.net

EXCLUSÃO AUTOMÁTICA:
- As gravações são automaticamente excluídas após 3 dias para otimização do espaço
- O CONTRATANTE deve fazer o download das imagens relevantes ANTES do término do prazo de 3 dias
- Downloads são feitos em partes de 30 minutos
- A TR Telecom NÃO é responsável por perdas de imagens após o período de 3 dias

RECOMENDAÇÕES:
- Faça download das imagens importantes imediatamente
- Organize seus arquivos localmente
- Baixe em partes de 30 minutos para facilitar o gerenciamento
- Não confie apenas no armazenamento em nuvem para registros de longo prazo`,
      source: "TR Telecom Câmeras - Documentação Técnica",
      metadata: { category: "produto", tipo: "cameras-storage" }
    },
    {
      id: "cameras-technical-specs",
      name: "TR Telecom Câmeras - Especificações Técnicas",
      content: `ESPECIFICAÇÕES TÉCNICAS DO TR TELECOM CÂMERAS:

CÂMERAS:
- Protocolo: RTMP (Real-Time Messaging Protocol)
- Resolução: Full HD (1920x1080 pixels)
- Transmissão em tempo real
- Gravação contínua 24 horas

REQUISITOS DE INTERNET:
- Velocidade mínima de upload: 2 Mbps por câmera
- Exemplo: 1 câmera = 2 Mbps, 2 câmeras = 4 Mbps, 3 câmeras = 6 Mbps
- Conexão estável é essencial para transmissão contínua
- Recomenda-se internet TR Telecom para melhor compatibilidade

ARMAZENAMENTO EM NUVEM:
- Visualização em tempo real
- Gravações contínuas
- Armazenamento de 3 dias consecutivos
- Acesso via https://camera.trtelecom.net

SEGURANÇA E PRIVACIDADE:
- Confidencialidade garantida conforme LGPD (Lei Geral de Proteção de Dados)
- Data center certificado e seguro no Brasil
- Transmissão criptografada
- Proteção contra acessos não autorizados`,
      source: "TR Telecom Câmeras - Documentação Técnica",
      metadata: { category: "produto", tipo: "cameras-specs" }
    },
    {
      id: "cameras-access-platform",
      name: "TR Telecom Câmeras - Plataforma de Acesso",
      content: `PLATAFORMA DE ACESSO TR TELECOM CÂMERAS:

PORTAL WEB: https://camera.trtelecom.net
- Acesso via navegador em qualquer dispositivo
- Disponível 24 horas por dia
- Interface web completa e intuitiva

APLICATIVO MÓVEL:
- Disponível para iOS (iPhone/iPad)
- Disponível para Android (smartphones/tablets)
- Nome do app: TR Telecom Câmeras

FUNCIONALIDADES DE ACESSO:
- Visualização em tempo real
- Download de gravações (em partes de 30 minutos)
- Navegação pela linha do tempo
- Visualização em mosaico (múltiplas câmeras)
- Pesquisa de vídeos
- Compartilhamento com usuários autorizados
- Gerenciamento de registros salvos

ACESSO ILIMITADO:
- Número ilimitado de usuários simultâneos
- Compartilhe com pessoas de confiança
- Sem custo adicional por usuário extra`,
      source: "TR Telecom Câmeras - Documentação Técnica",
      metadata: { category: "produto", tipo: "cameras-access" }
    },
    {
      id: "cameras-lgpd-compliance",
      name: "TR Telecom Câmeras - Conformidade LGPD",
      content: `CONFORMIDADE COM A LGPD - TR TELECOM CÂMERAS:

O serviço TR Telecom Câmeras está em total conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018).

GARANTIAS DE PRIVACIDADE:
- Confidencialidade das imagens armazenadas
- Acesso restrito apenas a usuários autorizados
- Transmissão criptografada dos dados
- Armazenamento seguro em data center certificado no Brasil

PROTEÇÃO DE DADOS:
- Dados pessoais capturados pelas câmeras são protegidos
- Cumprimento das obrigações de controlador e operador de dados
- Políticas de retenção de dados (3 dias de armazenamento)
- Exclusão automática após o período estabelecido

RESPONSABILIDADES:
- TR Telecom: Garantir segurança técnica e confidencialidade
- CONTRATANTE: Uso adequado das câmeras conforme LGPD
- Ambos: Respeitar direitos dos titulares de dados (pessoas filmadas)

DIREITOS DOS TITULARES:
- Acesso aos dados
- Correção de dados
- Exclusão de dados (mediante solicitação dentro do prazo de 3 dias)`,
      source: "TR Telecom Câmeras - Documentação Legal",
      metadata: { category: "produto", tipo: "cameras-lgpd" }
    },
    {
      id: "cameras-contract-terms",
      name: "TR Telecom Câmeras - Termos Contratuais",
      content: `TERMOS CONTRATUAIS - TR TELECOM CÂMERAS:

PERÍODO DE FIDELIDADE: 18 meses
- Contrato de permanência mínima de 1 ano e 6 meses
- Início da contagem: data de ativação do serviço

VALORES:
- Mensalidade: R$ 30,00 por câmera
- Taxa de instalação: R$ 50,00 por câmera (valor único)
- Sem taxa de adesão adicional

RESPONSABILIDADES DO CONTRATANTE:
- Manter conexão de internet estável (mínimo 2 Mbps upload por câmera)
- Fazer download das imagens relevantes dentro do prazo de 3 dias
- Usar as câmeras conforme LGPD e legislação vigente
- Cumprir período de fidelidade de 18 meses

RESPONSABILIDADES DA TR TELECOM:
- Instalação profissional das câmeras
- Manutenção do sistema de armazenamento em nuvem
- Garantir disponibilidade do serviço 24/7
- Suporte técnico
- Conformidade com LGPD

IMPORTANTE:
- TR Telecom NÃO é responsável por perda de imagens após 3 dias
- Download das gravações deve ser feito em partes de 30 minutos
- Exclusão automática das gravações para otimização de espaço`,
      source: "TR Telecom Câmeras - Documentação Contratual",
      metadata: { category: "produto", tipo: "cameras-contract" }
    }
  ];

  try {
    await addKnowledgeChunks(chunks);
    console.log("✅ Informações de preços e especificações atualizadas com sucesso!");
    console.log(`📊 Total de chunks adicionados: ${chunks.length}`);
  } catch (error) {
    console.error("❌ Erro ao atualizar informações:", error);
    process.exit(1);
  }
}

// Executar o script
updateCamerasPricing()
  .then(() => {
    console.log("🎉 Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
