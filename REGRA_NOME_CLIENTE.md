# 🎯 REGRA CRÍTICA: TRATAMENTO CONSISTENTE DO NOME DO CLIENTE

## ⚠️ PARA ADICIONAR EM TODOS OS ASSISTENTES

Esta regra deve ser inserida na seção **"## 🚨 REGRAS ABSOLUTAS - NUNCA VIOLAR"** de cada assistente, após a última regra existente.

---

## 📋 TEXTO DA REGRA (COPIAR E COLAR):

```markdown
### 5️⃣ NUNCA ALTERE A FORMA DE TRATAMENTO DO CLIENTE
- ✅ **SEMPRE** use o nome que está registrado no sistema para se dirigir ao cliente
- ❌ **NUNCA** mude o nome pelo qual chama o cliente durante a conversa
- ✅ Se o cliente fornecer informações de endereço (rua, avenida, número, bairro, cidade, UF), reconheça como LOCALIZAÇÃO, não como nome pessoal
- ✅ Exemplos de endereço que NÃO são nomes: "Rua José Silva 123", "Avenida Maria Santos 45 apt 201", "José Antônio Alves 180 Chiador MG"
- ❌ **NUNCA** chame o cliente pelo nome da rua/logradouro
- ✅ Quando perguntar por endereço e receber uma resposta, reconheça: "Entendi, o endereço é [endereço fornecido]" - NÃO trate como nome pessoal
```

---

## ✅ CHECKLIST DE APLICAÇÃO:

### Assistentes que precisam da regra:
- [ ] **Apresentação** (Cortex/Recepcionista)
- [ ] **Comercial** (Vendas)
- [ ] **Financeiro** (Boletos/Pagamentos)
- [ ] **Suporte** (Técnico)
- [ ] **Ouvidoria** (Reclamações)
- [ ] **Cancelamento** (Retenção)
- [ ] **Cobrança** (Negociação de dívidas)

---

## 📍 ONDE INSERIR:

1. Abra o **Gerenciador de Prompts**
2. Selecione o assistente
3. Localize a seção **"## 🚨 REGRAS ABSOLUTAS - NUNCA VIOLAR"**
4. Procure a última regra numerada (ex: "### 4️⃣")
5. **Cole a nova regra logo APÓS** a última regra
6. Salve e sincronize

---

## 🎯 OBJETIVO DA REGRA:

**Problema resolvido:**
- IA confundia nomes de ruas com nomes de clientes
- Cliente "Rita Galhano" sendo chamado de "José Francisco" (nome da rua)
- Inconsistência no tratamento durante a conversa

**Resultado esperado:**
- IA mantém o nome original durante toda a conversa
- IA reconhece padrões de endereço corretamente
- Experiência do cliente mais profissional e consistente

---

## 💡 EXEMPLOS DE USO:

### ❌ ANTES (Errado):
```
Cliente: "Rita Galhano"
IA: "Olá Rita!"
Cliente: "O endereço é José Antônio Alves 180"
IA: "Certo José Antônio, vou registrar..."  ← ERRO!
```

### ✅ DEPOIS (Correto):
```
Cliente: "Rita Galhano"
IA: "Olá Rita!"
Cliente: "O endereço é José Antônio Alves 180"
IA: "Entendi, o endereço é José Antônio Alves 180, Chiador, MG. Registrado, Rita!"  ← CORRETO!
```

---

## 📞 CASO REAL CORRIGIDO:

**Conversa ID:** whatsapp_60001347494118 (Rita Galhano)

**Antes da regra:**
- IA perguntou qual endereço
- Cliente respondeu: "José Francisco Antônio alves 180"
- IA começou a chamar: "José Francisco" e "José Antônio"

**Após a regra:**
- IA reconhece como endereço
- Continua chamando: "Rita"
- Experiência consistente e profissional

---

## 🚀 PRÓXIMOS PASSOS:

1. ✅ Copie a regra acima
2. ✅ Cole em cada um dos 7 assistentes
3. ✅ Salve e sincronize cada um
4. ✅ Teste com uma conversa real
5. ✅ Monitore por alguns dias para validar efetividade

---

**Data de criação:** 09/11/2025  
**Motivo:** Correção de bug crítico de UX - confusão entre nomes e endereços  
**Impacto:** Todos os assistentes de IA  
**Prioridade:** ALTA 🔴
