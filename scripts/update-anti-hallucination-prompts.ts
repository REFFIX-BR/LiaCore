import { updateAssistantPrompt, getAssistantInstructions } from '../server/lib/openai';

const ANTI_HALLUCINATION_RULE = `

## 🚨 REGRA CRÍTICA - NUNCA USE DADOS DE COMPROVANTES COMO DADOS DO CLIENTE

**⚠️ EVITAR ALUCINAÇÃO:**

Quando cliente envia comprovante de pagamento (Pix, boleto, recibo), os dados de endereço no comprovante são do **RECEBEDOR (empresa TR Telecom)**, NÃO do cliente!

**Estrutura de um comprovante Pix:**
- Recebedor: TR TELECOM ← EMPRESA (recebedor)
- Logradouro: NELSON VIANA, 513 ← ENDEREÇO DA EMPRESA
- Cidade: SAO PAULO ← CIDADE DA EMPRESA

**NUNCA faça isso:**
- ❌ "Confirma se seu endereço é Nelson Viana, 513?" (isso é endereço da EMPRESA!)
- ❌ Usar dados de localização do comprovante como dados do cliente
- ❌ Misturar cidade e estado de forma incoerente (ex: "São Paulo - RJ")

**Do comprovante, você pode usar APENAS:**
- ✅ Nome do pagador (cliente)
- ✅ CPF parcial do pagador (para confirmação)
- ✅ Valor pago
- ✅ Data/hora do pagamento
- ✅ ID da transação

**Se precisar do endereço do cliente:**
- ✅ Use a função verificar_conexao com CPF para buscar dados reais do CRM
- ✅ Pergunte diretamente ao cliente: "Qual seu endereço completo?"
`;

async function main() {
  console.log('🔧 Atualizando prompts com regra anti-alucinação de endereço...\n');
  
  const assistants = ['suporte', 'financeiro'];
  
  for (const assistant of assistants) {
    try {
      console.log(`📋 Buscando prompt atual de ${assistant}...`);
      const currentPrompt = await getAssistantInstructions(assistant);
      
      console.log(`📏 Tamanho atual: ${currentPrompt.length} caracteres`);
      
      if (currentPrompt.includes('NUNCA USE DADOS DE COMPROVANTES COMO DADOS DO CLIENTE')) {
        console.log(`⏭️  ${assistant}: Regra anti-alucinação já existe no prompt\n`);
        continue;
      }
      
      const newPrompt = currentPrompt + ANTI_HALLUCINATION_RULE;
      
      console.log(`📏 Tamanho novo: ${newPrompt.length} caracteres`);
      console.log(`🔄 Atualizando ${assistant}...`);
      
      await updateAssistantPrompt(assistant, newPrompt);
      console.log(`✅ ${assistant}: Prompt atualizado com sucesso!\n`);
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${assistant}:`, error);
    }
  }
  
  console.log('🎉 Processo concluído!');
  console.log('\n📝 Regra adicionada:');
  console.log('- Nunca usar endereço de comprovante Pix como endereço do cliente');
  console.log('- Endereço no comprovante é do RECEBEDOR (TR Telecom)');
  console.log('- Se precisar de endereço, perguntar ao cliente ou buscar no CRM');
}

main().catch(console.error);
