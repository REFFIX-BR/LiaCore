# Documentação LIA CORTEX

## 📚 Índice de Documentos

### Guias do Sistema de Gerenciamento de Prompts

| Documento | Público-Alvo | Descrição |
|-----------|-------------|-----------|
| **[Guia Rápido do Usuário](./GUIA_RAPIDO_USUARIO.md)** | Admins e Supervisores | Guia prático e simplificado para editar prompts (não técnico) |
| **[Guia Técnico Completo](./PROMPT_MANAGEMENT_GUIDE.md)** | Desenvolvedores | Documentação técnica detalhada com arquitetura, API, schemas e troubleshooting |

---

## 🎯 Qual documento ler?

### Para Usuários (Admins/Supervisores)
👉 **[Leia o Guia Rápido](./GUIA_RAPIDO_USUARIO.md)**

Use este guia se você precisa:
- ✅ Editar instruções dos assistentes de IA
- ✅ Melhorar prompts usando análise da IA
- ✅ Publicar novas versões
- ✅ Resolver problemas comuns
- ✅ Entender o fluxo de trabalho básico

**Tempo de leitura**: ~10 minutos  
**Nível**: Iniciante (não requer conhecimento técnico)

---

### Para Desenvolvedores
👉 **[Leia o Guia Técnico](./PROMPT_MANAGEMENT_GUIDE.md)**

Use este guia se você precisa:
- ✅ Entender a arquitetura do sistema
- ✅ Modificar ou estender funcionalidades
- ✅ Integrar com outros sistemas
- ✅ Debugar problemas técnicos
- ✅ Conhecer schemas, APIs e validações

**Tempo de leitura**: ~30 minutos  
**Nível**: Avançado (requer conhecimento técnico)

---

## 🚀 Visão Geral Rápida

### O que é o Sistema de Gerenciamento de Prompts?

Uma plataforma completa para editar, analisar e versionar as instruções dos 6 assistentes de IA do LIA CORTEX (Apresentação, Comercial, Suporte, Financeiro, Ouvidoria, Cancelamento).

### Principais Funcionalidades

1. **Editor Visual** com contador de tokens em tempo real
2. **Análise por IA** usando GPT-4o (score 0-100 + sugestões)
3. **Versionamento Semântico** (major.minor.patch)
4. **Comparador Side-by-Side** (produção vs. rascunho)
5. **Sincronização OpenAI** automática ao publicar
6. **Histórico Completo** com restauração de versões
7. **Validação Robusta** com Zod schemas
8. **Indicadores Visuais** de erro de sincronização

### Fluxo Básico

```
Editar → Salvar Rascunho → Análise IA → Implementar Sugestões → 
Comparar → Publicar → Produção ✅
```

---

## 🛠️ Stack Tecnológico

- **Frontend**: React + TypeScript + TanStack Query + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **IA**: OpenAI GPT-4o + Assistants API
- **Validação**: Zod schemas
- **Tokens**: js-tiktoken (cl100k_base)

---

## 📊 Melhorias de Produção Implementadas

### v1.3.0 (Atual)

#### 1. Validação Zod
- ✅ Schema safety para payloads da IA
- ✅ Previne corrupção de dados
- ✅ Defaults inteligentes

#### 2. Indicador de Erro de Sync
- ✅ Badge vermelho visual
- ✅ Tooltip com mensagem de erro
- ✅ Persistência no banco

#### 3. Bundle Optimization
- ✅ Lazy loading de js-tiktoken
- ✅ Redução de ~500KB no bundle
- ✅ Code-splitting automático

**Resultados dos Testes E2E**: ✅ 100% aprovado

---

## 📞 Suporte

### Contatos
- **Email**: admin@liacortex.com
- **Logs**: Menu → Ferramentas → Logs
- **Issues**: Reporte problemas técnicos ao time de desenvolvimento

### Recursos Externos
- [OpenAI Assistants API](https://platform.openai.com/docs/assistants)
- [Zod Documentation](https://zod.dev)
- [Semantic Versioning](https://semver.org)
- [Drizzle ORM](https://orm.drizzle.team)

---

## 📝 Versionamento dos Documentos

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0 | 15/01/2025 | Documentação inicial completa |

---

**Mantido por**: LIA CORTEX Development Team  
**Última atualização**: 15/01/2025
