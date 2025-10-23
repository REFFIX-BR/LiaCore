# Sistema de Departamentos - Documentação Técnica

## Arquitetura

### Schema de Banco de Dados

#### Tabela: `users`
```typescript
departments: text("departments").array().default(sql`ARRAY[]::text[]`)
```
- Array de strings contendo os departamentos do usuário
- Valores possíveis: `['general', 'commercial', 'financial', 'support', 'cancellation']`
- Default: array vazio `[]`

#### Tabela: `conversations`
```typescript
department: text("department")
```
- String indicando o departamento da conversa
- Valores possíveis: `'general' | 'commercial' | 'financial' | 'support' | 'cancellation'`
- Pode ser `null` para conversas legadas (backward compatibility)

---

## Mapeamento Assistente → Departamento

### Constante: `ASSISTANT_TO_DEPARTMENT`

**Arquivo:** `server/lib/openai.ts`

```typescript
export const ASSISTANT_TO_DEPARTMENT: Record<string, string> = {
  'cortex': 'general',
  'apresentacao': 'general',
  'comercial': 'commercial',
  'financeiro': 'financial',
  'suporte': 'support',
  'ouvidoria': 'cancellation',
  'cancelamento': 'cancellation'
};
```

### Atribuição Automática

O departamento é atribuído automaticamente em dois momentos:

#### 1. Criação de Conversa
**Arquivo:** `server/lib/openai.ts` → função `createConversation`

```typescript
const department = ASSISTANT_TO_DEPARTMENT[assistantType] || null;

const conversation = await storage.createConversation({
  // ... outros campos
  department
});
```

#### 2. Roteamento Interno (AI → AI)
**Arquivo:** `server/lib/openai.ts` → função `handleInternalRouting`

```typescript
const newDepartment = ASSISTANT_TO_DEPARTMENT[targetAssistant] || conversation.department;

await storage.updateConversation(conversationId, {
  // ... outros campos
  department: newDepartment
});
```

**Nota:** Quando a IA roteia para outro assistente, o departamento é atualizado mesmo que não seja transferência para humano.

---

## Endpoints da API

### GET /api/conversations/transferred

**Descrição:** Lista conversas transferidas para humanos (fila de atendimento)

**Autenticação:** Bearer token

**Filtro por Departamento:**
```typescript
// Implementado em: server/storage.ts → getTransferredConversations

if (role === 'AGENT' && userId) {
  const user = await this.getUser(userId);
  const userDepartments = user?.departments || [];
  
  // Backward compatibility: sem departments = ver tudo
  if (userDepartments.length === 0) {
    return conversations;
  }
  
  return conversations.filter(conv => {
    // Backward compatibility: conversa sem department = visível
    if (!conv.department) return true;
    // Filtro: apenas departamentos do agente
    return userDepartments.includes(conv.department);
  });
}
```

**Resposta:**
```json
[
  {
    "id": "conv-123",
    "clientName": "João Silva",
    "department": "commercial",
    "lastMessage": "Quero contratar plano",
    "transferredAt": "2025-10-23T10:30:00Z"
  }
]
```

---

### GET /api/conversations/assigned

**Descrição:** Lista conversas atribuídas ao usuário atual

**Autenticação:** Bearer token

**Filtro por Departamento:**
```typescript
// Implementado em: server/routes.ts

const assignedConversations = allConversations.filter(conv => {
  if (!conv.transferredToHuman) return false;
  if (conv.status !== 'active' && conv.status !== 'queued') return false;
  if (!conv.assignedTo) return false;
  
  if (isAdminOrSupervisor) {
    return true;
  } else {
    // Agente vê apenas suas próprias atribuições
    if (conv.assignedTo !== userId) return false;
    
    // Backward compatibility
    if (userDepartments.length === 0) return true;
    if (!conv.department) return true;
    
    // Filtro por departamento
    return userDepartments.includes(conv.department);
  }
});
```

---

### PATCH /api/users/:id/departments

**Descrição:** Atualiza departamentos de um usuário (somente ADMIN)

**Autenticação:** Bearer token (role: ADMIN)

**Request Body:**
```json
{
  "departments": ["commercial", "support"]
}
```

**Validação:**
```typescript
const updateDepartmentsSchema = z.object({
  departments: z.array(z.enum([
    'general',
    'commercial', 
    'financial',
    'support',
    'cancellation'
  ])).min(0).max(5)
});
```

**Resposta (200):**
```json
{
  "id": "user-123",
  "username": "joao.silva",
  "fullName": "João Silva",
  "role": "AGENT",
  "departments": ["commercial", "support"]
}
```

**Respostas de Erro:**
- `400` - Validação falhou
- `403` - Usuário não é ADMIN
- `404` - Usuário não encontrado

---

## Frontend

### Componente: Users.tsx

**Gerenciamento de Departamentos**

```tsx
// Dialog com multi-select checkboxes
<Dialog>
  <DialogContent>
    <DialogTitle>Gerenciar Departamentos</DialogTitle>
    
    {/* Checkboxes para cada departamento */}
    {departmentOptions.map(dept => (
      <Checkbox
        checked={selectedDepartments.includes(dept.value)}
        onCheckedChange={(checked) => {
          // Toggle departamento
        }}
      />
    ))}
    
    <Button onClick={handleSave}>
      Salvar Alterações
    </Button>
  </DialogContent>
</Dialog>
```

**Mutation:**
```tsx
const updateDepartmentsMutation = useMutation({
  mutationFn: async (data: { userId: string; departments: string[] }) => {
    return apiRequest(`/api/users/${data.userId}/departments`, {
      method: 'PATCH',
      body: JSON.stringify({ departments: data.departments })
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    toast({ title: 'Departamentos atualizados' });
  }
});
```

---

### Componente: Conversations.tsx

**Badges de Departamento**

```tsx
const departmentColors: Record<string, string> = {
  general: 'bg-green-500/20 text-green-700 dark:text-green-300',
  commercial: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  financial: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  support: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  cancellation: 'bg-red-500/20 text-red-700 dark:text-red-300'
};

{conversation.department && (
  <Badge className={departmentColors[conversation.department]}>
    {departmentLabels[conversation.department]}
  </Badge>
)}
```

---

## Lógica de Acesso

### Matriz de Permissões

| Role | Conversas Transferred | Conversas Assigned | Pode Gerenciar Departments |
|------|----------------------|-------------------|---------------------------|
| **ADMIN** | Todas | Todas | ✅ Sim |
| **SUPERVISOR** | Todas | Todas | ❌ Não |
| **AGENT** | Apenas seus departments | Apenas suas atribuições + departments | ❌ Não |

### Backward Compatibility

**Regras:**

1. **Agente sem departments configurados:**
   - Vê todas as conversas (comportamento legacy)
   - Permite transição gradual

2. **Conversa sem department:**
   - Visível para todos os agentes
   - Permite migração sem quebrar conversas existentes

3. **Supervisores/Admins:**
   - Sempre veem tudo, independente de departments

---

## Fluxo de Dados

### Criação de Conversa

```
Cliente envia mensagem
    ↓
createConversation()
    ↓
Identifica assistantType (ex: 'comercial')
    ↓
Busca em ASSISTANT_TO_DEPARTMENT
    ↓
Define department = 'commercial'
    ↓
Salva conversa com department
```

### Roteamento AI → AI

```
AI decide rotear para outro assistente
    ↓
handleInternalRouting()
    ↓
Identifica targetAssistant (ex: 'financeiro')
    ↓
Busca em ASSISTANT_TO_DEPARTMENT
    ↓
Atualiza department = 'financial'
    ↓
Atualiza conversa
```

### Transferência para Humano

```
AI transfere para humano
    ↓
Conversa marcada: transferredToHuman = true
    ↓
Aparece em /api/conversations/transferred
    ↓
Filtro por department aplicado para AGENTs
    ↓
Agente vê conversa se tiver o department
```

---

## Testes

### Casos de Teste Recomendados

#### 1. Criação de Conversa
```typescript
test('deve atribuir department correto ao criar conversa', async () => {
  const conv = await createConversation({
    assistantType: 'comercial'
  });
  expect(conv.department).toBe('commercial');
});
```

#### 2. Roteamento Interno
```typescript
test('deve atualizar department ao rotear AI→AI', async () => {
  await handleInternalRouting(convId, 'financeiro');
  const conv = await getConversation(convId);
  expect(conv.department).toBe('financial');
});
```

#### 3. Filtro de Agente
```typescript
test('agente com department commercial vê apenas conversas commercial', async () => {
  const agent = await getUser('agent-123');
  agent.departments = ['commercial'];
  
  const conversations = await getTransferredConversations('agent-123', 'AGENT');
  
  conversations.forEach(conv => {
    expect(['commercial', null]).toContain(conv.department);
  });
});
```

#### 4. Backward Compatibility
```typescript
test('agente sem departments vê todas as conversas', async () => {
  const agent = await getUser('agent-123');
  agent.departments = [];
  
  const conversations = await getTransferredConversations('agent-123', 'AGENT');
  
  expect(conversations.length).toBeGreaterThan(0);
});
```

---

## Monitoramento

### Métricas Sugeridas

- Conversas por departamento
- Taxa de transferência por departamento
- Tempo médio de atendimento por departamento
- Distribuição de agentes por departamento

### Logs Importantes

```typescript
console.log('[Department] Conversa criada:', {
  conversationId,
  assistantType,
  department
});

console.log('[Department] Roteamento interno:', {
  conversationId,
  from: currentAssistant,
  to: targetAssistant,
  newDepartment
});
```

---

## Manutenção

### Adicionar Novo Departamento

1. **Atualizar Schema:**
```typescript
// shared/schema.ts
z.enum(['general', 'commercial', 'financial', 'support', 'cancellation', 'NOVO'])
```

2. **Atualizar Mapeamento:**
```typescript
// server/lib/openai.ts
export const ASSISTANT_TO_DEPARTMENT = {
  // ... existentes
  'novo_assistente': 'NOVO'
};
```

3. **Atualizar Frontend:**
```typescript
// client/src/pages/Users.tsx
const departmentOptions = [
  // ... existentes
  { value: 'NOVO', label: 'Novo Departamento' }
];

const departmentColors = {
  // ... existentes
  NOVO: 'bg-color-500/20 text-color-700'
};
```

4. **Executar Migration:**
```bash
npm run db:push --force
```

---

## Troubleshooting

### Problema: Agente não vê conversas

**Debug:**
```typescript
// Verificar departments do agente
const user = await storage.getUser(userId);
console.log('User departments:', user.departments);

// Verificar department da conversa
const conv = await storage.getConversation(convId);
console.log('Conversation department:', conv.department);
```

### Problema: Department não atualiza no roteamento

**Verificar:**
- `ASSISTANT_TO_DEPARTMENT` contém o assistente?
- Função `handleInternalRouting` está sendo chamada?
- Campo `department` existe no schema?

---

## Performance

### Otimizações Implementadas

1. **Filtro em Memória:** 
   - Filtro de departments aplicado após query SQL
   - Evita complexidade de queries dinâmicas

2. **Cache de Usuário:**
   - Dados do usuário recuperados uma vez por request
   - Reutilizados no filtro

3. **Batch Query:**
   - Nomes de agentes buscados em lote
   - Evita N+1 queries

### Otimizações Futuras

- Índice em `conversations.department`
- Cache Redis de departments por usuário
- Filtro SQL nativo (se complexidade justificar)
