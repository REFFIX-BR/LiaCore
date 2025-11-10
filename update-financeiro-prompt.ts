/**
 * Script temporário para atualizar o prompt do Financeiro v2.4.0
 * 
 * Adiciona verificação de status de pagamento (72h) - Caso Ionara
 */

import { getAssistantInstructions, updateAssistantPrompt } from "./server/lib/openai";
import * as fs from "fs";

async function main() {
  console.log("🔍 Buscando prompt atual do Financeiro...");
  
  try {
    // 1. Buscar prompt atual
    const currentPrompt = await getAssistantInstructions('financeiro');
    console.log(`✅ Prompt atual obtido (${currentPrompt.length} caracteres)`);
    
    // Salvar backup do prompt atual
    fs.writeFileSync('/tmp/financeiro_prompt_backup.txt', currentPrompt);
    console.log("💾 Backup salvo em /tmp/financeiro_prompt_backup.txt");
    
    // 2. Ler nova seção
    const newSection = fs.readFileSync('/tmp/insert_section_instruction.txt', 'utf-8');
    console.log(`📄 Nova seção lida (${newSection.length} caracteres)`);
    
    // 3. Encontrar onde inserir (antes da seção de desbloqueio)
    // Conforme orientação do Architect: inserir antes do fluxo de desbloqueio
    
    const insertMarker = "## 🔓 FLUXO: DESBLOQUEIO DE CONEXÃO";
    const insertIndex = currentPrompt.indexOf(insertMarker);
    
    if (insertIndex === -1) {
      console.error("❌ Marcador de inserção não encontrado no prompt atual");
      console.log("📋 Prompt atual:");
      console.log(currentPrompt);
      process.exit(1);
    }
    
    // 4. Construir novo prompt
    const newPrompt = 
      currentPrompt.slice(0, insertIndex) +
      "\n\n" + newSection + "\n\n" +
      currentPrompt.slice(insertIndex);
    
    // Salvar preview do novo prompt
    fs.writeFileSync('/tmp/financeiro_prompt_v2.4.0.txt', newPrompt);
    console.log("💾 Preview do novo prompt salvo em /tmp/financeiro_prompt_v2.4.0.txt");
    
    console.log("\n📊 ESTATÍSTICAS:");
    console.log(`  - Prompt antigo: ${currentPrompt.length} caracteres`);
    console.log(`  - Nova seção: ${newSection.length} caracteres`);
    console.log(`  - Prompt novo: ${newPrompt.length} caracteres`);
    console.log(`  - Diferença: +${newPrompt.length - currentPrompt.length} caracteres`);
    
    console.log("\n⚠️  ATENÇÃO: Execute 'node --loader tsx update-financeiro-prompt.ts apply' para aplicar");
    
    // 5. Aplicar se argumento 'apply' for passado
    if (process.argv.includes('apply')) {
      console.log("\n🚀 Aplicando atualização no OpenAI...");
      await updateAssistantPrompt('financeiro', newPrompt);
      console.log("✅ Prompt do Financeiro atualizado para v2.4.0!");
    }
    
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

main();
