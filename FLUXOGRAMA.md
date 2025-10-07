# Fluxograma da Plataforma TR Chat

## Visão Geral do Sistema

```mermaid
flowchart TD
    Start([Cliente envia mensagem]) --> CheckConv{Conversa existe?}
    
    CheckConv -->|Não| Route[Rotear mensagem via GPT-5]
    Route --> DetermineAssist[Determinar tipo de assistente:<br/>suporte, comercial, financeiro,<br/>apresentacao, ouvidoria, cancelamento]
    DetermineAssist --> CreateThread[Criar Thread OpenAI]
    CreateThread --> StoreThread[Armazenar Thread no Upstash]
    StoreThread --> CreateConv[Criar registro de conversa]
    CreateConv --> SaveUserMsg
    
    CheckConv -->|Sim| GetThread[Buscar Thread do Upstash]
    GetThread --> CheckThread{Thread existe?}
    CheckThread -->|Não| CreateThread2[Criar novo Thread]
    CreateThread2 --> StoreThread2[Armazenar no Upstash]
    StoreThread2 --> SaveUserMsg
    CheckThread -->|Sim| SaveUserMsg
    
    SaveUserMsg[Salvar mensagem do usuário] --> GetAssistant[Obter Assistant ID do metadata]
    GetAssistant --> SendToOpenAI[Enviar para OpenAI Assistants API]
    
    SendToOpenAI --> AddMessage[Adicionar mensagem ao Thread]
    AddMessage --> CreateRun[Criar Run com Assistant]
    CreateRun --> PollRun[Verificar status do Run]
    
    PollRun --> CheckStatus{Status do Run?}
    CheckStatus -->|in_progress/queued| Wait[Aguardar 1s]
    Wait --> PollRun
    
    CheckStatus -->|requires_action| HandleTools[Processar chamadas de ferramentas]
    HandleTools --> ToolSwitch{Qual ferramenta?}
    
    ToolSwitch -->|verificar_conexao| CheckConn[Retornar status da conexão]
    ToolSwitch -->|consultar_fatura| GetInvoice[Retornar dados da fatura]
    ToolSwitch -->|consultar_base_conhecimento| SearchKB[Buscar na base de conhecimento<br/>via Upstash Vector]
    ToolSwitch -->|agendar_visita| Schedule[Agendar visita técnica]
    ToolSwitch -->|consultar_planos| GetPlans[Listar planos disponíveis]
    
    CheckConn --> SubmitOutputs[Submeter outputs ao Run]
    GetInvoice --> SubmitOutputs
    SearchKB --> SubmitOutputs
    Schedule --> SubmitOutputs
    GetPlans --> SubmitOutputs
    
    SubmitOutputs --> PollRun
    
    CheckStatus -->|completed| GetMessages[Buscar mensagens do Thread]
    GetMessages --> ExtractResponse[Extrair resposta do assistente]
    ExtractResponse --> SaveAssistantMsg[Salvar mensagem do assistente]
    SaveAssistantMsg --> AnalyzeSentiment[Analisar sentimento e urgência]
    AnalyzeSentiment --> UpdateConv[Atualizar conversa]
    UpdateConv --> ReturnResponse[Retornar resposta ao cliente]
    ReturnResponse --> End([Fim])
    
    CheckStatus -->|failed/cancelled/expired| Error[Retornar mensagem de erro]
    Error --> End

    style Start fill:#4CAF50
    style End fill:#f44336
    style Route fill:#2196F3
    style SendToOpenAI fill:#FF9800
    style SearchKB fill:#9C27B0
    style HandleTools fill:#FF9800
```

## Fluxo de Monitoramento (Dashboard Supervisor)

```mermaid
flowchart TD
    Monitor([Supervisor acessa dashboard]) --> LoadConv[Carregar conversas ativas]
    LoadConv --> DisplayList[Exibir lista com:<br/>- Status<br/>- Sentimento<br/>- Urgência<br/>- Última mensagem<br/>- Tempo de duração]
    
    DisplayList --> SelectConv{Selecionar conversa?}
    SelectConv -->|Sim| LoadDetails[Carregar detalhes:<br/>- Mensagens<br/>- Alertas<br/>- Ações]
    
    LoadDetails --> ShowConv[Mostrar conversa completa]
    ShowConv --> Action{Ação do supervisor?}
    
    Action -->|Transferir| Transfer[Transferir para humano]
    Transfer --> SelectDept[Escolher departamento]
    SelectDept --> AddNotes[Adicionar notas]
    AddNotes --> CreateAction[Criar ação de transferência]
    CreateAction --> UpdateStatus[Atualizar status da conversa]
    
    Action -->|Pausar IA| PauseAI[Pausar assistente IA]
    PauseAI --> CreatePauseAction[Criar ação de pausa]
    CreatePauseAction --> UpdateStatus
    
    Action -->|Adicionar Nota| AddNote[Adicionar nota interna]
    AddNote --> CreateNoteAction[Criar ação de nota]
    CreateNoteAction --> UpdateStatus
    
    Action -->|Marcar Resolvido| Resolve[Marcar como resolvido]
    Resolve --> CreateResolveAction[Criar ação de resolução]
    CreateResolveAction --> UpdateStatus
    
    UpdateStatus --> Refresh[Atualizar dashboard]
    Refresh --> End([Fim])
    
    SelectConv -->|Não| LoadAlerts[Carregar alertas críticos]
    LoadAlerts --> End
    
    style Monitor fill:#4CAF50
    style End fill:#f44336
    style Transfer fill:#FF5722
    style PauseAI fill:#FFC107
    style Resolve fill:#4CAF50
```

## Componentes do Sistema

### 1. **Frontend (React + Vite)**
- **TestChat**: Interface de teste de chat
- **Monitor**: Dashboard de monitoramento
- **ConversationDetails**: Detalhes de conversas

### 2. **Backend (Express)**
- **Routes**: Endpoints da API
- **Storage**: Armazenamento em memória
- **OpenAI Integration**: Integração com Assistants API

### 3. **Serviços Externos**

#### OpenAI
- **GPT-5**: Roteamento de mensagens
- **Assistants API**: Processamento de conversas
- **Threads**: Contexto de conversas
- **Function Calling**: Execução de ferramentas

#### Upstash
- **Redis**: Armazenamento de threads (chat_id → thread_id)
- **Vector**: Base de conhecimento para RAG

### 4. **Assistentes Especializados**

| Assistente | Função | Triggers |
|-----------|--------|----------|
| **suporte** | Problemas técnicos | internet lenta, sem conexão, equipamentos |
| **comercial** | Vendas e planos | contratar plano, upgrade, preços |
| **financeiro** | Faturas e pagamentos | fatura, boleto, pagamento |
| **apresentacao** | Novos clientes | apresentação, conhecer empresa |
| **ouvidoria** | Reclamações | reclamação, SAC, insatisfeito |
| **cancelamento** | Cancelar serviço | cancelar, desistir |

### 5. **Ferramentas dos Assistentes**

1. **verificar_conexao**: Status de conexão, velocidade, latência
2. **consultar_fatura**: Dados de fatura, vencimento, código de barras
3. **consultar_base_conhecimento**: RAG com Upstash Vector
4. **agendar_visita**: Agendar visita técnica
5. **consultar_planos**: Listar planos disponíveis

## Fluxo de Dados

```
Cliente → Frontend → Backend → OpenAI → Ferramentas → Upstash
                        ↓                      ↓
                    Storage              Base de Conhecimento
                        ↓                      ↓
                    Monitor ← ← ← ← ← ← ← ← ← ←
```

## Sistema de Alertas

O sistema monitora automaticamente:
- **Sentimento negativo**: Gera alerta de insatisfação
- **Urgência crítica**: Mensagens com "URGENTE" ou "!!!"
- **Tempo de resposta**: Conversas longas sem resolução
- **Padrões de problema**: Problemas recorrentes

## Ações do Supervisor

1. **Transferir para Humano**: Move conversa para atendimento humano
2. **Pausar IA**: Interrompe respostas automáticas
3. **Adicionar Nota**: Registra observações internas
4. **Marcar Resolvido**: Finaliza conversa
