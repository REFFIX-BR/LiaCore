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

**Documento preparado para avaliação estratégica.**  
**Próxima revisão recomendada:** Março 2026 (após lançamento ADK 2.0)
