console.log('\n🔍 Verificando IDs dos Assistants OpenAI...\n');

const assistants = {
  'CORTEX': process.env.CORTEX_ASSISTANT_ID,
  'APRESENTACAO': process.env.OPENAI_APRESENTACAO_ASSISTANT_ID,
  'COMERCIAL': process.env.OPENAI_COMMRCIAL_ASSISTANT_ID,
  'FINANCEIRO': process.env.OPENAI_FINANCEIRO_ASSISTANT_ID,
  'SUPORTE': process.env.OPENAI_SUPORTE_ASSISTANT_ID,
  'OUVIDORIA': process.env.OPENAI_OUVIDOIRA_ASSISTANT_ID,
  'CANCELAMENTO': process.env.OPENAI_CANCELAMENTO_ASSISTANT_ID,
  'COBRANCA': process.env.OPENAI_COBRANCA_ASSISTANT_ID,
};

let hasErrors = false;

for (const [name, id] of Object.entries(assistants)) {
  if (!id) {
    console.log(`❌ ${name}: NÃO CONFIGURADO`);
    hasErrors = true;
  } else if (!id.startsWith('asst_')) {
    console.log(`❌ ${name}: INVÁLIDO (${id})`);
    console.log(`   ⚠️  IDs de assistants devem começar com 'asst_'`);
    hasErrors = true;
  } else {
    console.log(`✅ ${name}: ${id}`);
  }
}

if (hasErrors) {
  console.log('\n⚠️  AÇÃO NECESSÁRIA: Configure os IDs inválidos no painel Secrets do Replit\n');
} else {
  console.log('\n✅ Todos os assistants estão configurados corretamente!\n');
}
