# Sistema de Departamentos - Resumo Executivo

## 🎯 Objetivo

Permitir que agentes vejam apenas conversas dos seus departamentos, organizando melhor a fila de atendimento.

---

## 📋 Departamentos Disponíveis

| Departamento | Descrição | Cor do Badge |
|--------------|-----------|--------------|
| Geral | Apresentação, informações gerais | 🟢 Verde |
| Comercial | Vendas, planos, ofertas | 🔵 Azul |
| Financeiro | Faturas, pagamentos | 🟡 Amarelo |
| Suporte | Problemas técnicos | 🟣 Roxo |
| Cancelamento | Reclamações, ouvidoria | 🔴 Vermelho |

---

## 👥 Como Funciona

### Níveis de Acesso
- **ADMIN**: Vê tudo + pode gerenciar departamentos
- **SUPERVISOR**: Vê tudo
- **AGENT**: Vê apenas seus departamentos

### Atribuição Automática
Conversas são marcadas automaticamente com base no assistente de IA:
- Cortex/Apresentação → Geral
- Comercial → Comercial
- Financeiro → Financeiro
- Suporte → Suporte
- Ouvidoria/Cancelamento → Cancelamento

---

## ⚙️ Como Configurar (ADMIN)

1. Vá em **Usuários**
2. Clique em **"Gerenciar Departamentos"** no agente
3. Marque os departamentos desejados
4. Clique em **"Salvar"**

**Exemplos:**
- Agente de vendas: Marcar apenas **Comercial**
- Agente multifuncional: Marcar **Comercial + Suporte + Financeiro**
- Remover todos: Agente vê apenas conversas antigas

---

## 🔄 Compatibilidade

✅ Conversas antigas (sem departamento) continuam visíveis para todos os agentes
✅ Agentes sem departamentos configurados continuam vendo tudo
✅ Não afeta supervisores e administradores

---

## 📊 Benefícios

- ✅ Organização da fila de atendimento
- ✅ Foco no trabalho especializado
- ✅ Redução de sobrecarga de informação
- ✅ Flexibilidade (múltiplos departamentos por agente)
- ✅ Transição suave (backward compatible)

---

## 📚 Documentação Completa

- **DEPARTAMENTOS_GUIA_USO.md** - Guia detalhado para usuários
- **DEPARTAMENTOS_DOCUMENTACAO_TECNICA.md** - Documentação técnica para desenvolvedores
- **replit.md** - Arquitetura geral do sistema

---

## 🆘 Suporte Rápido

**Agente não vê conversas?**
1. Verifique se tem departamentos atribuídos
2. Verifique se é AGENTE (não SUPERVISOR)
3. Verifique se há conversas desse departamento na fila

**Precisa de mais ajuda?**
- Consulte: `DEPARTAMENTOS_GUIA_USO.md`
- Problemas técnicos: `DEPARTAMENTOS_DOCUMENTACAO_TECNICA.md`
