# HAG - Guia de Ajuda para IA: Atendimento e Vendas TR Telecom

## Visão Geral

Este documento serve como guia para a IA de atendimento ao cliente da TR Telecom, ensinando como processar cadastros de novos clientes, consultar planos disponíveis e orientar sobre os serviços oferecidos pela empresa.

## Tipos de Cadastro

### 1. Pessoa Física (CPF)
Para clientes pessoa física, o sistema coleta dados pessoais completos.

### 2. Pessoa Jurídica (CNPJ)
Para empresas, o sistema adapta os campos para dados corporativos.

## Dados Necessários para Cadastro

### Para Pessoa Física - Informações Obrigatórias
**Dados Pessoais:**
- Nome completo
- CPF (formato: XXX.XXX.XXX-XX)
- Nome da mãe
- Data de nascimento (formato: DD/MM/AAAA)
- RG
- Sexo (Masculino/Feminino)
- Estado civil (Solteiro/Casado/Viúvo/Outros)
- E-mail válido
- Telefone principal (com DDD)

**Endereço Completo:**
- CEP (formato: XXXXX-XXX)
- Rua/Logradouro
- Número
- Bairro
- Cidade
- Estado (UF)

**Dados do Serviço:**
- Plano escolhido

### Para Pessoa Jurídica - Informações Obrigatórias
**Dados da Empresa:**
- Razão Social
- CNPJ (formato: XX.XXX.XXX/XXXX-XX)
- Nome Fantasia
- Inscrição Estadual
- Inscrição Municipal
- E-mail válido
- Telefone principal (com DDD)

**Endereço Completo:**
- CEP (formato: XXXXX-XXX)
- Rua/Logradouro
- Número
- Bairro
- Cidade
- Estado (UF)

**Dados do Serviço:**
- Plano escolhido

### Informações Adicionais (Opcionais mas Importantes)
- Telefone secundário
- Complemento do endereço
- Ponto de referência
- Dia de vencimento preferido (05, 10 ou 15)
- Forma de pagamento
- Data preferida para instalação
- Período de disponibilidade (Manhã/Tarde/Comercial)
- Observações especiais

## Nossos Planos e Serviços

### Tipos de Planos Disponíveis

**Planos de Internet:**
- Conexão de alta velocidade
- Velocidades variadas conforme necessidade
- Tecnologia fibra óptica

**Planos Combo:**
- Internet + outros serviços
- Pacotes promocionais
- Benefícios especiais

### Planos Disponíveis

**Principais Planos da TR Telecom:**

1. **Plano 50 Mega**
   - ID para API: `17`
   - Velocidade: 50 Mbps
   - Preço: R$ 69,90/mês
   - Tipo: Internet

2. **Plano 650 Mega**
   - ID para API: `22`
   - Velocidade: 650 Mbps
   - Preço: R$ 109,90/mês
   - Tipo: Internet

3. **Plano 1 Gigabyte**
   - ID para API: `23`
   - Velocidade: 1000 Mbps (1 Gbps)
   - Preço: R$ 149,90/mês
   - Tipo: Internet

### Como Consultar Outros Planos
Para verificar todos os planos disponíveis e seus detalhes, use o sistema de consulta que retorna:
- Nome do plano
- Tipo (internet ou combo)
- Preço mensal
- Descrição dos benefícios
- Status de disponibilidade

## Endpoints para Cadastro

### 1. Cadastro via Interface (Sistema Interno)
**Função:** `addSale()` no contexto do aplicativo
- Usado pelos usuários internos do sistema
- Requer autenticação
- Permite upload de documentos e selfie

### 2. Cadastro via API Externa - Site Integration
**Endpoint:** `POST /api/site-lead`

#### Headers Necessários
```
Content-Type: application/json
```

#### Estrutura da Requisição
```json
{
  "nome_cliente": "string",
  "telefone_cliente": "string",
  "cpf_cliente": "string (opcional)",
  "email_cliente": "string (opcional)",
  "nome_mae": "string (opcional)",
  "data_nascimento": "string (YYYY-MM-DD, opcional)",
  "rg": "string (opcional)",
  "endereco": {
    "endereco": "string",
    "numero": "string",
    "bairro": "string",
    "cidade": "string",
    "estado": "string",
    "cep": "string",
    "complemento": "string (opcional)",
    "referencia": "string (opcional)"
  },
  "plano_id": "string",
  "dia_vencimento": "number (opcional)",
  "valor_mensal": "number (opcional - será preenchido automaticamente se não informado)",
  "produtos_adicionais": [
    {
      "produto_id": "string",
      "quantidade": "number",
      "valor_unitario": "number"
    }
  ],
  "observacoes": "string (opcional)",
  "utm_source": "string (opcional)",
  "utm_medium": "string (opcional)",
  "utm_campaign": "string (opcional)"
}
```

#### Resposta de Sucesso (201)
```json
{
  "success": true,
  "message": "Venda recebida e processada com sucesso",
  "sale_id": "uuid-da-venda",
  "status": "Aguardando Análise",
  "vendedor": "Site",
  "itens_pendentes": [
    "Foto/Selfie",
    "Nome da mãe",
    "Data de nascimento"
  ]
}
```

#### Resposta de Erro (400)
```json
{
  "success": false,
  "message": "Dados inválidos: Nome do cliente é obrigatório, Telefone do cliente é obrigatório"
}
```

### 3. Endpoint para Leads Simples
**Endpoint:** `POST /api/leads`

#### Estrutura da Requisição
```json
{
  "nomeCompleto": "string",
  "telefone": "string"
}
```

## Validações Importantes

### Validação de CPF
- Formato: XXX.XXX.XXX-XX
- Deve ser um CPF válido (algoritmo de validação)

### Validação de CNPJ
- Formato: XX.XXX.XXX/XXXX-XX
- Deve ser um CNPJ válido (algoritmo de validação)

### Validação de Email
- Deve seguir formato padrão de email válido

### Validação de Telefone
- Deve incluir DDD
- Formato recomendado: (XX) XXXXX-XXXX

### Validação de CEP
- Formato: XXXXX-XXX
- Deve ser um CEP válido

## Status de Vendas

Os clientes cadastrados recebem os seguintes status:
- **Prospecção**: Lead inicial
- **Aguardando Análise**: Aguardando validação dos dados
- **Aprovado/Aprovada**: Cliente aprovado
- **Agendado para Instalação/Agendada**: Agendado para instalação
- **Instalado**: Cliente instalado
- **Cancelado/Desistência**: Venda cancelada
- **Inadimplente**: Cliente em atraso

## Itens que Podem Ficar Pendentes

Para leads criados via site, o sistema identifica automaticamente:
- Foto/Selfie do cliente (sempre pendente para site)
- Nome da mãe (para pessoa física)
- Data de nascimento (para pessoa física)
- RG (para pessoa física)
- E-mail
- Complemento do endereço
- Referência do endereço
- Dia de vencimento da fatura

## Comportamento do Sistema

### Vendas via Site
- Vendedor identificado como "Site"
- Status inicial: "Aguardando Análise"
- Selfie sempre marcada como pendente
- UTM parameters salvos para rastreamento

### Prevenção de Duplicatas
- Verificação por telefone em múltiplas tabelas
- Verificação por CPF/CNPJ
- Verificação por email

## Exemplos Práticos de Integração

### Exemplo 1: Cadastro no Plano 50 Mega
```bash
curl -X POST https://comercial.trtelecom.net/api/site-lead \
  -H "Content-Type: application/json" \
  -d '{
    "nome_cliente": "João Silva",
    "telefone_cliente": "(11) 99999-9999",
    "email_cliente": "joao@email.com",
    "cpf_cliente": "123.456.789-00",
    "endereco": {
      "endereco": "Rua das Flores",
      "numero": "123",
      "bairro": "Centro",
      "cidade": "São Paulo",
      "estado": "SP",
      "cep": "01234-567"
    },
    "plano_id": "1",
    "dia_vencimento": 10
  }'
```

### Exemplo 2: Cadastro no Plano 650 Mega
```bash
curl -X POST https://comercial.trtelecom.net/api/site-lead \
  -H "Content-Type: application/json" \
  -d '{
    "nome_cliente": "Maria Santos",
    "telefone_cliente": "(11) 98765-4321",
    "email_cliente": "maria@email.com",
    "cpf_cliente": "987.654.321-00",
    "endereco": {
      "endereco": "Av. Paulista",
      "numero": "1000",
      "bairro": "Bela Vista",
      "cidade": "São Paulo",
      "estado": "SP",
      "cep": "01310-100"
    },
    "plano_id": "2",
    "dia_vencimento": 15
  }'
```

### Exemplo 3: Cadastro no Plano 1 Gigabyte
```bash
curl -X POST https://comercial.trtelecom.net/api/site-lead \
  -H "Content-Type: application/json" \
  -d '{
    "nome_cliente": "Carlos Oliveira",
    "telefone_cliente": "(11) 91234-5678",
    "email_cliente": "carlos@email.com",
    "cpf_cliente": "456.789.123-00",
    "endereco": {
      "endereco": "Rua Augusta",
      "numero": "500",
      "bairro": "Consolação",
      "cidade": "São Paulo",
      "estado": "SP",
      "cep": "01305-000"
    },
    "plano_id": "3",
    "dia_vencimento": 20
  }'
```

## Notas Importantes para a IA

1. **Sempre validar dados obrigatórios** antes de processar
2. **Verificar se o plano existe e está ativo** antes de criar a venda
3. **Prevenir duplicatas** verificando telefone, CPF/CNPJ e email
4. **Identificar itens pendentes** para leads incompletos
5. **Salvar UTM parameters** quando disponíveis para análise
6. **Tratar erros de forma adequada** com mensagens claras
7. **Considerar diferentes tipos de documento** (CPF vs CNPJ)
8. **Respeitar validações de formato** para todos os campos

## Estrutura de Banco de Dados

### Tabela Principal: `sales`
- `customer`: JSON com dados do cliente
- `plan_id`: ID do plano selecionado
- `addons`: Array com produtos adicionais
- `status`: Status atual da venda
- `usuario_id`: ID do vendedor (null para vendas do site)

### Tabela: `plans`
- `id`, `name`, `type`, `price`, `description`, `commission`, `is_active`

### Tabela: `usuarios`
- Dados dos vendedores e usuários do sistema
