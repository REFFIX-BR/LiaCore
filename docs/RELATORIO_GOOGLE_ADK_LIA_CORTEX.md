# Relatório: Google ADK - Análise para Implantação no LIA CORTEX

**Data:** Dezembro de 2025  
**Versão:** 1.0  
**Elaborado por:** Equipe Técnica TR Telecom

---

## Sumário Executivo

O **Google Agent Development Kit (ADK)** é um framework open-source lançado em abril de 2025 para desenvolvimento de agentes de IA. Este relatório analisa sua viabilidade como alternativa ou complemento ao atual sistema baseado em OpenAI Assistants API utilizado pelo LIA CORTEX.

### Conclusão Principal

| Aspecto | Recomendação |
|---------|--------------|
| **Curto Prazo (2025)** | ❌ Manter OpenAI Assistants API |
| **Médio Prazo (2026)** | ⚠️ Avaliar migração parcial |
| **Longo Prazo (2027+)** | ✅ Considerar migração completa |

**Justificativa:** O LIA CORTEX já possui orquestração robusta e otimizada. Migrar agora não traria benefícios imediatos significativos, mas o ADK representa o futuro da tecnologia e deve ser monitorado.

---

## 1. O que é o Google ADK

### 1.1 Definição
Framework open-source, code-first, para construção, avaliação e deploy de agentes de IA sofisticados. Lançado no Google Cloud NEXT 2025.

### 1.2 Características Principais

| Recurso | Descrição |
|---------|-----------|
| **Open-Source** | Código aberto, sem vendor lock-in |
| **Multi-Modelo** | Gemini, GPT-4, Claude, Llama, Mistral |
| **Multi-Agente** | Orquestração nativa de múltiplos agentes |
| **Multi-Linguagem** | Python, Java, Go |
| **Protocolo A2A** | Comunicação padronizada entre agentes |

### 1.3 Empresas Utilizando
- Renault Group
- Box
- Revionics
- Google (Agentspace, Gemini Enterprise)

---

## 2. Comparação: ADK vs OpenAI Assistants API (Atual)

### 2.1 Funcionalidades

| Recurso | Google ADK | OpenAI Assistants API | LIA CORTEX Atual |
|---------|------------|----------------------|------------------|
| **Orquestração Multi-Agente** | ✅ Nativo (Sequential, Parallel, Loop) | ❌ Manual | ✅ Custom (7 assistentes) |
| **Model Agnostic** | ✅ Qualquer LLM | ❌ Apenas GPT | ❌ Apenas GPT-5 |
| **Function Calling** | ✅ Nativo | ✅ Nativo | ✅ Implementado |
| **RAG/Vector Search** | ✅ Via integrações | ✅ file_search | ✅ Upstash Vector |
| **Streaming** | ✅ Bidirecional A/V | ✅ Texto | ✅ Texto |
| **Deploy** | ✅ Qualquer infra | ⚠️ Apenas API | ✅ Replit |
| **Código Aberto** | ✅ Sim | ❌ Não | N/A |
| **Human-in-the-Loop** | ✅ Nativo | ⚠️ Manual | ✅ Implementado |

### 2.2 Custos Estimados (160k mensagens/mês)

| Item | OpenAI Atual | Google ADK + Gemini |
|------|--------------|---------------------|
| **Modelo (input)** | $2.50/1M tokens | $0.075/1M tokens (Flash) |
| **Modelo (output)** | $10.00/1M tokens | $0.30/1M tokens (Flash) |
| **Estimativa Mensal*** | ~$800-1200 | ~$150-300 |
| **Economia Potencial** | - | **60-75%** |

*Estimativa baseada em volume atual do LIA CORTEX

### 2.3 Qualidade dos Modelos

| Modelo | Raciocínio | Português BR | Function Calling |
|--------|------------|--------------|------------------|
| GPT-5 (atual) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Gemini 2.0 Flash | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Gemini 2.0 Pro | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 3. Arquitetura ADK

### 3.1 Tipos de Agentes

```
┌─────────────────────────────────────────────────────────────┐
│                    GOOGLE ADK AGENTS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  LlmAgent   │  │ Sequential  │  │  Parallel   │         │
│  │             │  │   Agent     │  │   Agent     │         │
│  │ - Executa   │  │             │  │             │         │
│  │   prompts   │  │ - Executa   │  │ - Executa   │         │
│  │ - Chama     │  │   agentes   │  │   agentes   │         │
│  │   tools     │  │   em série  │  │   paralelo  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  LoopAgent  │  │   Custom    │  │   Agent     │         │
│  │             │  │   Agent     │  │  as Tool    │         │
│  │ - Iteração  │  │             │  │             │         │
│  │   até       │  │ - Lógica    │  │ - Agente    │         │
│  │   condição  │  │   custom    │  │   como      │         │
│  │             │  │   Python    │  │   ferramenta│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Exemplo de Código - Multi-Agente

```python
from google.adk.agents import SequentialAgent, ParallelAgent, LlmAgent

# Agente Recepcionista (equivalente ao Cortex)
recepcionista = LlmAgent(
    name="Recepcionista",
    model="gemini-2.0-flash",
    instruction="Identifique a necessidade do cliente e direcione.",
    tools=[rotear_para_assistente]
)

# Agentes Especialistas em Paralelo
comercial = LlmAgent(name="Comercial", instruction="...")
financeiro = LlmAgent(name="Financeiro", instruction="...")
suporte = LlmAgent(name="Suporte", instruction="...")

# Orquestração
pipeline = SequentialAgent(
    name="LIA_Cortex_ADK",
    sub_agents=[recepcionista, comercial, financeiro, suporte]
)
```

---

## 4. Mapeamento: LIA CORTEX → Google ADK

### 4.1 Componentes Atuais vs ADK

| Componente LIA CORTEX | Implementação Atual | Equivalente ADK |
|-----------------------|---------------------|-----------------|
| **Cortex (Recepcionista)** | OpenAI Assistant + custom routing | `LlmAgent` + `rotear_para_assistente()` |
| **7 Assistentes Especializados** | OpenAI Assistants (threads) | `LlmAgent` com `tools[]` |
| **RAG Knowledge Base** | Upstash Vector | `MCP Tools` ou integração direta |
| **Function Calling** | `ai-tools.ts` (30+ funções) | `tools=[func1, func2, ...]` |
| **Thread Management** | Redis + OpenAI Threads | `SessionService` (Firestore/custom) |
| **Human Handoff** | `transferir_para_humano()` | Tool com callback |
| **BullMQ Workers** | Processamento assíncrono | `AsyncRunner` + Cloud Run Jobs |

### 4.2 Arquitetura Proposta com ADK

```
┌───────────────────────────────────────────────────────────────────────┐
│                     LIA CORTEX v3.0 (ADK)                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  WhatsApp → BullMQ → ┌────────────────────────────────────────────┐   │
│                      │           ADK Runner (Python)              │   │
│                      │  ┌─────────────────────────────────────┐   │   │
│                      │  │     SequentialAgent("LIA_Main")     │   │   │
│                      │  │                                     │   │   │
│                      │  │  ┌─────────────────────────────┐    │   │   │
│                      │  │  │   LlmAgent("Recepcionista") │    │   │   │
│                      │  │  │   - Classifica demanda      │    │   │   │
│                      │  │  │   - Roteia via tools        │    │   │   │
│                      │  │  └────────────┬────────────────┘    │   │   │
│                      │  │               │                     │   │   │
│                      │  │  ┌────────────▼────────────────┐    │   │   │
│                      │  │  │   LlmAgent("Especialista")  │    │   │   │
│                      │  │  │   - Comercial/Financeiro/   │    │   │   │
│                      │  │  │     Suporte/etc.            │    │   │   │
│                      │  │  │   - Chama APIs TR Telecom   │    │   │   │
│                      │  │  └─────────────────────────────┘    │   │   │
│                      │  └─────────────────────────────────────┘   │   │
│                      └────────────────────────────────────────────┘   │
│                                        │                              │
│                                        ▼                              │
│                              WhatsApp Response                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. Análise SWOT para Migração

### 5.1 Pontos Fortes (Strengths)

| Benefício | Impacto |
|-----------|---------|
| **Redução de custos** | 60-75% economia em tokens |
| **Open-source** | Sem vendor lock-in |
| **Multi-modelo** | Pode usar Gemini, GPT-4, Claude conforme necessidade |
| **Orquestração nativa** | Menos código custom a manter |
| **Protocolo A2A** | Futuro padrão de mercado |

### 5.2 Pontos Fracos (Weaknesses)

| Desafio | Mitigação |
|---------|-----------|
| **Curva de aprendizado** | Treinamento equipe (2-4 semanas) |
| **Framework novo (abril 2025)** | Aguardar maturidade (6-12 meses) |
| **Documentação em evolução** | Comunidade ativa, suporte Google |
| **Menos testado em PT-BR** | Testes extensivos antes de produção |

### 5.3 Oportunidades (Opportunities)

- Integração nativa com Google Workspace (se TR Telecom usar)
- 100+ conectores enterprise prontos (SAP, Salesforce, etc.)
- Vertex AI Agent Engine para deploy gerenciado
- Gemini 2.0 com custo muito menor que GPT-5

### 5.4 Ameaças (Threats)

- Dependência de infraestrutura Google
- Possíveis breaking changes (framework novo)
- Qualidade do Gemini em português ainda sendo refinada

---

## 6. Plano de Implantação Gradual

### Fase 1: POC Isolado (Q1 2026)
**Duração:** 4-6 semanas  
**Escopo:** Criar versão ADK do assistente Comercial apenas  
**Objetivo:** Validar qualidade, latência e custos  

```python
# POC: Assistente Comercial em ADK
comercial_adk = LlmAgent(
    name="LIA_Comercial_POC",
    model="gemini-2.0-flash",
    instruction=open("comercial-prompt.md").read(),
    tools=[consultar_planos, buscar_cep, enviar_cadastro_venda]
)
```

**Métricas de Sucesso:**
- [ ] Latência média < 5s (atual: ~5-8s)
- [ ] Custo por mensagem < $0.002 (atual: ~$0.01)
- [ ] Taxa de acerto em roteamento > 95%
- [ ] Qualidade de resposta equivalente (avaliação humana)

### Fase 2: Ambiente Paralelo (Q2 2026)
**Duração:** 8-12 semanas  
**Escopo:** Migrar todos os 7 assistentes para ADK  
**Objetivo:** Rodar paralelo com OpenAI para comparação  

```
┌─────────────────────────────────────────────────────┐
│              AMBIENTE PARALELO                      │
│                                                     │
│  WhatsApp → BullMQ → ┌─────────────────────────┐   │
│                      │   Feature Flag Router   │   │
│                      │                         │   │
│                      │  50% → OpenAI (atual)   │   │
│                      │  50% → ADK (novo)       │   │
│                      └─────────────────────────┘   │
│                                                     │
│  Métricas: Latência, Custo, CSAT, Taxa Resolução   │
└─────────────────────────────────────────────────────┘
```

### Fase 3: Migração Gradual (Q3-Q4 2026)
**Duração:** 12-16 semanas  
**Escopo:** Aumentar tráfego ADK gradualmente  
**Objetivo:** Substituição completa com rollback disponível  

| Semana | Tráfego ADK | Observação |
|--------|-------------|------------|
| 1-2 | 10% | Monitorar erros |
| 3-4 | 25% | Ajustar prompts |
| 5-8 | 50% | Validar custos |
| 9-12 | 75% | Otimizar latência |
| 13-16 | 100% | Desligar OpenAI |

### Fase 4: Otimização (2027)
- Explorar modelos mais baratos (Gemini Flash Thinking)
- Implementar caching de respostas frequentes
- Usar ParallelAgent para consultas simultâneas
- Protocolo A2A para integrações externas

---

## 7. Estimativa de Custos

### 7.1 Investimento de Migração

| Item | Custo Estimado |
|------|----------------|
| **Desenvolvimento POC** | 80-120 horas dev |
| **Migração completa** | 200-300 horas dev |
| **Testes e QA** | 80-100 horas |
| **Treinamento equipe** | 40 horas |
| **TOTAL** | 400-560 horas (~2-3 meses) |

### 7.2 ROI Projetado

| Cenário | Economia Mensal | Payback |
|---------|-----------------|---------|
| **Conservador** | R$ 2.000/mês | 8-10 meses |
| **Moderado** | R$ 4.000/mês | 4-5 meses |
| **Otimista** | R$ 6.000/mês | 2-3 meses |

*Baseado em 160k mensagens/mês e diferença de custo Gemini vs GPT-5

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Qualidade inferior em PT-BR** | Média | Alto | POC extensivo, fallback para GPT |
| **Breaking changes no ADK** | Média | Médio | Versionar dependências, monitorar releases |
| **Latência maior** | Baixa | Médio | Usar Vertex AI para infra gerenciada |
| **Perda de funcionalidades** | Baixa | Alto | Mapeamento detalhado antes de migrar |
| **Resistência da equipe** | Baixa | Baixo | Treinamento, documentação clara |

---

## 9. Recomendações Finais

### 9.1 Ações Imediatas (Dezembro 2025)
1. ✅ **NÃO migrar agora** - Sistema atual está estável e otimizado
2. 📚 **Estudar documentação ADK** - Preparar equipe técnica
3. 🔬 **Monitorar evolução** - Acompanhar releases e cases de sucesso

### 9.2 Ações de Médio Prazo (Q1-Q2 2026)
1. 🧪 **Iniciar POC** - Assistente Comercial em ambiente isolado
2. 📊 **Comparar métricas** - Latência, custo, qualidade
3. 📋 **Documentar aprendizados** - Base para decisão de migração

### 9.3 Decisão de Migração (Q3 2026)
Avaliar com base em:
- [ ] Resultados do POC atendem expectativas?
- [ ] Economia de custos justifica investimento?
- [ ] ADK atingiu maturidade (v2.0+)?
- [ ] Equipe está preparada?

---

## 10. Recursos e Referências

### Documentação Oficial
- [Google ADK Docs](https://google.github.io/adk-docs/)
- [GitHub - google/adk-python](https://github.com/google/adk-python)
- [Vertex AI Agent Builder](https://cloud.google.com/agent-builder)

### Tutoriais
- [Codelabs - Your First Agent](https://codelabs.developers.google.com/your-first-agent-with-adk)
- [Multi-Agent Systems Guide](https://google.github.io/adk-docs/agents/multi-agents/)

### Instalação Rápida
```bash
pip install google-adk  # Python 3.10+
```

### Exemplo Mínimo
```python
from google.adk.agents import LlmAgent

agent = LlmAgent(
    name="HelloAgent",
    model="gemini-2.0-flash",
    instruction="Você é um assistente útil da TR Telecom."
)
```

---

## Anexo A: Código de Referência - Migração Comercial

```python
# comercial_adk.py - Exemplo de migração do assistente comercial
from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool
import httpx

# Tools convertidas do ai-tools.ts
def consultar_planos() -> dict:
    """Busca planos ativos no banco de dados."""
    # Implementação equivalente ao atual
    pass

def buscar_cep(cep: str) -> dict:
    """Verifica cobertura pelo CEP."""
    pass

def enviar_cadastro_venda(dados: dict) -> dict:
    """Envia cadastro para API TR Telecom."""
    pass

# Prompt atual mantido
COMERCIAL_PROMPT = open("server/prompts/comercial-assistant-prompt-v2-optimized.md").read()

# Agente ADK equivalente
comercial_agent = LlmAgent(
    name="LIA_Comercial",
    model="gemini-2.0-flash",  # ou gemini-2.0-pro para maior qualidade
    instruction=COMERCIAL_PROMPT,
    tools=[
        FunctionTool(consultar_planos),
        FunctionTool(buscar_cep),
        FunctionTool(enviar_cadastro_venda),
    ],
    output_key="resposta_comercial"
)
```

---

## Anexo B: Vertex AI Agent Engine - Infraestrutura Gerenciada

### B.1 O que é Vertex AI Agent Engine

O **Vertex AI Agent Engine** é o serviço de nuvem do Google que hospeda e executa agentes ADK automaticamente, sem necessidade de gerenciar servidores. É a opção recomendada para produção enterprise.

### B.2 Comparação: Auto-Hospedado vs Gerenciado

| Aspecto | Auto-Hospedado (Cloud Run/Docker) | Vertex AI Agent Engine |
|---------|----------------------------------|------------------------|
| **Configuração** | Dockerfile, variáveis, scaling manual | `adk deploy` e pronto |
| **Servidores** | Você configura e mantém | Google gerencia |
| **Escalabilidade** | Configurar manualmente | Automática (serverless) |
| **Atualizações** | Você faz deploy | Google aplica patches |
| **Monitoramento** | Configurar Prometheus/Grafana | Dashboard nativo |
| **Sessões** | Implementar com Redis/Firestore | Gerenciado automaticamente |
| **SLA** | Depende da sua infra | 99.9% garantido pelo Google |
| **Custo** | Infra + manutenção + DevOps | Pay-per-use |

### B.3 Equivalência com Infraestrutura Atual do LIA CORTEX

| Componente Atual | Função | Equivalente Vertex AI |
|------------------|--------|----------------------|
| **Replit** | Hospedagem do servidor | **Agent Engine Runtime** |
| **Upstash Redis** | Sessões/cache | **Managed Sessions** |
| **BullMQ Workers** | Fila de processamento | **Cloud Tasks + Agent Engine** |
| **Neon PostgreSQL** | Banco de dados | **AlloyDB / Cloud SQL** |
| **Upstash Vector** | RAG embeddings | **Vertex AI Vector Search** |

### B.4 Arquitetura Proposta com Vertex AI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIA CORTEX v3.0 - VERTEX AI AGENT ENGINE                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐      ┌──────────────────────────────────────────────────┐  │
│  │  WhatsApp   │      │         VERTEX AI AGENT ENGINE                   │  │
│  │  Evolution  │─────▶│  ┌────────────────────────────────────────────┐  │  │
│  │    API      │      │  │          Managed Runtime                   │  │  │
│  └─────────────┘      │  │                                            │  │  │
│                       │  │  ┌────────────────────────────────────┐    │  │  │
│                       │  │  │   LIA_Cortex_Agent (ADK)           │    │  │  │
│                       │  │  │                                    │    │  │  │
│                       │  │  │   ┌──────────┐  ┌──────────┐       │    │  │  │
│                       │  │  │   │Recepcio- │  │Comercial │       │    │  │  │
│                       │  │  │   │  nista   │─▶│Financeiro│       │    │  │  │
│                       │  │  │   └──────────┘  │ Suporte  │       │    │  │  │
│                       │  │  │                 └──────────┘       │    │  │  │
│                       │  │  └────────────────────────────────────┘    │  │  │
│                       │  │                                            │  │  │
│                       │  │  ┌─────────────┐  ┌─────────────────────┐  │  │  │
│                       │  │  │  Managed    │  │   Auto-Scaling      │  │  │  │
│                       │  │  │  Sessions   │  │   0 → 1000+ pods    │  │  │  │
│                       │  │  └─────────────┘  └─────────────────────┘  │  │  │
│                       │  └────────────────────────────────────────────┘  │  │
│                       │                                                  │  │
│                       │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │  │
│                       │  │  Logging    │  │  Metrics    │  │  Alerts  │  │  │
│                       │  │  Cloud      │  │  Dashboard  │  │  Native  │  │  │
│                       │  │  Logging    │  │             │  │          │  │  │
│                       │  └─────────────┘  └─────────────┘  └──────────┘  │  │
│                       └──────────────────────────────────────────────────┘  │
│                                          │                                  │
│                                          ▼                                  │
│                       ┌──────────────────────────────────────────────────┐  │
│                       │              INTEGRAÇÕES                         │  │
│                       │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │
│                       │  │ AlloyDB  │  │  Vertex  │  │   APIs   │       │  │
│                       │  │PostgreSQL│  │  Vector  │  │TR Telecom│       │  │
│                       │  │          │  │  Search  │  │          │       │  │
│                       │  └──────────┘  └──────────┘  └──────────┘       │  │
│                       └──────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.5 Processo de Deploy

#### B.5.1 Deploy Simples (CLI)

```bash
# 1. Estrutura do projeto
lia_cortex_adk/
├── agent.py           # Definição dos agentes
├── tools.py           # Funções (consultar_boleto, etc.)
├── prompts/           # Prompts dos assistentes
├── requirements.txt   # Dependências Python
└── .env              # Configurações

# 2. Login no Google Cloud
gcloud auth login
gcloud config set project tr-telecom-lia

# 3. Deploy com um comando
adk deploy --project=tr-telecom-lia --region=us-central1

# 4. Pronto! Agente rodando em:
# https://us-central1-tr-telecom-lia.cloudfunctions.net/lia-cortex
```

#### B.5.2 Deploy com Configuração Avançada

```python
# deploy_config.py
from google.adk.deploy import AgentEngineConfig

config = AgentEngineConfig(
    project_id="tr-telecom-lia",
    region="southamerica-east1",  # São Paulo
    
    # Scaling
    min_instances=1,              # Sempre 1 pod ativo (cold start = 0)
    max_instances=100,            # Escala até 100 pods
    
    # Recursos por instância
    memory="2Gi",
    cpu="2",
    
    # Timeout
    request_timeout_seconds=60,
    
    # Sessões
    session_service="firestore",  # Persistência automática
    session_ttl_hours=24,         # TTL de 24h
    
    # Segurança
    require_authentication=True,
    allowed_origins=["https://evolutionapi.trtelecom.net"]
)
```

### B.6 Estimativa de Custos Vertex AI Agent Engine

#### B.6.1 Componentes de Custo

| Componente | Precificação | Estimativa Mensal* |
|------------|--------------|-------------------|
| **Agent Engine Runtime** | $0.0025/1K requests | $400 (160K msgs) |
| **Compute (vCPU)** | $0.048/vCPU-hora | $70 (2 vCPU médio) |
| **Memória** | $0.005/GB-hora | $15 (2GB médio) |
| **Sessões (Firestore)** | $0.18/100K reads | $30 |
| **Networking (egress)** | $0.12/GB | $10 |
| **SUBTOTAL INFRA** | - | **~$525/mês** |
| | | |
| **Gemini 2.0 Flash (tokens)** | $0.075/$0.30 per 1M | **~$200/mês** |
| | | |
| **TOTAL ESTIMADO** | - | **~$725/mês** |

*Baseado em 160K mensagens/mês, ~5M tokens input, ~2M tokens output

#### B.6.2 Comparação de Custos Total

| Item | Atual (OpenAI + Replit) | Vertex AI Agent Engine |
|------|------------------------|------------------------|
| **Tokens/Modelo** | ~$800-1200/mês (GPT-5) | ~$200/mês (Gemini Flash) |
| **Infraestrutura** | ~$50/mês (Replit) | ~$525/mês (Vertex) |
| **Redis/Vector** | ~$40/mês (Upstash) | Incluído |
| **TOTAL** | **~$890-1290/mês** | **~$725/mês** |
| **Economia** | - | **~20-45%** |

**Nota:** A economia real depende do volume. Em volumes maiores (500K+ msgs), Vertex AI escala melhor e a economia aumenta para 50-60%.

### B.7 Recursos do Dashboard Agent Engine

O Vertex AI Agent Engine inclui dashboard completo:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  VERTEX AI AGENT ENGINE - DASHBOARD                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📊 MÉTRICAS EM TEMPO REAL                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Requests/min   │  │ Latência P95    │  │ Error Rate      │         │
│  │     847        │  │    2.3s         │  │    0.02%        │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  📈 GRÁFICOS                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Requests over time                                             │   │
│  │  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   │   │
│  │  ████████████████████████████████████████████████████████████   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  🔍 SESSÕES ATIVAS                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ID                  │ Usuário          │ Assistente  │ Duração   │  │
│  │ sess_abc123         │ 5524999887766    │ Comercial   │ 5m 23s    │  │
│  │ sess_def456         │ 5524988776655    │ Financeiro  │ 2m 10s    │  │
│  │ sess_ghi789         │ 5524977665544    │ Suporte     │ 8m 45s    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  🐛 DEBUG & TRACING                                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [15:30:45] → Recepcionista: Classificou como "boleto"            │  │
│  │ [15:30:46] → Roteou para: Financeiro                             │  │
│  │ [15:30:47] → Tool call: consultar_boleto_cliente(cnpj=...)       │  │
│  │ [15:30:48] → API Response: 2 boletos encontrados                 │  │
│  │ [15:30:49] → Resposta enviada ao cliente                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### B.8 Plano de Implementação Vertex AI

#### Fase 1: Preparação (2 semanas)

| Tarefa | Responsável | Duração |
|--------|-------------|---------|
| Criar projeto Google Cloud | DevOps | 1 dia |
| Configurar billing e quotas | Admin | 1 dia |
| Habilitar APIs necessárias | DevOps | 1 dia |
| Setup ambiente de desenvolvimento | Dev | 3 dias |
| Configurar CI/CD (Cloud Build) | DevOps | 3 dias |

```bash
# APIs necessárias
gcloud services enable \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com
```

#### Fase 2: Migração de Código (4 semanas)

| Tarefa | Descrição | Duração |
|--------|-----------|---------|
| Converter tools.ts → tools.py | Migrar 30+ funções | 1 semana |
| Converter prompts | Adaptar para ADK format | 2 dias |
| Implementar SessionService | Integrar com Firestore | 3 dias |
| Implementar orquestração | SequentialAgent com routing | 1 semana |
| Testes unitários | Cobertura > 80% | 1 semana |

```python
# Exemplo: tools.py
from google.adk.tools import FunctionTool
import httpx

async def consultar_boleto_cliente(documento: str) -> dict:
    """
    Consulta boletos de um cliente via API TR Telecom.
    
    Args:
        documento: CPF (11 dígitos) ou CNPJ (14 dígitos)
    
    Returns:
        dict com boletos encontrados ou erro
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.trtelecom.net/boletos/{documento}",
            headers={"Authorization": f"Bearer {API_KEY}"}
        )
        return response.json()

# Registrar como tool
consultar_boleto_tool = FunctionTool(consultar_boleto_cliente)
```

#### Fase 3: Deploy e Testes (2 semanas)

| Tarefa | Descrição | Duração |
|--------|-----------|---------|
| Deploy em staging | Ambiente isolado | 2 dias |
| Testes de integração | WhatsApp → Agent → APIs | 3 dias |
| Testes de carga | Simular 160K msgs | 2 dias |
| Validação de qualidade | Comparar respostas com OpenAI | 3 dias |
| Ajustes de prompts | Fine-tuning para Gemini | 2 dias |

```bash
# Deploy staging
adk deploy \
  --project=tr-telecom-lia \
  --region=southamerica-east1 \
  --env=staging \
  --min-instances=0 \
  --max-instances=10
```

#### Fase 4: Go-Live Gradual (4 semanas)

| Semana | % Tráfego | Observações |
|--------|-----------|-------------|
| 1 | 5% | Apenas horário comercial |
| 2 | 15% | Expandir para noite |
| 3 | 30% | Incluir fins de semana |
| 4 | 50% | Monitorar métricas |
| 5 | 75% | Preparar rollback |
| 6 | 100% | Desativar OpenAI |

### B.9 Checklist de Migração

```
PRÉ-REQUISITOS
[ ] Conta Google Cloud ativa com billing
[ ] Quotas aprovadas para Vertex AI
[ ] Equipe treinada em Python/ADK
[ ] Ambiente de staging configurado

MIGRAÇÃO DE CÓDIGO
[ ] tools.ts → tools.py (30+ funções)
[ ] Prompts adaptados para Gemini
[ ] Orquestração implementada (7 agentes)
[ ] SessionService configurado
[ ] Testes unitários passando

INFRAESTRUTURA
[ ] VPC configurada
[ ] Secrets Manager com credenciais
[ ] Cloud Armor (WAF) configurado
[ ] Alertas configurados
[ ] Runbooks documentados

INTEGRAÇÃO
[ ] Evolution API conectada
[ ] APIs TR Telecom testadas
[ ] Banco de dados migrado
[ ] Vector search configurado

VALIDAÇÃO
[ ] Testes de carga OK (160K msgs)
[ ] Latência < 5s P95
[ ] Taxa de erro < 0.1%
[ ] Qualidade de resposta validada
[ ] Rollback testado

GO-LIVE
[ ] Feature flag configurada
[ ] Tráfego gradual iniciado
[ ] Monitoramento 24/7 ativo
[ ] Equipe de plantão escalada
```

### B.10 Referências Vertex AI

- [Vertex AI Agent Engine Docs](https://cloud.google.com/agent-builder/agent-engine)
- [Deploy ADK to Agent Engine](https://google.github.io/adk-docs/deploy/agent-engine/)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [Best Practices](https://cloud.google.com/architecture/ai-ml)

---

## Anexo C: Blue-Green Deployment - Migração com Zero Risco

### C.1 Conceito

O **Blue-Green Deployment** permite rodar dois ambientes em paralelo:
- **Blue (Azul):** Sistema atual (Replit + OpenAI) - produção estável
- **Green (Verde):** Sistema novo (Google Cloud + ADK) - em validação

Um roteador simples direciona o tráfego para um ou outro, permitindo:
- Testar com clientes reais sem risco
- Rollback instantâneo se houver problemas
- Comparação de performance lado a lado

### C.2 Arquitetura Blue-Green

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA PARALELA (BLUE-GREEN)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌─────────────────────┐                        │
│                              │    ROTEADOR         │                        │
│                              │  (Feature Flag)     │                        │
│     WhatsApp ───────────────▶│                     │                        │
│     Evolution API            │  AI_BACKEND=?       │                        │
│                              │                     │                        │
│                              └──────────┬──────────┘                        │
│                                         │                                   │
│                         ┌───────────────┴───────────────┐                   │
│                         │                               │                   │
│                         ▼                               ▼                   │
│      ┌────────────────────────────┐   ┌────────────────────────────┐       │
│      │                            │   │                            │       │
│      │   🔵 BLUE (ATUAL)          │   │   🟢 GREEN (NOVO)          │       │
│      │                            │   │                            │       │
│      │   Replit                   │   │   Google Cloud             │       │
│      │   ├── OpenAI GPT-5         │   │   ├── Vertex AI Agent      │       │
│      │   ├── Upstash Redis        │   │   │   Engine               │       │
│      │   ├── Upstash Vector       │   │   ├── ADK + Gemini 2.0     │       │
│      │   ├── BullMQ Workers       │   │   ├── Firestore Sessions   │       │
│      │   └── Neon PostgreSQL      │   │   ├── Vertex AI Vector     │       │
│      │                            │   │   └── AlloyDB PostgreSQL   │       │
│      │   ✅ Produção Estável      │   │                            │       │
│      │   💰 ~$1000/mês            │   │   🧪 Validação/Teste       │       │
│      │                            │   │   💰 ~$725/mês             │       │
│      └────────────────────────────┘   └────────────────────────────┘       │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  ROLLBACK INSTANTÂNEO                                               │   │
│   │                                                                     │   │
│   │  Problema detectado?                                                │   │
│   │  1. Mudar AI_BACKEND=blue                                           │   │
│   │  2. Pronto! Todo tráfego volta para OpenAI em segundos              │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.3 Implementação do Roteador

Adicionar no código atual do LIA CORTEX (workers.ts ou routes.ts):

```typescript
// ============================================================
// ROTEADOR BLUE-GREEN - Migração ADK
// ============================================================

// Configuração via variável de ambiente
const AI_BACKEND = process.env.AI_BACKEND || 'blue'; // 'blue' | 'green' | 'split'
const GREEN_TRAFFIC_PERCENT = parseInt(process.env.GREEN_TRAFFIC_PERCENT || '0');

// URLs dos backends
const VERTEX_AI_ENDPOINT = process.env.VERTEX_AI_ENDPOINT || 
  'https://southamerica-east1-tr-telecom-lia.cloudfunctions.net/lia-cortex';

/**
 * Decide qual backend usar baseado na configuração
 */
function escolherBackend(conversationId: string): 'blue' | 'green' {
  if (AI_BACKEND === 'blue') return 'blue';
  if (AI_BACKEND === 'green') return 'green';
  
  // Modo split: distribui tráfego baseado em hash do conversationId
  // Isso garante que a mesma conversa sempre vá para o mesmo backend
  if (AI_BACKEND === 'split') {
    const hash = conversationId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const percent = Math.abs(hash) % 100;
    return percent < GREEN_TRAFFIC_PERCENT ? 'green' : 'blue';
  }
  
  return 'blue'; // fallback seguro
}

/**
 * Processa mensagem com roteamento Blue-Green
 */
async function processarMensagemBlueGreen(
  mensagem: IncomingMessage,
  conversation: Conversation
): Promise<AIResponse> {
  
  const backend = escolherBackend(conversation.id.toString());
  
  console.log(`[BLUE-GREEN] Conversa ${conversation.id} → Backend: ${backend.toUpperCase()}`);
  
  if (backend === 'green') {
    return await chamarVertexAI(mensagem, conversation);
  } else {
    return await processarComOpenAI(mensagem, conversation);
  }
}

/**
 * Chama o novo backend ADK no Vertex AI
 */
async function chamarVertexAI(
  mensagem: IncomingMessage,
  conversation: Conversation
): Promise<AIResponse> {
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(VERTEX_AI_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.VERTEX_AI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mensagem.text,
        session_id: `conv_${conversation.id}`,
        user_id: conversation.clientPhone,
        context: {
          clientName: conversation.clientName,
          currentAssistant: conversation.currentAssistant,
          // Passar contexto relevante para o ADK
        }
      }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    });
    
    if (!response.ok) {
      throw new Error(`Vertex AI error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const latency = Date.now() - startTime;
    console.log(`[GREEN] Resposta em ${latency}ms`);
    
    // Métricas para comparação
    await registrarMetricaBlueGreen('green', latency, true);
    
    return {
      text: data.response,
      assistant: data.current_agent || 'cortex',
      functionsCalled: data.tools_called || []
    };
    
  } catch (error) {
    console.error('[GREEN] Erro no Vertex AI:', error);
    
    // Métricas de erro
    await registrarMetricaBlueGreen('green', Date.now() - startTime, false);
    
    // FALLBACK AUTOMÁTICO para OpenAI
    console.log('[GREEN → BLUE] Fallback automático para OpenAI');
    return await processarComOpenAI(mensagem, conversation);
  }
}

/**
 * Registra métricas para comparação Blue vs Green
 */
async function registrarMetricaBlueGreen(
  backend: 'blue' | 'green',
  latencyMs: number,
  success: boolean
): Promise<void> {
  // Salvar no Redis para dashboard de comparação
  const key = `metrics:bluegreen:${backend}:${new Date().toISOString().slice(0, 13)}`;
  await redis.hincrby(key, success ? 'success' : 'error', 1);
  await redis.hincrbyfloat(key, 'total_latency', latencyMs);
  await redis.expire(key, 86400 * 7); // 7 dias
}
```

### C.4 Configuração de Ambiente

```bash
# .env - Configurações Blue-Green

# Modo de operação:
# - 'blue'  = 100% OpenAI (atual)
# - 'green' = 100% Vertex AI (novo)
# - 'split' = Dividir tráfego por porcentagem
AI_BACKEND=blue

# Porcentagem do tráfego para Green (só funciona com AI_BACKEND=split)
GREEN_TRAFFIC_PERCENT=0

# Endpoint do Vertex AI Agent Engine
VERTEX_AI_ENDPOINT=https://southamerica-east1-tr-telecom-lia.cloudfunctions.net/lia-cortex

# Token de autenticação do Vertex AI
VERTEX_AI_TOKEN=ya29.xxxxx
```

### C.5 Cronograma de Migração Gradual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CRONOGRAMA BLUE-GREEN (6 SEMANAS)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SEMANA 1: Preparação                                                       │
│  ├── AI_BACKEND=blue (100% OpenAI)                                          │
│  ├── Deploy ADK no Google Cloud                                             │
│  ├── Testes internos com equipe                                             │
│  └── Validar conectividade Evolution API → Vertex AI                        │
│                                                                             │
│  SEMANA 2: Teste Inicial                                                    │
│  ├── AI_BACKEND=split, GREEN_TRAFFIC_PERCENT=5                              │
│  ├── Apenas 5% do tráfego no Vertex AI                                      │
│  ├── Monitorar: latência, erros, qualidade                                  │
│  └── Ajustar prompts se necessário                                          │
│                                                                             │
│  SEMANA 3: Expansão Controlada                                              │
│  ├── GREEN_TRAFFIC_PERCENT=25                                               │
│  ├── 25% do tráfego no Vertex AI                                            │
│  ├── Comparar custos: OpenAI vs Gemini                                      │
│  └── Validar function calling (APIs TR Telecom)                             │
│                                                                             │
│  SEMANA 4: Teste de Escala                                                  │
│  ├── GREEN_TRAFFIC_PERCENT=50                                               │
│  ├── 50% do tráfego no Vertex AI                                            │
│  ├── Testar horários de pico                                                │
│  └── Validar auto-scaling do Agent Engine                                   │
│                                                                             │
│  SEMANA 5: Preparação Final                                                 │
│  ├── GREEN_TRAFFIC_PERCENT=75                                               │
│  ├── 75% do tráfego no Vertex AI                                            │
│  ├── Documentar runbooks                                                    │
│  └── Treinar equipe de suporte                                              │
│                                                                             │
│  SEMANA 6: Go-Live Completo                                                 │
│  ├── AI_BACKEND=green (100% Vertex AI)                                      │
│  ├── Manter OpenAI como fallback automático                                 │
│  ├── Monitoramento 24/7                                                     │
│  └── Após 2 semanas estável: desligar OpenAI                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.6 Dashboard de Comparação

Implementar dashboard para visualizar métricas lado a lado:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD COMPARATIVO BLUE vs GREEN                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 MÉTRICAS ÚLTIMAS 24H                                                    │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │  🔵 BLUE (OpenAI)           │  │  🟢 GREEN (Vertex AI)       │          │
│  │                             │  │                             │          │
│  │  Requests: 12,450           │  │  Requests: 3,112            │          │
│  │  Latência P50: 3.2s         │  │  Latência P50: 2.1s         │          │
│  │  Latência P95: 8.5s         │  │  Latência P95: 4.8s         │          │
│  │  Taxa Erro: 0.12%           │  │  Taxa Erro: 0.08%           │          │
│  │  Custo: $45.20              │  │  Custo: $8.40               │          │
│  │                             │  │                             │          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                             │
│  📈 COMPARATIVO                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Latência:  GREEN 34% mais rápido ✅                                │   │
│  │  Custo:     GREEN 81% mais barato ✅                                │   │
│  │  Erros:     GREEN 33% menos erros ✅                                │   │
│  │  Qualidade: Avaliação manual pendente ⏳                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🚨 ALERTAS                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Nenhum alerta ativo                                             │   │
│  │                                                                     │   │
│  │  Regras configuradas:                                               │   │
│  │  - GREEN latência P95 > 10s → Alerta                                │   │
│  │  - GREEN taxa erro > 1% → Rollback automático                       │   │
│  │  - GREEN indisponível > 30s → Fallback para BLUE                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.7 Rollback Automático

Implementar circuit breaker para rollback automático:

```typescript
// ============================================================
// CIRCUIT BREAKER - Rollback Automático
// ============================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  state: 'closed'
};

const FAILURE_THRESHOLD = 5;      // 5 erros consecutivos
const RESET_TIMEOUT = 60000;      // 1 minuto para tentar novamente
const ERROR_RATE_THRESHOLD = 0.05; // 5% de erro = rollback

/**
 * Verifica se deve usar fallback baseado no circuit breaker
 */
function deveUsarFallback(): boolean {
  // Se circuit breaker está aberto, usar Blue (OpenAI)
  if (circuitBreaker.state === 'open') {
    // Verificar se já passou tempo suficiente para tentar novamente
    if (Date.now() - circuitBreaker.lastFailure > RESET_TIMEOUT) {
      circuitBreaker.state = 'half-open';
      console.log('[CIRCUIT BREAKER] Estado: HALF-OPEN - Tentando Green novamente');
      return false;
    }
    return true;
  }
  
  return false;
}

/**
 * Registra sucesso no circuit breaker
 */
function registrarSucesso(): void {
  if (circuitBreaker.state === 'half-open') {
    circuitBreaker.state = 'closed';
    circuitBreaker.failures = 0;
    console.log('[CIRCUIT BREAKER] Estado: CLOSED - Green recuperado');
  }
}

/**
 * Registra falha no circuit breaker
 */
function registrarFalha(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  
  if (circuitBreaker.failures >= FAILURE_THRESHOLD) {
    circuitBreaker.state = 'open';
    console.error('[CIRCUIT BREAKER] Estado: OPEN - Rollback para Blue!');
    
    // Alerta para equipe
    enviarAlertaRollback();
  }
}

/**
 * Envia alerta de rollback automático
 */
async function enviarAlertaRollback(): Promise<void> {
  // Notificar via Twilio/WhatsApp para equipe
  await twilioClient.messages.create({
    body: `🚨 ALERTA LIA CORTEX: Rollback automático ativado! 
    Green (Vertex AI) com ${circuitBreaker.failures} falhas consecutivas.
    Sistema usando Blue (OpenAI) como fallback.
    Verificar logs imediatamente.`,
    to: process.env.ALERT_PHONE_NUMBER,
    from: process.env.TWILIO_PHONE_NUMBER
  });
}
```

### C.8 Vantagens do Blue-Green para TR Telecom

| Benefício | Descrição |
|-----------|-----------|
| **Zero Downtime** | Sistema atual continua funcionando 100% durante migração |
| **Rollback Instantâneo** | Muda variável de ambiente e volta para OpenAI em segundos |
| **Teste com Clientes Reais** | Valida qualidade com tráfego real, não simulação |
| **Comparação A/B** | Métricas de latência, custo e qualidade lado a lado |
| **Fallback Automático** | Se Vertex AI falhar, OpenAI assume automaticamente |
| **Migração Reversível** | Pode voltar a qualquer momento, mesmo após 100% migrado |
| **Validação Gradual** | De 5% até 100% em semanas, não de uma vez |

### C.9 Checklist Blue-Green

```
PREPARAÇÃO
[ ] Código do roteador implementado
[ ] Variáveis de ambiente configuradas
[ ] Endpoint Vertex AI funcionando
[ ] Fallback automático testado
[ ] Alertas de rollback configurados

FASE 1: TESTES INTERNOS
[ ] 0% tráfego real
[ ] Testes manuais pela equipe
[ ] Validar todas as funções (APIs TR Telecom)
[ ] Comparar respostas OpenAI vs Gemini

FASE 2: TRÁFEGO GRADUAL
[ ] 5% tráfego → validar estabilidade
[ ] 25% tráfego → validar escala
[ ] 50% tráfego → validar custos
[ ] 75% tráfego → validar qualidade

FASE 3: GO-LIVE
[ ] 100% tráfego no Vertex AI
[ ] OpenAI como fallback ativo
[ ] Monitoramento 24/7
[ ] Equipe de plantão escalada

FASE 4: DESCOMISSIONAMENTO
[ ] 2 semanas estável em 100%
[ ] Desativar fallback OpenAI
[ ] Encerrar conta/reduzir tier OpenAI
[ ] Documentar lições aprendidas
```

---

**Documento preparado para avaliação estratégica.**  
**Próxima revisão recomendada:** Março 2026 (após lançamento ADK 2.0)
