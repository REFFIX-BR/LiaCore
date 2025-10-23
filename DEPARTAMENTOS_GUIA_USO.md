# Sistema de Departamentos - Guia de Uso

## O que é?

O Sistema de Departamentos permite que agentes vejam apenas as conversas relacionadas aos seus departamentos específicos, enquanto supervisores e administradores continuam tendo acesso total a todas as conversas.

## Como Funciona?

### Departamentos Disponíveis

O sistema possui 5 departamentos:

1. **Geral** - Conversas de apresentação e informações gerais
2. **Comercial** - Vendas, planos, ofertas
3. **Financeiro** - Faturas, pagamentos, questões financeiras
4. **Suporte** - Problemas técnicos, suporte
5. **Cancelamento** - Reclamações, ouvidoria, cancelamentos

### Marcação Automática

Quando um cliente conversa com a IA, a conversa é **automaticamente marcada** com o departamento correspondente ao assistente que a atendeu:

| Assistente de IA | Departamento |
|-----------------|--------------|
| Cortex / Apresentação | Geral |
| Comercial | Comercial |
| Financeiro | Financeiro |
| Suporte | Suporte |
| Ouvidoria / Cancelamento | Cancelamento |

### Níveis de Acesso

- **AGENTE**: Vê apenas conversas dos seus departamentos
- **SUPERVISOR**: Vê todas as conversas (sem filtro)
- **ADMIN**: Vê todas as conversas (sem filtro)

---

## Como Usar (Para Administradores)

### 1. Acessar Gerenciamento de Usuários

1. Faça login como **ADMIN**
2. Clique em **"Usuários"** no menu lateral
3. Você verá a lista de todos os usuários

### 2. Atribuir Departamentos a um Agente

1. Localize o agente na lista
2. Clique no botão **"Gerenciar Departamentos"** (ícone de pasta)
3. Uma janela será aberta com 5 opções de departamento
4. **Marque** os departamentos que o agente deve ter acesso
5. Clique em **"Salvar Alterações"**

**Exemplo prático:**
- Se João trabalha em vendas e suporte, marque: **Comercial** e **Suporte**
- João verá apenas conversas desses dois departamentos na fila de transferidas/atribuídas

### 3. Visualizar Departamentos dos Agentes

Na lista de usuários, você verá **badges coloridos** ao lado de cada agente mostrando seus departamentos:

- 🟢 Geral
- 🔵 Comercial
- 🟡 Financeiro
- 🟣 Suporte
- 🔴 Cancelamento

### 4. Remover Departamentos

1. Clique em **"Gerenciar Departamentos"**
2. **Desmarque** os departamentos que deseja remover
3. Clique em **"Salvar Alterações"**

⚠️ **Atenção**: Se remover todos os departamentos de um agente, ele não verá nenhuma conversa nova. Apenas dados antigos continuarão visíveis.

---

## Exemplos de Uso

### Exemplo 1: Equipe Especializada

**Situação:** Você tem uma equipe de 3 agentes:
- Maria - especialista em vendas
- João - especialista em suporte técnico
- Ana - faz vendas e suporte

**Configuração:**
- Maria: Atribuir apenas **Comercial**
- João: Atribuir apenas **Suporte**
- Ana: Atribuir **Comercial** + **Suporte**

**Resultado:**
- Maria verá apenas conversas de vendas
- João verá apenas conversas de suporte
- Ana verá conversas de vendas E suporte
- Supervisores continuam vendo tudo

### Exemplo 2: Agente Multifuncional

**Situação:** Pedro atende todas as áreas

**Configuração:**
- Pedro: Atribuir **todos os 5 departamentos**

**Resultado:**
- Pedro verá todas as conversas transferidas/atribuídas

---

## Perguntas Frequentes

### ❓ O que acontece com conversas antigas sem departamento?

**Resposta:** Conversas antigas (criadas antes do sistema de departamentos) continuam visíveis para **todos os agentes** durante a migração. Isso garante que ninguém perca acesso às conversas já em andamento.

### ❓ Supervisores precisam ter departamentos?

**Resposta:** **Não**. Supervisores e Admins sempre veem todas as conversas, independentemente de terem departamentos configurados ou não.

### ❓ Posso atribuir um agente a múltiplos departamentos?

**Resposta:** **Sim**! Um agente pode ter quantos departamentos forem necessários. Basta marcar múltiplas opções ao gerenciar os departamentos.

### ❓ O que acontece se eu não atribuir nenhum departamento a um agente?

**Resposta:** O agente verá apenas conversas antigas (sem departamento). Conversas novas não aparecerão para ele até que departamentos sejam atribuídos.

### ❓ Como identifico a qual departamento uma conversa pertence?

**Resposta:** Nas listas de conversas, você verá um **badge colorido** ao lado de cada conversa mostrando seu departamento.

### ❓ Posso alterar o departamento de uma conversa manualmente?

**Resposta:** Atualmente não. O departamento é atribuído automaticamente baseado no assistente de IA que atendeu o cliente. Se precisar dessa funcionalidade, consulte o desenvolvedor.

### ❓ O sistema afeta conversas em andamento?

**Resposta:** **Não imediatamente**. Conversas que já estão atribuídas a um agente continuarão visíveis para ele. O filtro afeta principalmente a visualização de novas conversas transferidas.

---

## Benefícios do Sistema

✅ **Organização**: Cada agente vê apenas o que é relevante para seu trabalho
✅ **Foco**: Reduz sobrecarga de informação
✅ **Eficiência**: Agentes atendem conversas da sua especialidade
✅ **Flexibilidade**: Fácil reatribuir departamentos conforme necessário
✅ **Compatibilidade**: Não quebra dados existentes

---

## Solução de Problemas

### Problema: Agente não está vendo conversas

**Verificar:**
1. O agente tem departamentos atribuídos?
2. As conversas que ele deveria ver têm o departamento correto?
3. As conversas estão com status "transferida para humano" ou "atribuída"?

**Solução:**
- Atribua os departamentos apropriados ao agente
- Verifique se há conversas desses departamentos aguardando

### Problema: Agente vendo conversas de outros departamentos

**Verificar:**
1. O agente está cadastrado como AGENTE ou como SUPERVISOR/ADMIN?
2. Ele tem múltiplos departamentos atribuídos?

**Solução:**
- Se for SUPERVISOR/ADMIN, é o comportamento esperado
- Se for AGENTE, remova departamentos indesejados na configuração

---

## Suporte Técnico

Se encontrar problemas não listados neste guia, entre em contato com o desenvolvedor do sistema fornecendo:
- Nome do usuário afetado
- Departamentos atribuídos
- Descrição do problema
- Prints de tela se possível
