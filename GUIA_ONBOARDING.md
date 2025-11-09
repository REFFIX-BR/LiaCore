# 🚀 LIA CORTEX - Guia de Onboarding

## Bem-vindo à LIA CORTEX!

Este guia vai orientá-lo passo a passo para colocar sua plataforma de atendimento inteligente em produção em **48 horas**.

---

## 📋 Checklist Pré-Onboarding

Antes de iniciar, garanta que você tem:

- [ ] **WhatsApp Business** ativo e funcionando
- [ ] **Número WhatsApp** dedicado para atendimento
- [ ] **OpenAI API Key** (criar em platform.openai.com)
- [ ] **Evolution API** instalado (ou usar nosso compartilhado)
- [ ] **Acesso ao CRM/ERP** (API REST se disponível)
- [ ] **Lista de atendentes** para cadastro inicial
- [ ] **Base de conhecimento** (PDFs, documentos, FAQs)

---

## 🎯 Cronograma de Implementação (48h)

### Dia 1 - Configuração Básica (8h)

#### Manhã (4h)
**09:00 - 10:00**: Kick-off Meeting
- Apresentação da plataforma
- Alinhamento de objetivos
- Definição de escopo

**10:00 - 12:00**: Configuração Técnica Inicial
- [ ] Criar conta na plataforma
- [ ] Configurar OpenAI API Key
- [ ] Conectar Evolution API (WhatsApp)
- [ ] Importar base de clientes

#### Tarde (4h)
**14:00 - 16:00**: Cadastro de Usuários
- [ ] Criar usuário ADMIN (você)
- [ ] Cadastrar supervisores
- [ ] Cadastrar agentes
- [ ] Configurar departamentos

**16:00 - 18:00**: Personalização Básica
- [ ] Upload de logo
- [ ] Definir cores da marca
- [ ] Configurar mensagens de boas-vindas
- [ ] Definir horário de atendimento

---

### Dia 2 - Customização e Treinamento (8h)

#### Manhã (4h)
**09:00 - 11:00**: Base de Conhecimento
- [ ] Upload de documentos (máx 50MB)
- [ ] Indexação automática
- [ ] Testar consultas

**11:00 - 13:00**: Ajuste de Prompts
- [ ] Revisar prompts padrão
- [ ] Adaptar para seu negócio
- [ ] Adicionar informações específicas (planos, preços, políticas)

#### Tarde (4h)
**14:00 - 16:00**: Treinamento da Equipe
- [ ] Workshop para supervisores (1h)
- [ ] Workshop para agentes (1h)
- [ ] Simulações práticas

**16:00 - 18:00**: Homologação
- [ ] Testes end-to-end
- [ ] Validação de fluxos principais
- [ ] Ajustes finais

---

## 🔧 Configuração Passo a Passo

### 1️⃣ Configurar OpenAI

#### Passo 1: Obter API Key
1. Acesse [platform.openai.com](https://platform.openai.com)
2. Crie uma conta ou faça login
3. Vá em **API Keys** → **Create new secret key**
4. **IMPORTANTE**: Copie e guarde a chave (não será mostrada novamente)

#### Passo 2: Configurar Billing
1. Adicione método de pagamento
2. Defina limite de gasto mensal (recomendado: $500-1000 inicial)
3. Habilite alertas de uso

#### Passo 3: Inserir na Plataforma
```bash
# Na plataforma LIA CORTEX
Configurações → Integrações → OpenAI
Cole a API Key: sk-proj-xxxx...
Teste conexão → Salvar
```

**Custo estimado:**
- 1.000 conversas/mês: ~$150-250
- 5.000 conversas/mês: ~$600-900
- 10.000 conversas/mês: ~$1.200-1.800

---

### 2️⃣ Conectar WhatsApp (Evolution API)

#### Opção A: Usar Evolution Compartilhado (Recomendado - SaaS)
```bash
# Já está pré-configurado!
Basta conectar seu número WhatsApp:

1. Acesse: Configurações → WhatsApp
2. Clique em "Conectar Número"
3. Escaneie QR Code com seu WhatsApp Business
4. Aguarde confirmação (30s)
```

#### Opção B: Self-Hosted (White-Label)
```bash
# Instalar Evolution API no seu servidor
docker run -d \
  -e AUTHENTICATION_API_KEY=sua-chave-segura \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI=postgresql://... \
  -p 8080:8080 \
  atendai/evolution-api:latest

# Configurar na plataforma
Configurações → WhatsApp → Custom Evolution
URL: https://seu-servidor.com:8080
API Key: sua-chave-segura
```

**Verificação:**
```bash
# Testar envio
POST /api/test/whatsapp
{
  "to": "5511999887766",
  "message": "Teste LIA CORTEX"
}
```

---

### 3️⃣ Criar Primeiro Usuário Admin

```bash
# Via interface web (primeira vez)
1. Acesse: https://sua-empresa.liacortex.com
2. Clique "Criar Conta Admin"
3. Preencha:
   - Nome completo
   - Email
   - Username
   - Senha (mín 8 caracteres)
4. Confirme email

# Ou via API
POST /api/auth/register-admin
{
  "username": "admin",
  "password": "SenhaSegura123!",
  "fullName": "João Silva",
  "email": "joao@empresa.com"
}
```

---

### 4️⃣ Cadastrar Equipe

#### Criar Supervisor
```bash
Usuários → Novo Usuário
├── Nome: Maria Santos
├── Email: maria@empresa.com
├── Username: maria.santos
├── Senha: [gerada automaticamente]
├── Role: SUPERVISOR
└── Departamentos: [todos]
```

#### Criar Agentes
```bash
Usuários → Importar em Lote (CSV)
Formato do CSV:
fullName,email,username,role,departments
"Pedro Costa","pedro@empresa.com","pedro.costa","AGENT","support,commercial"
"Ana Silva","ana@empresa.com","ana.silva","AGENT","financial"
```

---

### 5️⃣ Upload de Base de Conhecimento

#### Documentos Recomendados
- ✅ FAQ (Perguntas Frequentes)
- ✅ Manual de produtos/serviços
- ✅ Políticas da empresa
- ✅ Tabela de preços
- ✅ Processos técnicos
- ✅ Scripts de atendimento

#### Formato Suportado
- PDF (recomendado)
- Word (.docx)
- Excel (.xlsx)
- Texto (.txt, .md)

#### Processo de Upload
```bash
1. Acesse: Conhecimento → Adicionar Documentos
2. Arraste arquivos ou clique para selecionar
3. Aguarde indexação (1-5min por documento)
4. Teste consulta: "Como funciona plano básico?"
```

**Limites:**
- Arquivo: 50MB máximo
- Total: 500MB (Starter), 2GB (Pro), Ilimitado (Enterprise)

---

### 6️⃣ Personalizar Assistentes

#### Editar Prompt de Suporte
```bash
1. Gerenciador de Prompts → Suporte Técnico
2. Clique "Editar"
3. Adicione informações específicas:

Exemplo:
---
## PRODUTOS E SERVIÇOS DA ACME INTERNET

### Planos Disponíveis:
- **Básico 100MB**: R$ 79,90/mês
- **Plus 300MB**: R$ 129,90/mês
- **Ultra 500MB**: R$ 189,90/mês

### Política de Cancelamento:
- Sem fidelidade
- Cancelamento gratuito a qualquer momento
- Reembolso proporcional se cancelar no meio do mês
---

4. Salvar → Sincronizar com OpenAI
5. Testar conversa
```

#### Customizar Mensagem de Boas-Vindas
```bash
Templates → Mensagem Inicial

Exemplo:
"Olá! 👋 Bem-vindo(a) à ACME Internet! 

Sou a Lia, assistente virtual. Estou aqui para:
✅ Tirar dúvidas sobre planos
✅ Resolver problemas técnicos  
✅ Ajudar com pagamentos

Como posso te ajudar hoje?"
```

---

### 7️⃣ Configurar Integrações (Opcional)

#### CRM/ERP Integration
```typescript
// Exemplo: Integrar com seu CRM
Configurações → Integrações → Custom API

{
  "name": "Meu CRM",
  "baseUrl": "https://api.meucrm.com/v1",
  "authType": "bearer",
  "apiKey": "seu-token-aqui",
  "endpoints": {
    "getCustomer": "/clientes/{cpf}",
    "createTicket": "/tickets",
    "getInvoices": "/faturas/{cpf}"
  }
}
```

#### Twilio (Voz - Opcional)
```bash
Configurações → Integrações → Twilio
├── Account SID: ACxxxx...
├── Auth Token: xxxx...
└── Phone Number: +5511999887766

Testar → Fazer Chamada Teste
```

---

## 🎓 Treinamento da Equipe

### Workshop Supervisores (1h)

#### Agenda
1. **Visão Geral** (15min)
   - Arquitetura da IA
   - Fluxo de atendimento
   - Dashboards

2. **Monitoramento** (20min)
   - Vista de filas
   - Métricas em tempo real
   - Alertas

3. **Intervenção** (15min)
   - Quando assumir conversa
   - Como atribuir agente
   - Mensagens privadas

4. **Gestão de Prompts** (10min)
   - Como editar
   - Versionamento
   - Rollback

#### Material Fornecido
- ✅ Manual do Supervisor (PDF)
- ✅ Vídeos tutoriais
- ✅ Cheat sheet de atalhos

---

### Workshop Agentes (1h)

#### Agenda
1. **Interface do Agente** (15min)
   - Login
   - Dashboard pessoal
   - Fila de conversas

2. **Atendimento Prático** (30min)
   - Aceitar conversa
   - Responder cliente
   - Usar ferramentas (CRM, ticket)
   - Transferir/Resolver

3. **Modo Híbrido** (15min)
   - IA sugerindo respostas
   - Aprovar/Editar
   - Casos complexos

#### Simulação Prática
```bash
# Exercício: Atender 3 conversas simuladas
1. Cliente com problema técnico
2. Cliente querendo segunda via
3. Cliente insatisfeito (reclamação)

Objetivo: Resolver em <5min cada
```

---

## ✅ Checklist de Go-Live

### Antes de Ativar

- [ ] Todos os assistentes testados
- [ ] Base de conhecimento validada
- [ ] Equipe treinada
- [ ] Integrações funcionando
- [ ] Backup do banco de dados
- [ ] Plano de contingência definido

### Ativação Gradual (Recomendado)

#### Fase 1: Soft Launch (Semana 1)
```bash
# Ativar apenas para grupo piloto
- 10-20 clientes selecionados
- Monitoramento intensivo
- Ajustes rápidos
```

#### Fase 2: Escala Parcial (Semana 2)
```bash
# 30-50% do tráfego
- Expandir para mais clientes
- Validar carga
- Otimizar prompts
```

#### Fase 3: Full Production (Semana 3)
```bash
# 100% do tráfego
- Todos os clientes
- Monitoramento contínuo
- Melhoria contínua
```

---

## 🆘 Suporte Pós-Onboarding

### Canais de Suporte

| Canal | Horário | SLA Resposta |
|-------|---------|--------------|
| **Email** | 24/7 | 4h úteis |
| **Chat** | 8h-20h | 30min |
| **WhatsApp** | 8h-20h | 1h |
| **Telefone** | 8h-18h | Imediato |

### Contatos
- **Email**: suporte@liacortex.com
- **WhatsApp**: +55 11 99999-9999
- **Portal**: support.liacortex.com

### Documentação Adicional
- 📚 [Central de Ajuda](https://docs.liacortex.com)
- 🎥 [Vídeos Tutoriais](https://youtube.com/liacortex)
- 💬 [Comunidade](https://community.liacortex.com)

---

## 📊 Métricas de Sucesso

### KPIs para Monitorar (Primeiros 30 dias)

| Métrica | Meta | Como Medir |
|---------|------|------------|
| **Taxa de Resolução IA** | >60% | Dashboard Admin |
| **Tempo Médio Atendimento** | <5min | Dashboard AI Performance |
| **NPS** | >70 | Pesquisas automáticas |
| **Transferências para Humano** | <40% | Dashboard Supervisor |
| **Satisfação Agentes** | >80% | Survey interno |

### Relatório Semanal Automático
```bash
Configurar em: Relatórios → Agendar Envio
├── Frequência: Toda segunda 9h
├── Destinatários: gestores@empresa.com
├── Formato: PDF + Excel
└── Conteúdo:
    ├── Conversas atendidas
    ├── Taxa resolução IA
    ├── Top 10 dúvidas
    ├── Performance agentes
    └── Sugestões de melhoria
```

---

## 🎯 Próximos Passos

### Após 30 Dias
1. **Review de Performance**
   - Analisar métricas
   - Identificar gargalos
   - Ajustar prompts

2. **Expansão de Features**
   - Ativar módulo Cobranças (se aplicável)
   - Integrar com mais sistemas
   - Adicionar novos assistentes customizados

3. **Otimização Contínua**
   - Learning das conversas
   - Atualização de base de conhecimento
   - Refinamento de prompts

---

## ❓ FAQ - Perguntas Frequentes

**Q: Posso testar antes de colocar em produção?**  
A: Sim! Oferecemos 14 dias de trial gratuito com todas as funcionalidades.

**Q: Preciso de conhecimento técnico?**  
A: Não! A plataforma é 100% no-code. Apenas para integrações avançadas pode precisar de um desenvolvedor.

**Q: Quanto tempo leva para ver resultados?**  
A: Primeiros resultados em 48h. ROI positivo geralmente em 30-60 dias.

**Q: E se a IA não souber responder algo?**  
A: Ela transfere automaticamente para um humano. Você também pode melhorar a base de conhecimento.

**Q: Posso usar meu WhatsApp atual?**  
A: Sim, mas recomendamos número dedicado para separar pessoal de corporativo.

**Q: Como funciona o billing?**  
A: Mensalidade fixa + consumo de OpenAI (repassado a custo).

---

**Bem-vindo à LIA CORTEX! 🚀**

Se tiver dúvidas, estamos aqui para ajudar.  
Contato: onboarding@liacortex.com
