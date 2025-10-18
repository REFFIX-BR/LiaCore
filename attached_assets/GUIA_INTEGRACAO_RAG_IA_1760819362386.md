# 🔧 Guia de Integração RAG - IA de Vendas TR Telecom

## 📋 Visão Geral

Este documento explica como a IA de atendimento comercial deve usar os documentos RAG (Retrieval Augmented Generation) para fornecer um atendimento de qualidade, realizar vendas e coletar dados dos clientes.

---

## 📚 Documentos RAG Disponíveis

### 1. **RAG_IA_VENDAS_CONVERSACIONAL.md** 
**Uso**: Guia principal de vendas e atendimento
- Scripts de abordagem
- Técnicas de vendas
- Apresentação de planos
- Tratamento de objeções
- Boas práticas

### 2. **EXEMPLOS_CONVERSAS_IA_VENDAS.md**
**Uso**: Exemplos práticos de conversas reais
- 5 exemplos completos de atendimentos
- Diferentes perfis de cliente
- Análise de boas práticas
- Erros comuns a evitar

### 3. **FICHA_COLETA_DADOS_IA.md**
**Uso**: Checklist estruturado para coleta de dados
- Campos obrigatórios, importantes e opcionais
- Formato de cada campo
- Validações necessárias
- Templates de confirmação

### 4. **HAG_IA_CADASTRO_CLIENTES.md** (Já existente)
**Uso**: Referência técnica e de processos
- Estrutura de dados
- Endpoints de API
- Validações de sistema
- Planos disponíveis

---

## 🎯 Como a IA Deve Usar os Documentos

### Fluxo de Atendimento

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RECEPÇÃO DO CLIENTE                                      │
│    → Usar: RAG_IA_VENDAS_CONVERSACIONAL.md (Scripts)       │
│    → Identificar: Necessidade inicial                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. QUALIFICAÇÃO                                              │
│    → Usar: RAG_IA_VENDAS_CONVERSACIONAL.md (Descoberta)    │
│    → Perguntar sobre: Perfil de uso, número de pessoas     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. APRESENTAÇÃO DO PLANO                                     │
│    → Usar: HAG_IA_CADASTRO_CLIENTES.md (Planos)            │
│    → Usar: RAG_IA_VENDAS_CONVERSACIONAL.md (Apresentação)  │
│    → Recomendar: Plano adequado ao perfil                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. TRATAMENTO DE OBJEÇÕES (se houver)                       │
│    → Usar: RAG_IA_VENDAS_CONVERSACIONAL.md (Objeções)      │
│    → Usar: EXEMPLOS_CONVERSAS_IA_VENDAS.md (Referência)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. COLETA DE DADOS                                           │
│    → Usar: FICHA_COLETA_DADOS_IA.md (Checklist completo)   │
│    → Validar: Cada campo em tempo real                      │
│    → Seguir: Ordem estruturada da ficha                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. CONFIRMAÇÃO                                               │
│    → Usar: FICHA_COLETA_DADOS_IA.md (Template de resumo)   │
│    → Verificar: Todos os dados com o cliente               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. ENVIO PARA API                                            │
│    → Usar: HAG_IA_CADASTRO_CLIENTES.md (Endpoint)          │
│    → Formato: JSON especificado                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. FINALIZAÇÃO                                               │
│    → Usar: RAG_IA_VENDAS_CONVERSACIONAL.md (Finalização)   │
│    → Informar: Próximos passos                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Prompt do Sistema Recomendado

### Configuração do aiSystemPrompt

```markdown
# Você é Luna, assistente virtual de vendas da TR Telecom

## Sua Personalidade
- Amigável, profissional e consultiva
- Empática e paciente
- Focada em resolver problemas, não só vender
- Transparente e honesta

## Sua Missão
Ajudar clientes a encontrarem o plano de internet ideal e realizar o cadastro completo de forma natural e eficiente.

## Conhecimento Base
Você tem acesso aos seguintes documentos:
1. RAG_IA_VENDAS_CONVERSACIONAL.md - Guia de vendas e scripts
2. EXEMPLOS_CONVERSAS_IA_VENDAS.md - Exemplos de conversas
3. FICHA_COLETA_DADOS_IA.md - Checklist de coleta de dados
4. HAG_IA_CADASTRO_CLIENTES.md - Informações técnicas e planos

## Planos TR Telecom (Fibra Óptica)
1. **50 Mega** - R$ 69,90/mês (ID: 17)
   - Ideal: 1-2 pessoas, uso básico
   
2. **650 Mega** - R$ 109,90/mês (ID: 22) ⭐ MAIS VENDIDO
   - Ideal: 3-4 pessoas, home office, streaming
   
3. **1 Giga** - R$ 149,90/mês (ID: 23)
   - Ideal: 5+ pessoas, uso intenso, empresas

## Diretrizes de Atendimento
1. **Sempre qualificar** antes de oferecer plano
2. **Perguntar sobre**: número de pessoas, uso (trabalho, streaming, jogos)
3. **Apresentar valor**, não só preço
4. **Ser consultiva**: recomendar o melhor para o cliente, não o mais caro
5. **Coletar dados** de forma progressiva, não tudo de uma vez
6. **Validar informações** em tempo real
7. **Confirmar** todos os dados antes de finalizar

## Tratamento de Objeções
- **"Está caro"**: Demonstrar valor, comparar com café/dia, oferecer plano menor
- **"Vou pensar"**: Respeitar, mas tentar entender dúvida restante
- **"Já tenho internet"**: Perguntar sobre problemas, destacar diferenciais
- **"Não atende aqui"**: Verificar CEP, registrar interesse se não atender

## Quando Escalar para Humano
- Cliente muito insatisfeito/alterado
- Solicitações especiais complexas
- Cliente pede explicitamente
- Negociações fora do padrão

## Tom e Estilo
- Use emojis com moderação (2-3 por mensagem)
- Frases curtas e claras
- Pergunte uma coisa por vez
- Celebre pequenos progressos ("Ótimo!", "Perfeito!")
- Seja natural, como uma pessoa real

## Lembre-se
Você não está apenas fazendo uma venda, está criando uma experiência positiva e iniciando um relacionamento de longo prazo com o cliente.
```

---

## 🔗 Integração com o Sistema Existente

### 1. Componente AiAssistantChat.tsx

O componente atual já tem estrutura básica. Melhorias sugeridas:

```typescript
// Carregar documentos RAG no contexto
const ragDocuments = {
  vendas: await fetch('/rag/RAG_IA_VENDAS_CONVERSACIONAL.md').then(r => r.text()),
  exemplos: await fetch('/rag/EXEMPLOS_CONVERSAS_IA_VENDAS.md').then(r => r.text()),
  ficha: await fetch('/rag/FICHA_COLETA_DADOS_IA.md').then(r => r.text()),
  hag: await fetch('/rag/HAG_IA_CADASTRO_CLIENTES.md').then(r => r.text())
};

// Construir contexto para o Gemini
const buildContext = (userQuery: string, conversationHistory: Message[]) => {
  // Determinar qual documento RAG é mais relevante baseado na fase da conversa
  let relevantRAG = '';
  
  // Se está na fase de vendas/apresentação
  if (detectarFase(conversationHistory) === 'vendas') {
    relevantRAG = ragDocuments.vendas;
  }
  
  // Se está na fase de coleta de dados
  if (detectarFase(conversationHistory) === 'coleta') {
    relevantRAG = ragDocuments.ficha;
  }
  
  return `
    ${saleSettings.aiSystemPrompt}
    
    DOCUMENTOS DE REFERÊNCIA:
    ${relevantRAG}
    
    HISTÓRICO DA CONVERSA:
    ${conversationHistory.map(m => `${m.sender}: ${m.text}`).join('\n')}
    
    PERGUNTA ATUAL DO CLIENTE:
    ${userQuery}
    
    INSTRUÇÕES:
    - Use o documento de referência como guia
    - Mantenha contexto da conversa
    - Seja natural e conversacional
    - Não mencione que está usando documentos RAG
  `;
};
```

### 2. Detecção de Fase da Conversa

```typescript
type FaseConversa = 'recepcao' | 'qualificacao' | 'apresentacao' | 'objecao' | 'coleta' | 'confirmacao' | 'finalizacao';

const detectarFase = (messages: Message[]): FaseConversa => {
  const lastMessages = messages.slice(-5).map(m => m.text.toLowerCase());
  
  // Verificar palavras-chave para determinar fase
  if (lastMessages.some(m => m.includes('cpf') || m.includes('nome completo') || m.includes('endereço'))) {
    return 'coleta';
  }
  
  if (lastMessages.some(m => m.includes('plano') || m.includes('mega') || m.includes('preço'))) {
    return 'apresentacao';
  }
  
  if (lastMessages.some(m => m.includes('caro') || m.includes('pensar') || m.includes('dúvida'))) {
    return 'objecao';
  }
  
  if (lastMessages.some(m => m.includes('confirma') || m.includes('está correto') || m.includes('resumo'))) {
    return 'confirmacao';
  }
  
  if (messages.length <= 3) {
    return 'recepcao';
  }
  
  return 'qualificacao';
};
```

### 3. Coleta Estruturada de Dados

```typescript
interface DadosColetados {
  tipo: 'PF' | 'PJ' | null;
  nome: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  plano_id: string | null;
  dados_complementares: any;
}

const [dadosColetados, setDadosColetados] = useState<DadosColetados>({
  tipo: null,
  nome: null,
  cpf_cnpj: null,
  email: null,
  telefone: null,
  endereco: {},
  plano_id: null,
  dados_complementares: {}
});

// Extrair dados da resposta da IA
const extrairDadosColetados = (aiResponse: string, userMessage: string): Partial<DadosColetados> => {
  // Implementar lógica de extração baseada em regex e contexto
  // Exemplo: se IA perguntou CPF e usuário respondeu, extrair CPF
  return {};
};
```

### 4. Validação em Tempo Real

```typescript
const validarCampo = (campo: string, valor: string): { valido: boolean; erro?: string } => {
  switch (campo) {
    case 'cpf':
      return validarCPF(valor);
    case 'cnpj':
      return validarCNPJ(valor);
    case 'email':
      return validarEmail(valor);
    case 'telefone':
      return validarTelefone(valor);
    case 'cep':
      return validarCEP(valor);
    default:
      return { valido: true };
  }
};

// Funções de validação
const validarCPF = (cpf: string): { valido: boolean; erro?: string } => {
  // Implementar algoritmo de validação de CPF
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) {
    return { valido: false, erro: 'CPF deve ter 11 dígitos' };
  }
  // Validar dígitos verificadores...
  return { valido: true };
};

const validarEmail = (email: string): { valido: boolean; erro?: string } => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valido: false, erro: 'E-mail em formato inválido' };
  }
  return { valido: true };
};

// ... outras validações
```

### 5. Envio para API

```typescript
const finalizarCadastro = async (dados: DadosColetados) => {
  try {
    // Preparar payload conforme HAG_IA_CADASTRO_CLIENTES.md
    const payload = {
      nome_cliente: dados.nome,
      telefone_cliente: dados.telefone,
      cpf_cliente: dados.cpf_cnpj,
      email_cliente: dados.email,
      endereco: dados.endereco,
      plano_id: dados.plano_id,
      // ... outros campos
      utm_source: 'chat_ia',
      utm_medium: 'organic',
    };
    
    const response = await fetch('/api/site-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        sucesso: true,
        protocolo: result.sale_id,
        mensagem: result.message
      };
    } else {
      return {
        sucesso: false,
        erro: result.message
      };
    }
  } catch (error) {
    console.error('Erro ao finalizar cadastro:', error);
    return {
      sucesso: false,
      erro: 'Erro ao processar cadastro'
    };
  }
};
```

---

## 📊 Métricas e Monitoramento

### KPIs a Acompanhar

```typescript
interface MetricasIA {
  // Conversão
  totalConversas: number;
  leadsGerados: number;
  vendasFechadas: number;
  taxaConversao: number; // vendas / conversas
  
  // Qualidade
  tempoMedioAtendimento: number; // em minutos
  dadosCompletosPorcentagem: number; // % de cadastros 90%+ completos
  taxaEscalacao: number; // % escalado para humano
  
  // Satisfação (se implementar pesquisa)
  notaMediaSatisfacao: number; // 1-5
  
  // Objeções
  objecoesComuns: { objecao: string; frequencia: number }[];
  taxaSuperacaoObjecoes: number; // % que converteu após objeção
}

// Implementar tracking
const trackEvento = (evento: string, dados: any) => {
  // Enviar para sistema de analytics
  console.log(`[Analytics] ${evento}:`, dados);
  
  // Exemplos:
  // trackEvento('conversa_iniciada', { timestamp: Date.now() });
  // trackEvento('plano_apresentado', { plano_id: 22 });
  // trackEvento('objecao_detectada', { tipo: 'preco' });
  // trackEvento('venda_fechada', { protocolo: 'ABC123', plano: 22, valor: 109.90 });
};
```

---

## 🔄 Ciclo de Melhoria Contínua

### 1. Coleta de Feedback

```typescript
// Após finalizar atendimento, perguntar:
const solicitarFeedback = () => {
  return `
    Antes de você ir, me ajuda com uma última pergunta? 😊
    
    De 1 a 5, como você avalia nosso atendimento?
    1 - Muito ruim
    2 - Ruim
    3 - Ok
    4 - Bom
    5 - Excelente
  `;
};

// Se nota baixa (1-3), perguntar:
const solicitarMelhoria = () => {
  return `
    Obrigada pelo feedback! 
    O que poderíamos ter feito melhor?
  `;
};
```

### 2. Análise de Conversas

- Revisar conversas que não converteram
- Identificar objeções mais comuns
- Detectar pontos de abandono
- Ajustar scripts com base em dados reais

### 3. Atualização dos RAGs

- Incluir novas objeções e respostas que funcionaram
- Adicionar novos exemplos de conversas bem-sucedidas
- Atualizar informações de planos quando mudarem
- Refinar scripts com base em feedback

---

## 🚀 Roadmap de Evolução

### Fase 1: Básico (Atual)
- [x] Criação dos documentos RAG
- [x] Scripts de vendas
- [x] Ficha de coleta de dados
- [ ] Integração básica com componente existente

### Fase 2: Intermediário
- [ ] Detecção automática de fase da conversa
- [ ] Extração automática de dados das mensagens
- [ ] Validação em tempo real
- [ ] Tracking de métricas

### Fase 3: Avançado
- [ ] Machine Learning para detectar intenções
- [ ] Recomendação de planos com IA (baseado em perfil)
- [ ] Personalização dinâmica de scripts
- [ ] Integração com CRM para histórico de cliente

### Fase 4: Futuro
- [ ] Voice AI (atendimento por voz)
- [ ] Sentiment analysis (detectar humor do cliente)
- [ ] Proatividade (oferecer ajuda antes de pedir)
- [ ] Multi-idioma

---

## 🛠️ Implementação Prática

### Passo 1: Carregar RAGs no Sistema

Adicionar os documentos markdown na pasta `/public/rag/` ou similar:

```
/public
  /rag
    - RAG_IA_VENDAS_CONVERSACIONAL.md
    - EXEMPLOS_CONVERSAS_IA_VENDAS.md
    - FICHA_COLETA_DADOS_IA.md
    - HAG_IA_CADASTRO_CLIENTES.md
```

### Passo 2: Atualizar aiSystemPrompt

No banco de dados, atualizar `sale_settings.aiSystemPrompt` com o prompt recomendado acima.

### Passo 3: Modificar AiAssistantChat.tsx

Implementar as melhorias sugeridas:
- Detecção de fase
- Coleta estruturada
- Validação em tempo real
- Tracking de eventos

### Passo 4: Testar Extensivamente

Criar cenários de teste:
- Cliente direto (converte fácil)
- Cliente com objeções de preço
- Cliente indeciso
- Cliente que abandona no meio
- Pessoa jurídica
- Diferentes perfis de uso

### Passo 5: Monitorar e Iterar

- Acompanhar métricas semanalmente
- Revisar conversas que não converteram
- Ajustar scripts e prompts
- Adicionar novos exemplos aos RAGs

---

## 📖 Referências Rápidas

### Para a IA Consultar Durante Atendimento

**Fase de Recepção/Qualificação:**
→ RAG_IA_VENDAS_CONVERSACIONAL.md - Seção "Scripts de Abordagem"

**Fase de Apresentação de Planos:**
→ HAG_IA_CADASTRO_CLIENTES.md - Seção "Planos Disponíveis"
→ RAG_IA_VENDAS_CONVERSACIONAL.md - Seção "Apresentação de Planos"

**Fase de Objeções:**
→ RAG_IA_VENDAS_CONVERSACIONAL.md - Seção "Tratamento de Objeções"
→ EXEMPLOS_CONVERSAS_IA_VENDAS.md - Exemplo 2

**Fase de Coleta:**
→ FICHA_COLETA_DADOS_IA.md - Checklist completo

**Fase de Confirmação:**
→ FICHA_COLETA_DADOS_IA.md - Templates de resumo

**Fase de Finalização:**
→ RAG_IA_VENDAS_CONVERSACIONAL.md - Seção "Finalização"

---

## ⚠️ Avisos Importantes

### Limitações da IA

A IA **NÃO DEVE**:
- Prometer descontos não autorizados
- Garantir data específica de instalação sem confirmar
- Fazer negociações fora do padrão sem aprovar com humano
- Coletar dados bancários ou senhas
- Processar pagamentos

A IA **DEVE ESCALAR** quando:
- Cliente muito insatisfeito
- Negociações complexas
- Solicitações técnicas específicas
- Cliente pede explicitamente

### Privacidade e Segurança

- Não armazenar dados sensíveis em logs não criptografados
- Não compartilhar dados entre clientes
- Seguir LGPD para tratamento de dados pessoais
- Ter consentimento explícito para coleta de dados

---

## 🎓 Treinamento da Equipe

### Para Gestores

1. **Revisar métricas** semanalmente
2. **Analisar conversas** de baixa conversão
3. **Atualizar RAGs** com novos aprendizados
4. **Treinar equipe** sobre quando escalar

### Para Atendentes Humanos

1. **Conhecer os RAGs** para alinhar abordagem
2. **Revisar casos** que a IA escalou
3. **Dar feedback** sobre qualidade do lead gerado pela IA
4. **Sugerir melhorias** nos scripts

---

## 📞 Suporte e Dúvidas

### Contatos Técnicos
- **Desenvolvimento**: dev@trtelecom.net
- **Comercial**: comercial@trtelecom.net
- **Suporte**: suporte@trtelecom.net

### Documentação Relacionada
- [API_LEADS_DOCUMENTATION.md](./docs/API_LEADS_DOCUMENTATION.md)
- [SITE_INTEGRATION_API.md](./docs/SITE_INTEGRATION_API.md)

---

## 📝 Changelog

### v1.0 - 2024-10-18
- Criação inicial dos documentos RAG
- Estruturação do guia de integração
- Definição de métricas e KPIs
- Roadmap de evolução

---

**✅ Sistema RAG Completo para IA de Vendas TR Telecom**

Este conjunto de documentos fornece tudo que a IA precisa para:
- Realizar atendimento de qualidade
- Vender de forma consultiva
- Coletar dados completos
- Tratar objeções
- Finalizar vendas com sucesso

**Próximo passo**: Implementar integração técnica no componente AiAssistantChat.tsx

---

*Guia de Integração RAG v1.0 - TR Telecom*
*Documento técnico para implementação do sistema RAG*

