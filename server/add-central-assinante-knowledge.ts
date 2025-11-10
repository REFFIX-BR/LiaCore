/**
 * Script para adicionar informações da Central do Assinante ao RAG
 * Processado de: central-do-assinante_1762779910295.md
 */

import { addKnowledgeChunks } from "./lib/upstash";

const centralAssinanteChunks = [
  {
    id: "kb-central-001",
    name: "Como acessar a Central do Assinante pelo site",
    content: `## Como acessar a Central do Assinante pelo site?

**Passo a passo:**
1. Acesse o site oficial da TR Telecom e use o menu superior fixo.
2. Clique na opção "Central", que direciona para a rota /portal.
3. Na página exibida, informe seu documento (CPF ou CNPJ, somente números) e a senha cadastrada.
4. Pressione "Entrar" para carregar o painel da Central do Assinante.
5. Caso existam múltiplos cadastros associados ao documento, selecione o endereço correto na lista apresentada e confirme o login.

**Observações importantes:**
- O login aceita apenas CPF ou CNPJ e a senha do assinante.
- Não há suporte a contas administrativas nesta orientação pública.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "acesso_login", priority: "high" }
  },

  {
    id: "kb-central-002",
    name: "Informações da tela inicial da Central do Assinante",
    content: `## Quais informações aparecem ao entrar na Central do Assinante?

A tela inicial mostra três cartões de resumo:

**1. Plano Atual:**
- Nome do plano ativo obtido do cadastro PPPoE

**2. Status da Rede:**
- Estado atual (por exemplo, ONLINE ou OFFLINE)

**3. Próximo Vencimento:**
- Data da próxima fatura disponível

Todos esses dados são carregados automaticamente após o login com o CPF ou CNPJ do titular.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "tela_inicial", priority: "medium" }
  },

  {
    id: "kb-central-003",
    name: "Aba Financeiro da Central do Assinante",
    content: `## O que está disponível na aba Financeiro?

A aba "Financeiro" apresenta:

**1. Fatura Atual:**
- Valor e data de vencimento da próxima cobrança
- Botão para baixar a 2ª via

**2. Liberação em Confiança:**
- Quando o status PPPoE indicar bloqueio, o assinante pode solicitar desbloqueio temporário

**3. Histórico de Faturas:**
- Lista ordenada com status (Pago, Pendente, Vencido)
- Acesso ao PDF de cada boleto

**4. Formas de Pagamento:**
- **Boleto bancário**: código de barras copiável e download do carnê
- **PIX**: QR Code gerado em tempo real e botão para copiar o código

Todos os dados financeiros são vinculados ao CPF/CNPJ informado no login.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "financeiro", priority: "high" }
  },

  {
    id: "kb-central-004",
    name: "Aba Suporte da Central do Assinante",
    content: `## Como funciona a aba Suporte?

A aba "Suporte" possui duas seções:

**1. Diagnóstico:**
- Consulta automática ao status PPPoE do documento informado no login
- Indica se a conexão está ONLINE ou OFFLINE
- Mostra possíveis causas (como falta de energia ou rompimento de fibra)
- Exibe tempo de atividade
- Acesso rápido ao extrato de conexão
- Botão para abrir contato via WhatsApp com mensagem pré-preenchida
- Link externo para teste de velocidade

**2. Abrir Chamado:**
- Formulário para registrar chamados
- Campos obrigatórios: setor, motivo, telefone de contato e descrição
- O envio utiliza os dados do CPF/CNPJ do assinante

**Alertas:**
A tela mostra alertas sobre ordens de serviço abertas ou concluídas vinculadas ao documento.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "suporte", priority: "high" }
  },

  {
    id: "kb-central-005",
    name: "Aba Meu Plano da Central do Assinante",
    content: `## Quais recursos existem na aba Meu Plano?

A aba "Meu Plano" concentra:

**1. Resumo do Plano Atual:**
- Nome do plano
- Valor mensal (com base na fatura mais recente)
- Velocidade contratada
- Status PPPoE (ONLINE/OFFLINE)

**2. Benefícios Inclusos:**
- Suporte técnico
- Atendimento 24h
- Acesso ao aplicativo da Central do Assinante

**3. Sugestões de Upgrade:**
- Planos ativos superiores disponíveis
- Ao escolher um, abre-se o WhatsApp da TR Telecom com mensagem que inclui o CPF/CNPJ do assinante

**4. Catálogo de Serviços Adicionais:**
- Telefonia fixa/móvel
- TV app
- Segurança
- Telemedicina
- Rastreamento
- Cada serviço leva ao WhatsApp para manifestar interesse vinculado ao documento do cliente`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "planos", priority: "medium" }
  },

  {
    id: "kb-central-006",
    name: "Aba Perfil da Central do Assinante",
    content: `## O que posso consultar na aba Perfil?

Na aba "Perfil", o assinante verifica:

**Informações Pessoais:**
- Nome completo
- E-mail de contato cadastrado
- Documento formatado (CPF ou CNPJ)
- Valor mensal estimado

**Informações Técnicas:**
- Identificador do cliente usado na rede (ex.: código PPPoE)
- Status do cadastro (Ativo ou Reduzido)
- Endereço completo vinculado ao contrato

**Ação de Logout:**
- Botão "Sair da Conta" para encerrar a sessão com segurança

Todas as informações são apenas de leitura, refletindo o cadastro associado ao CPF/CNPJ usado no login.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "perfil", priority: "low" }
  },

  {
    id: "kb-central-007",
    name: "Chat da assistente Lia na Central do Assinante",
    content: `## Como abrir o chat da assistente Lia na Central do Assinante?

**Acesso ao Chat:**
- Após o login, um botão flutuante do chat "Lia" fica disponível em todas as telas do portal
- Utiliza automaticamente o CPF/CNPJ do usuário autenticado para contextualizar o atendimento

**Funcionalidades:**
- Tirar dúvidas rápidas
- Solicitar suporte
- Receber orientações
- Tudo isso sem sair da Central do Assinante

O chat está integrado com o sistema de atendimento e mantém o contexto do cliente logado.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "chat_lia", priority: "medium" }
  },

  {
    id: "kb-central-008",
    name: "Como fazer logout da Central do Assinante",
    content: `## Como faço logout na Central do Assinante?

**Passo a passo:**
1. Acesse a aba "Perfil"
2. Clique no botão "Sair da Conta"
3. A sessão será encerrada
4. Você será redirecionado à tela de login
5. Será necessário informar novamente CPF/CNPJ e senha para acessar

**Segurança:**
O logout encerra a sessão de forma segura, protegendo seus dados.`,
    source: "Central do Assinante - Manual do Cliente",
    metadata: { category: "central_assinante", topic: "logout", priority: "low" }
  }
];

async function main() {
  console.log("🚀 Adicionando informações da Central do Assinante ao RAG...");
  console.log(`📦 Total de chunks: ${centralAssinanteChunks.length}`);
  
  try {
    await addKnowledgeChunks(centralAssinanteChunks);
    console.log("✅ Todas as 8 entradas foram adicionadas com sucesso!");
    console.log("\n📋 Chunks adicionados:");
    centralAssinanteChunks.forEach((chunk, idx) => {
      console.log(`  ${idx + 1}. ${chunk.id} - ${chunk.name}`);
    });
  } catch (error) {
    console.error("❌ Erro ao adicionar chunks:", error);
    throw error;
  }
}

main();
