# 📋 Ficha de Coleta de Dados - IA de Vendas TR Telecom

## 🎯 Objetivo do Documento
Este documento serve como um **checklist estruturado** que a IA deve seguir durante a coleta de dados do cliente para cadastro. Funciona como uma ficha digital que garante que nenhuma informação importante seja esquecida.

---

## 📊 Sistema de Prioridades

### ✅ OBRIGATÓRIO - Sem isso, não pode cadastrar
### ⭐ IMPORTANTE - Deve tentar coletar
### 💡 OPCIONAL - Bom ter, mas pode pular

---

## 🆔 ETAPA 1: Identificação do Tipo de Cliente

### Pergunta Inicial
```
"Você quer fazer o cadastro no seu CPF (pessoa física) ou no CNPJ (empresa)?"
```

**Opções:**
- [ ] **Pessoa Física (CPF)** → Ir para FICHA PF
- [ ] **Pessoa Jurídica (CNPJ)** → Ir para FICHA PJ

---

## 👤 FICHA DE COLETA - PESSOA FÍSICA

### 📝 SEÇÃO 1: Dados Pessoais Básicos

#### 1.1 Nome Completo ✅ OBRIGATÓRIO
- **Pergunta**: "Qual seu nome completo?"
- **Formato**: Texto livre (mínimo 2 palavras)
- **Exemplo**: "João Carlos Silva Santos"
- **Validação**: Verificar se tem pelo menos nome e sobrenome
- **Campo**: `nome_cliente`

---

#### 1.2 CPF ✅ OBRIGATÓRIO
- **Pergunta**: "Qual seu CPF? (formato: 000.000.000-00)"
- **Formato**: XXX.XXX.XXX-XX
- **Exemplo**: "123.456.789-00"
- **Validação**: 
  - Verificar formato
  - Validar dígitos verificadores
  - Verificar se não está duplicado no sistema
- **Campo**: `cpf_cliente`
- **Erro comum**: Cliente envia sem pontos/traços → aceitar e formatar automaticamente

---

#### 1.3 E-mail ✅ OBRIGATÓRIO
- **Pergunta**: "Qual seu e-mail?"
- **Formato**: email@dominio.com
- **Exemplo**: "joao.silva@email.com"
- **Validação**: 
  - Verificar formato válido
  - Verificar se domínio existe (se possível)
- **Campo**: `email_cliente`
- **Erro comum**: Cliente erra o @ → pedir confirmação

---

#### 1.4 Telefone Principal ✅ OBRIGATÓRIO
- **Pergunta**: "Qual seu telefone principal com DDD? (Ex: (11) 99999-9999)"
- **Formato**: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
- **Exemplo**: "(11) 98765-4321"
- **Validação**: 
  - Verificar se tem DDD
  - Verificar quantidade de dígitos (celular 9 dígitos, fixo 8)
  - Verificar se não está duplicado
- **Campo**: `telefone_cliente`
- **Erro comum**: Esquecer o DDD → perguntar a cidade/estado

---

### 📝 SEÇÃO 2: Dados Complementares

#### 2.1 Nome da Mãe ⭐ IMPORTANTE
- **Pergunta**: "Qual o nome completo da sua mãe?"
- **Formato**: Texto livre (nome completo)
- **Exemplo**: "Maria Silva Santos"
- **Validação**: Preferível nome completo
- **Campo**: `nome_mae`
- **Se cliente não souber**: "Sem problemas, pode deixar em branco por enquanto"

---

#### 2.2 Data de Nascimento ⭐ IMPORTANTE
- **Pergunta**: "Qual sua data de nascimento? (formato: DD/MM/AAAA)"
- **Formato**: DD/MM/AAAA
- **Exemplo**: "15/03/1985"
- **Validação**: 
  - Verificar formato
  - Verificar se é data válida
  - Cliente deve ser maior de 18 anos
- **Campo**: `data_nascimento`
- **Conversão**: Converter para YYYY-MM-DD no backend

---

#### 2.3 RG ⭐ IMPORTANTE
- **Pergunta**: "Qual seu número do RG?"
- **Formato**: Texto livre (varia por estado)
- **Exemplo**: "12.345.678-9" ou "MG-12.345.678"
- **Validação**: Aceitar qualquer formato (varia muito)
- **Campo**: `rg`
- **Se cliente não tiver**: "Sem problema, pode enviar depois"

---

#### 2.4 Sexo ⭐ IMPORTANTE
- **Pergunta**: "Sexo: Masculino ou Feminino?"
- **Formato**: Escolha única
- **Opções**: 
  - Masculino (M)
  - Feminino (F)
- **Campo**: `sexo`
- **Nota**: Perguntar de forma respeitosa

---

#### 2.5 Estado Civil ⭐ IMPORTANTE
- **Pergunta**: "Estado civil: Solteiro(a), Casado(a), Viúvo(a) ou Outros?"
- **Formato**: Escolha única
- **Opções**: 
  - Solteiro (S)
  - Casado (C)
  - Viúvo (V)
  - Outros (O)
- **Campo**: `estadoCivil`

---

### 📝 SEÇÃO 3: Endereço de Instalação

#### 3.1 CEP ✅ OBRIGATÓRIO
- **Pergunta**: "Qual seu CEP? (formato: 00000-000)"
- **Formato**: XXXXX-XXX
- **Exemplo**: "01234-567"
- **Validação**: 
  - Verificar formato
  - Buscar endereço automaticamente (API ViaCEP)
  - **CRÍTICO**: Verificar se há cobertura TR Telecom na área
- **Campo**: `endereco.cep`
- **Após busca**: "Encontrei: [Rua], [Bairro], [Cidade] - [UF]. Está correto?"

---

#### 3.2 Logradouro ✅ OBRIGATÓRIO
- **Pergunta**: Geralmente preenchido automaticamente pelo CEP
- **Formato**: Texto livre
- **Exemplo**: "Rua das Flores"
- **Campo**: `endereco.endereco` ou `endereco.street`
- **Se não vier no CEP**: Perguntar manualmente

---

#### 3.3 Número ✅ OBRIGATÓRIO
- **Pergunta**: "Qual o número do endereço?"
- **Formato**: Texto livre (aceitar números, S/N, etc)
- **Exemplo**: "123" ou "S/N"
- **Campo**: `endereco.numero`
- **Validação**: Se for "sem número", aceitar "S/N"

---

#### 3.4 Bairro ✅ OBRIGATÓRIO
- **Pergunta**: Geralmente preenchido automaticamente pelo CEP
- **Formato**: Texto livre
- **Exemplo**: "Centro"
- **Campo**: `endereco.bairro` ou `endereco.neighborhood`

---

#### 3.5 Cidade ✅ OBRIGATÓRIO
- **Pergunta**: Geralmente preenchido automaticamente pelo CEP
- **Formato**: Texto livre
- **Exemplo**: "São Paulo"
- **Campo**: `endereco.cidade` ou `endereco.city`

---

#### 3.6 Estado (UF) ✅ OBRIGATÓRIO
- **Pergunta**: Geralmente preenchido automaticamente pelo CEP
- **Formato**: Sigla do estado (2 letras)
- **Exemplo**: "SP"
- **Campo**: `endereco.estado` ou `endereco.uf`

---

#### 3.7 Complemento 💡 OPCIONAL
- **Pergunta**: "Tem complemento? (Ex: Apto 101, Bloco B - se não tiver, só responder 'não')"
- **Formato**: Texto livre
- **Exemplo**: "Apto 45", "Casa 2", "Bloco B"
- **Campo**: `endereco.complemento` ou `endereco.complement`
- **Se não tiver**: Deixar em branco

---

#### 3.8 Ponto de Referência 💡 OPCIONAL
- **Pergunta**: "Tem algum ponto de referência próximo? (Ex: Perto da padaria X - opcional)"
- **Formato**: Texto livre
- **Exemplo**: "Em frente ao mercado Extra", "Próximo à escola municipal"
- **Campo**: `endereco.referencia` ou `endereco.reference`
- **Utilidade**: Ajuda o técnico a encontrar no dia da instalação

---

### 📝 SEÇÃO 4: Dados do Serviço

#### 4.1 Plano Escolhido ✅ OBRIGATÓRIO
- **Pergunta**: Já deve ter sido escolhido antes da coleta de dados
- **Opções**: 
  - Plano 50 Mega (ID: 17) - R$ 69,90
  - Plano 650 Mega (ID: 22) - R$ 109,90
  - Plano 1 Giga (ID: 23) - R$ 149,90
- **Campo**: `plano_id`
- **Validação**: Verificar se plano está ativo

---

#### 4.2 Dia de Vencimento ⭐ IMPORTANTE
- **Pergunta**: "Qual dia você prefere para vencimento da fatura? (opções: 05, 10 ou 15)"
- **Formato**: Número inteiro
- **Opções**: 5, 10 ou 15
- **Campo**: `dia_vencimento`
- **Padrão**: Se não escolher, usar dia 10

---

#### 4.3 Data Prevista para Instalação 💡 OPCIONAL
- **Pergunta**: "Você tem alguma preferência de data para instalação?"
- **Formato**: Texto livre ou data DD/MM/AAAA
- **Exemplo**: "Próxima semana", "15/12/2024", "O quanto antes"
- **Campo**: `scheduling.expectedDate`
- **Nota**: Não prometer data específica, apenas registrar preferência

---

#### 4.4 Período de Disponibilidade 💡 OPCIONAL
- **Pergunta**: "Qual período você está disponível? (Manhã, Tarde ou Comercial)"
- **Formato**: Escolha única
- **Opções**: 
  - Manhã (8h-12h)
  - Tarde (13h-18h)
  - Comercial (8h-18h)
- **Campo**: `scheduling.availability`

---

#### 4.5 Telefone Secundário 💡 OPCIONAL
- **Pergunta**: "Tem um telefone secundário para contato? (opcional)"
- **Formato**: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
- **Exemplo**: "(11) 3456-7890"
- **Campo**: `phone2` ou `telefone_secundario`
- **Utilidade**: Backup se não conseguir contato no principal

---

#### 4.6 Observações 💡 OPCIONAL
- **Pergunta**: "Alguma observação ou pedido especial?"
- **Formato**: Texto livre
- **Exemplo**: "Instalar na sala dos fundos", "Tenho cachorro, favor tocar campainha"
- **Campo**: `observacoes` ou `observations`
- **Utilidade**: Informações relevantes para instalação

---

### 📝 SEÇÃO 5: Documentos (Geralmente Pendentes)

#### 5.1 Selfie com Documento 📸 IMPORTANTE
- **O que é**: Foto do cliente segurando RG ou CNH
- **Status**: Geralmente fica pendente no cadastro via chat
- **Orientação**: "Vamos precisar que você envie uma selfie segurando seu documento depois"
- **Campo**: `selfie_url`

---

#### 5.2 Foto do Documento 📸 IMPORTANTE
- **O que é**: Foto do RG ou CNH (frente e verso)
- **Status**: Geralmente fica pendente no cadastro via chat
- **Orientação**: "Nossa equipe vai solicitar foto do seu documento por WhatsApp"
- **Campo**: `documentFrontUrl`, `documentBackUrl`

---

## 🏢 FICHA DE COLETA - PESSOA JURÍDICA

### 📝 SEÇÃO 1: Dados da Empresa

#### 1.1 Razão Social ✅ OBRIGATÓRIO
- **Pergunta**: "Qual a Razão Social da empresa?"
- **Formato**: Texto livre (nome jurídico completo)
- **Exemplo**: "Tech Solutions Ltda"
- **Campo**: `nome_cliente` (no backend usa o mesmo campo)
- **Nota**: Nome que consta no CNPJ

---

#### 1.2 CNPJ ✅ OBRIGATÓRIO
- **Pergunta**: "Qual o CNPJ? (formato: 00.000.000/0000-00)"
- **Formato**: XX.XXX.XXX/XXXX-XX
- **Exemplo**: "12.345.678/0001-90"
- **Validação**: 
  - Verificar formato
  - Validar dígitos verificadores
  - Verificar se não está duplicado
- **Campo**: `cpf_cliente` (sistema usa mesmo campo)
- **Erro comum**: Cliente envia sem pontos/barras → formatar automaticamente

---

#### 1.3 Nome Fantasia ⭐ IMPORTANTE
- **Pergunta**: "Qual o Nome Fantasia?"
- **Formato**: Texto livre
- **Exemplo**: "TechSolutions"
- **Campo**: `nome_fantasia`
- **Nota**: Nome comercial da empresa

---

#### 1.4 Inscrição Estadual ⭐ IMPORTANTE
- **Pergunta**: "Qual a Inscrição Estadual?"
- **Formato**: Varia por estado
- **Exemplo**: "123.456.789.012"
- **Campo**: `inscricao_estadual`
- **Se isento**: Aceitar "ISENTO"

---

#### 1.5 Inscrição Municipal ⭐ IMPORTANTE
- **Pergunta**: "Qual a Inscrição Municipal?"
- **Formato**: Varia por município
- **Exemplo**: "9876543"
- **Campo**: `inscricao_municipal`

---

### 📝 SEÇÃO 2: Contato da Empresa

#### 2.1 E-mail Corporativo ✅ OBRIGATÓRIO
- **Pergunta**: "Qual o e-mail corporativo?"
- **Formato**: email@empresa.com.br
- **Exemplo**: "contato@techsolutions.com.br"
- **Campo**: `email_cliente`
- **Preferência**: E-mail com domínio da empresa

---

#### 2.2 Telefone Principal ✅ OBRIGATÓRIO
- **Pergunta**: "Qual o telefone principal da empresa com DDD?"
- **Formato**: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
- **Exemplo**: "(11) 3333-4444"
- **Campo**: `telefone_cliente`

---

#### 2.3 Telefone Secundário 💡 OPCIONAL
- **Pergunta**: "Tem um telefone secundário? (opcional)"
- **Formato**: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
- **Exemplo**: "(11) 99999-8888"
- **Campo**: `phone2`

---

### 📝 SEÇÃO 3: Endereço (Igual PF)
[Seguir mesma estrutura da Pessoa Física - Seção 3]

### 📝 SEÇÃO 4: Dados do Serviço (Igual PF)
[Seguir mesma estrutura da Pessoa Física - Seção 4]

---

## ✅ ETAPA FINAL: Confirmação dos Dados

### Checklist de Validação Pré-Envio

Antes de enviar os dados, verificar:

**Pessoa Física:**
- [ ] Nome completo coletado
- [ ] CPF válido e não duplicado
- [ ] E-mail em formato válido
- [ ] Telefone com DDD
- [ ] CEP válido e com cobertura
- [ ] Endereço completo (rua, número, bairro, cidade, UF)
- [ ] Plano escolhido e ativo
- [ ] Ao menos 70% dos campos importantes preenchidos

**Pessoa Jurídica:**
- [ ] Razão social coletada
- [ ] CNPJ válido e não duplicado
- [ ] E-mail corporativo válido
- [ ] Telefone da empresa com DDD
- [ ] CEP válido e com cobertura
- [ ] Endereço completo
- [ ] Plano escolhido e ativo

---

## 📊 Resumo para Confirmação

### Template de Resumo - Pessoa Física
```
Pronto! 🎉 Deixa eu confirmar tudo com você:

📋 RESUMO DO CADASTRO:
━━━━━━━━━━━━━━━━━━━
👤 Nome: [Nome Completo]
📄 CPF: [CPF]
📧 E-mail: [Email]
📱 Telefone: [Telefone] [+ Telefone 2 se tiver]
🏠 Endereço: [Rua], [Número][, Complemento], [Bairro], [Cidade] - [UF], CEP: [CEP]
📍 Referência: [Referência se tiver]
📶 Plano escolhido: [Nome do Plano] - R$ [Valor]/mês
💳 Vencimento: Dia [X]
📅 Instalação preferencial: [Data/Período]
[💬 Observações: [Obs] - se tiver]

Está tudo certo? (Se precisar corrigir algo, é só me avisar!)
```

### Template de Resumo - Pessoa Jurídica
```
Perfeito! Deixa eu confirmar os dados da empresa:

📋 RESUMO DO CADASTRO:
━━━━━━━━━━━━━━━━━━━
🏢 Empresa: [Razão Social] ([Nome Fantasia])
📄 CNPJ: [CNPJ]
📋 IE: [Inscrição Estadual] | IM: [Inscrição Municipal]
📧 E-mail: [Email]
📱 Telefones: [Telefone 1] [+ Telefone 2 se tiver]
🏢 Endereço: [Rua], [Número][, Complemento], [Bairro], [Cidade] - [UF], CEP: [CEP]
📶 Plano escolhido: [Nome do Plano] - R$ [Valor]/mês
💳 Vencimento: Dia [X]
📅 Instalação: [Data/Período]
[💬 Observações: [Obs] - se tiver]

Está tudo correto?
```

---

## 🚨 Tratamento de Erros Comuns

### Erro 1: Cliente Não Sabe a Informação
**Resposta**: 
```
"Sem problemas! [Campo X] não é obrigatório agora. 
Podemos deixar para completar depois. Vamos continuar?"
```

### Erro 2: Formato Incorreto
**Resposta**: 
```
"Ops! Parece que o [campo] está em um formato diferente. 
Você pode me enviar assim: [exemplo]?"
```

### Erro 3: CPF/CNPJ Já Cadastrado
**Ação**: 
```
"Vejo que já existe um cadastro com esse [CPF/CNPJ] no sistema.
Você já é cliente TR Telecom? Quer atualizar seu cadastro ou 
fazer uma nova instalação?"
```

### Erro 4: CEP Sem Cobertura
**Ação**: 
```
"Que pena! Ainda não chegamos na sua região 😔
Vou registrar seu interesse. Assim que tivermos cobertura 
no seu endereço, nossa equipe te avisa. Pode ser?"
```

### Erro 5: Cliente Desiste no Meio
**Ação**: 
```
"Percebo que temos que coletar bastante informação, né?

Se preferir, posso salvar o que já coletamos como LEAD 
e nossa equipe te liga para finalizar. O que prefere?

[Se aceitar]: "Ótimo! Registrei como lead. Em breve entraremos em contato!"
```

---

## 📈 Campos para Rastreamento (Automático)

Campos que devem ser preenchidos automaticamente pelo sistema:

- **utm_source**: De onde veio o lead (chat, site, etc)
- **utm_medium**: Meio (organic, cpc, referral)
- **utm_campaign**: Campanha específica
- **data_cadastro**: Data/hora do cadastro
- **usuario_vendedor**: "Site" ou "IA Chat" (se não for vendedor humano)
- **ip_origem**: IP de onde veio o cadastro
- **dispositivo**: Mobile/Desktop

---

## 🎯 Taxas de Completude Esperadas

**Mínimo Aceitável (para salvar como venda):**
- Pessoa Física: 60% dos campos obrigatórios + importantes
- Pessoa Jurídica: 70% dos campos obrigatórios + importantes

**Ideal (venda completa):**
- Pessoa Física: 90%+ de todos os campos
- Pessoa Jurídica: 95%+ de todos os campos

**Lead Qualificado (se não completar):**
- Mínimo: Nome + Telefone + Interesse no plano
- Bom: Nome + Telefone + Email + CEP + Plano

---

## 🔄 Fluxo de Coleta Resumido

```
1. Identificar tipo (CPF ou CNPJ)
   ↓
2. Coletar dados pessoais/empresariais básicos
   ↓
3. Coletar dados complementares
   ↓
4. Coletar endereço (validar cobertura!)
   ↓
5. Coletar dados do serviço
   ↓
6. Resumir e confirmar com cliente
   ↓
7. Enviar para API
   ↓
8. Informar próximos passos
```

---

## 📞 Próximos Passos Após Coleta

### O que informar ao cliente:

```
Perfeito! Seu cadastro foi realizado com sucesso! 🎉

📋 NÚMERO DO PROTOCOLO: [ID]

📌 PRÓXIMOS PASSOS:
━━━━━━━━━━━━━━━━━━━

1️⃣ Nossa equipe vai analisar seu cadastro (até 24h úteis)

2️⃣ Você vai receber contato no telefone [telefone] para:
   - Confirmar os dados
   - Agendar a instalação  
   - Esclarecer últimas dúvidas

3️⃣ Instalação profissional na data agendada

4️⃣ Internet instalada e funcionando!

📱 CONTATOS TR TELECOM:
- 📞 0800: [número]
- 💬 WhatsApp: [número]
- 📧 E-mail: contato@trtelecom.net

⚠️ DOCUMENTOS PENDENTES:
Você vai precisar enviar:
- 📸 Selfie segurando documento
- 📄 Foto do documento (frente e verso)

Nossa equipe vai te orientar sobre como enviar!

Alguma dúvida sobre os próximos passos?
```

---

## 💾 Formato JSON para Envio

### Pessoa Física
```json
{
  "nome_cliente": "string",
  "cpf_cliente": "string",
  "email_cliente": "string",
  "telefone_cliente": "string",
  "telefone_secundario": "string | optional",
  "nome_mae": "string | optional",
  "data_nascimento": "YYYY-MM-DD | optional",
  "rg": "string | optional",
  "sexo": "M | F",
  "estadoCivil": "S | C | V | O",
  "endereco": {
    "cep": "string",
    "endereco": "string",
    "numero": "string",
    "complemento": "string | optional",
    "bairro": "string",
    "cidade": "string",
    "estado": "string (UF)",
    "referencia": "string | optional"
  },
  "plano_id": "string",
  "dia_vencimento": "number (5, 10 ou 15)",
  "scheduling": {
    "expectedDate": "string | optional",
    "availability": "Manhã | Tarde | Comercial | optional"
  },
  "observacoes": "string | optional",
  "utm_source": "string | optional",
  "utm_medium": "string | optional",
  "utm_campaign": "string | optional"
}
```

### Pessoa Jurídica
```json
{
  "nome_cliente": "string (razão social)",
  "cpf_cliente": "string (CNPJ)",
  "nome_fantasia": "string",
  "inscricao_estadual": "string",
  "inscricao_municipal": "string",
  "email_cliente": "string",
  "telefone_cliente": "string",
  "telefone_secundario": "string | optional",
  "endereco": {
    "cep": "string",
    "endereco": "string",
    "numero": "string",
    "complemento": "string | optional",
    "bairro": "string",
    "cidade": "string",
    "estado": "string (UF)",
    "referencia": "string | optional"
  },
  "plano_id": "string",
  "dia_vencimento": "number (5, 10 ou 15)",
  "scheduling": {
    "expectedDate": "string | optional",
    "availability": "Manhã | Tarde | Comercial | optional"
  },
  "observacoes": "string | optional",
  "utm_source": "string | optional",
  "utm_medium": "string | optional",
  "utm_campaign": "string | optional"
}
```

---

## 🎓 Dicas Finais para a IA

### Durante a Coleta:
1. **Seja progressivo**: Não peça tudo de uma vez
2. **Contextualize**: Explique por que precisa da informação
3. **Valide em tempo real**: Não deixe para descobrir erro no final
4. **Seja paciente**: Cliente pode não saber algo imediatamente
5. **Celebre progresso**: "Ótimo!", "Perfeito!", "Estamos quase lá!"

### Priorização:
1. Primeiro: Dados que qualificam (nome, contato, endereço)
2. Segundo: Dados do serviço (plano, vencimento)
3. Terceiro: Dados complementares
4. Último: Informações opcionais

### Se o Cliente Abandonar:
- Salvar como LEAD com os dados coletados até o momento
- Mínimo necessário: Nome + Telefone + Interesse
- Equipe comercial pode retomar depois

---

**✅ Lembre-se**: É melhor ter um lead qualificado (70% completo) do que perder o cliente por pedir informação demais de uma vez!

---

*Ficha de Coleta v1.0 - TR Telecom*
*Para uso exclusivo da IA de atendimento comercial*

