# Guia Rápido - Gerenciamento de Prompts

## 🚀 Como Editar e Melhorar os Assistentes de IA

### O que é este sistema?

Este sistema permite que você **edite e melhore as instruções** que os 6 assistentes de IA do LIA CORTEX seguem ao conversar com clientes. É como dar um "manual de instruções" mais detalhado para cada assistente.

---

## 📱 Acesso Rápido

1. **Login** no LIA CORTEX
2. Menu lateral → **Conhecimento & IA**
3. Clique em **Gerenciamento de Prompts**

---

## 🎯 Os 6 Assistentes

| Assistente | Função |
|------------|--------|
| 🎭 **Apresentação** | Recepção inicial e direcionamento |
| 💼 **Comercial** | Vendas e novos planos |
| 🔧 **Suporte** | Problemas técnicos |
| 💰 **Financeiro** | Pagamentos e faturas |
| 📢 **Ouvidoria** | Reclamações e SAC |
| ❌ **Cancelamento** | Processos de cancelamento |

---

## ✏️ Como Editar em 8 Passos

### Passo 1: Escolha o Assistente
Clique no card do assistente que quer melhorar (ex: "Comercial")

### Passo 2: Edite as Instruções
- Digite ou modifique o texto no campo grande
- Observe o contador de tokens embaixo (ideal: menos de 8000)
- Use linguagem clara e objetiva

**Exemplo de boa instrução:**
```
Quando o cliente perguntar sobre planos de fibra:
1. Pergunte qual velocidade precisa
2. Apresente o plano adequado
3. Destaque os benefícios principais
4. Ofereça desconto se for novo cliente
```

### Passo 3: Salvar Rascunho
- Clique em **"Salvar Rascunho"** (botão azul)
- Aguarde a confirmação "✓ Rascunho salvo"
- Suas mudanças ainda NÃO estão em produção

### Passo 4: Pedir Análise da IA
- Clique em **"Solicitar Análise da IA"** (botão roxo)
- Aguarde 20-30 segundos
- O sistema usa GPT-4o para avaliar seu prompt

### Passo 5: Ver Sugestões
- Clique na aba **"Sugestões da IA"**
- Veja o **score** (0-100):
  - 🟢 **90-100**: Excelente!
  - 🟡 **70-89**: Bom, mas pode melhorar
  - 🔴 **0-69**: Precisa de ajustes
- Leia:
  - ✅ **Pontos Fortes**: O que está bom
  - ⚠️ **Pontos Fracos**: O que melhorar
  - 💡 **Recomendações**: Sugestões específicas
  - 🔄 **Otimizações**: Exemplos "antes e depois"

### Passo 6: Implementar Melhorias
- Volte para a aba **"Edição"**
- Faça as mudanças sugeridas pela IA
- Salve o rascunho novamente
- (Opcional) Peça nova análise para confirmar melhoria

### Passo 7: Comparar Versões
- Clique na aba **"Comparar"**
- Veja lado a lado:
  - **Esquerda**: Versão atual em produção
  - **Direita**: Seu rascunho com edições
- Confira se está tudo correto

### Passo 8: Publicar!
- Clique em **"Publicar"** (botão verde)
- Escolha o **tipo de versão**:
  - **Patch**: Pequenas correções → 1.2.3 → 1.2.4
  - **Minor**: Melhorias médias → 1.2.3 → 1.3.0
  - **Major**: Mudança grande → 1.2.3 → 2.0.0
- Escreva **notas da versão** (o que mudou)
- Clique em **"Publicar"** no popup
- ✅ Pronto! Mudanças estão em PRODUÇÃO agora!

---

## ⚠️ Avisos Importantes

### ⏰ Rascunho vs. Produção
- **Rascunho**: Suas edições (visível só para você)
- **Produção**: Versão que os clientes interagem (ao vivo)
- Só vira produção quando você **PUBLICAR**

### 🔴 Badge Vermelho de Erro
Se aparecer um badge vermelho escrito "Erro de Sincronização":
1. Passe o mouse sobre ele para ver o erro
2. Geralmente é temporário (tente republicar)
3. Se persistir, contate o suporte técnico

### 📊 Tokens
- **O que são**: Unidades que a IA usa para processar texto
- **Limite ideal**: Menos de 8000 tokens
- **Se ultrapassar**: Aparece aviso amarelo (considere encurtar)

---

## 💡 Dicas de Ouro

### ✅ Faça

- ✅ Use linguagem clara e direta
- ✅ Dê exemplos de como responder
- ✅ Defina limites (o que NÃO fazer)
- ✅ Organize em seções numeradas
- ✅ Teste sempre com análise da IA
- ✅ Documente o que mudou nas notas

### ❌ Evite

- ❌ Instruções vagas ou genéricas
- ❌ Textos muito longos (>8000 tokens)
- ❌ Publicar sem revisar na aba "Comparar"
- ❌ Pular a análise da IA
- ❌ Deixar notas de versão vazias

---

## 📊 Exemplo Completo: Melhorando o Comercial

### Situação
Os clientes estão perguntando sobre um novo plano "Fibra Max 1000" e o assistente não sabe responder.

### Solução

**1. Abrir assistente Comercial**

**2. Adicionar no prompt:**
```
## Plano Fibra Max 1000 (LANÇAMENTO)

Velocidade: 1000 Mbps download / 500 Mbps upload
Preço: R$ 149,90/mês
Benefícios:
- WiFi 6 grátis
- IP fixo incluso
- Instalação gratuita
- Suporte prioritário 24/7

Quando oferecer:
- Cliente precisa de alta velocidade
- Trabalha home office
- Família com 5+ dispositivos
- Gamer ou streamer

Script de venda:
"O Fibra Max 1000 é nosso plano mais completo. Com 1 Giga 
de velocidade, você terá internet ultrarrápida para toda 
família, incluindo WiFi 6 de última geração e suporte VIP. 
Tudo isso por R$ 149,90/mês. Gostaria de conhecer?"

Objeções comuns:
- "Está caro" → "Comparado com outros de 1 Giga, estamos 
  30% mais baratos, e você ganha WiFi 6 que vale R$ 300"
- "Não preciso de tanto" → "Entendo! Temos planos a partir 
  de 300 Mbps. Quantas pessoas usam a internet na sua casa?"
```

**3. Salvar rascunho**

**4. Solicitar análise da IA**
- Score esperado: 85-92/100
- IA vai sugerir melhorias no tom ou estrutura

**5. Implementar sugestões**

**6. Comparar versões**
- Conferir que novo plano está lá
- Verificar que nada foi removido por engano

**7. Publicar**
- Tipo: **Minor** (nova funcionalidade)
- Notas: "Adicionado suporte ao plano Fibra Max 1000 com scripts de venda e tratamento de objeções"

**8. Resultado**
- ✅ Versão 1.3.0 em produção
- ✅ Assistente agora vende o novo plano corretamente
- ✅ Clientes satisfeitos

---

## 🔧 Resolução de Problemas

### Problema: "Não consigo publicar"

**Verificar**:
- [ ] Você é ADMIN ou SUPERVISOR?
- [ ] Salvou o rascunho antes?
- [ ] Preencheu as notas da versão?

### Problema: "Contador de tokens mostra 0"

**Solução**:
- Aguarde 2-3 segundos (primeira vez carrega lento)
- Se persistir, recarregue a página

### Problema: "Análise da IA não funciona"

**Solução**:
- Aguarde 1 minuto e tente novamente
- Pode estar com muitas requisições simultâneas

### Problema: "Como voltar versão anterior?"

**Solução**:
1. Aba **"Histórico"**
2. Encontre a versão desejada
3. Clique em **"Restaurar"**
4. Confirme a ação
5. Isso cria uma NOVA versão com conteúdo antigo

---

## 📞 Precisa de Ajuda?

### Suporte Técnico
- **Email**: admin@liacortex.com
- **Menu Sistema**: Ferramentas → Logs
- **Este Guia**: docs/PROMPT_MANAGEMENT_GUIDE.md (versão técnica)

---

## 📈 Checklist de Qualidade

Antes de publicar, confirme:

- [ ] Texto claro e objetivo
- [ ] Menos de 8000 tokens
- [ ] Incluí exemplos práticos
- [ ] Defini o que NÃO fazer
- [ ] Solicitei análise da IA
- [ ] Score acima de 80
- [ ] Implementei sugestões da IA
- [ ] Comparei versões lado a lado
- [ ] Escrevi notas da versão detalhadas
- [ ] Escolhi tipo de versão correto

---

## 🎓 Resumo Rápido

```
1. Escolher assistente
2. Editar instruções
3. Salvar rascunho
4. Pedir análise IA
5. Ver sugestões
6. Implementar melhorias
7. Comparar versões
8. Publicar!
```

**Tempo médio**: 15-20 minutos por assistente

**Frequência recomendada**: 
- Revisão mensal de todos os assistentes
- Atualização imediata quando houver novos produtos/serviços
- Ajustes conforme feedback da equipe

---

**Última atualização**: 15/01/2025  
**Versão**: 1.0  
**Para**: Administradores e Supervisores do LIA CORTEX
