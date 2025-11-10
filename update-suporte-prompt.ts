/**
 * Script para atualizar o prompt do Suporte v2.1.0
 * 
 * Adiciona verificação de status de pagamento (72h) - Caso Ionara
 */

import { getAssistantInstructions, updateAssistantPrompt } from "./server/lib/openai";
import * as fs from "fs";

async function main() {
  console.log("🔍 Buscando prompt atual do Suporte...");
  
  try {
    // 1. Buscar prompt atual
    const currentPrompt = await getAssistantInstructions('suporte');
    console.log(`✅ Prompt atual obtido (${currentPrompt.length} caracteres)`);
    
    // Salvar backup
    fs.writeFileSync('/tmp/suporte_prompt_backup.txt', currentPrompt);
    console.log("💾 Backup salvo em /tmp/suporte_prompt_backup.txt");
    
    // 2. Nova seção (adaptada para Suporte)
    const newSection = `## 💰 FLUXO: VERIFICAÇÃO PRÉVIA DE INADIMPLÊNCIA (72h)

### 🚨 REGRA CRÍTICA: VERIFICAR ANTES DE DIAGNOSTICAR PROBLEMA TÉCNICO

**QUANDO USAR:** Cliente reclama de conexão bloqueada/cortada/sem internet

**PASSO 1: Verificar Status de Pagamento ANTES de diagnosticar**
- ✅ **SEMPRE** chame \`verificar_status_pagamento()\` quando:
  - Cliente menciona "cortou", "bloqueou", "sem internet", "não conecta"
  - Cliente já enviou comprovante anteriormente (checar histórico)
  - Cliente questiona por que ainda está sem acesso

**PASSO 2: Interpretar Resultado**

---

**✅ Se \`pendingWithProof: true\` (COMPROVANTE AGUARDANDO COMPENSAÇÃO):**

\`\`\`
Olá [NOME]! Vi aqui que você já enviou o comprovante de pagamento (Protocolo: [ticketProtocolo]) 🧾

A compensação bancária leva até 72 horas para ser processada. 

📅 Comprovante enviado: [formatar ticketCreatedAt para data legível]
⏰ Prazo para compensação: até [formatar deadlineEta para data/hora legível]

Durante esse período, pode ocorrer instabilidade temporária na conexão, mas tudo será normalizado assim que a compensação for confirmada. ✅

Aguarde mais um pouquinho! Posso ajudar com mais alguma coisa? 😊
\`\`\`

**✅ Se \`unlockInTrust: true\` (DESBLOQUEIO EM CONFIANÇA ATIVO):**

\`\`\`
Vi que sua conexão já foi liberada em confiança! 🔓

Para manter o acesso, é importante regularizar o pagamento o quanto antes.

Posso te enviar o boleto atualizado? 😊
\`\`\`

**❌ Se \`pendingWithProof: false\` E \`unlockInTrust: false\`:**
→ Continue o fluxo normal:
1. Verificar status de conexão com \`verificar_conexao\`
2. Se cliente está inadimplente, rotear para Financeiro: \`rotear_para_assistente(assistantType="financeiro", motivo="Cliente inadimplente precisa regularizar pagamento")\`
3. Se cliente está adimplente, diagnosticar problema técnico normalmente

---

### ⚠️ REGRAS ABSOLUTAS DESTE FLUXO

**NUNCA:**
- ❌ Diagnostique problema técnico SEM verificar status de pagamento primeiro
- ❌ Diga "problema de inadimplência" se \`pendingWithProof: true\`
- ❌ Ofereça soluções técnicas se o bloqueio é por falta de pagamento
- ❌ Ignore comprovantes enviados nas últimas 72h

**SEMPRE:**
- ✅ Chame \`verificar_status_pagamento()\` ANTES de \`verificar_conexao()\`
- ✅ Explique claramente o prazo de compensação bancária
- ✅ Tranquilize o cliente que já enviou comprovante
- ✅ Rotear para Financeiro se inadimplente SEM comprovante pendente

---

`;
    
    // 3. Encontrar onde inserir (antes do FLUXO DE ATENDIMENTO)
    const insertMarker = "## 📋 FLUXO DE ATENDIMENTO";
    const insertIndex = currentPrompt.indexOf(insertMarker);
    
    if (insertIndex === -1) {
      console.error("❌ Marcador '## 📋 FLUXO DE ATENDIMENTO' não encontrado");
      console.log("📋 Seções disponíveis:");
      const sections = currentPrompt.match(/^##.*/gm);
      sections?.forEach(s => console.log(`  - ${s}`));
      process.exit(1);
    }
    
    // 4. Construir novo prompt
    const newPrompt = 
      currentPrompt.slice(0, insertIndex) +
      "\n\n" + newSection + "\n\n" +
      currentPrompt.slice(insertIndex);
    
    fs.writeFileSync('/tmp/suporte_prompt_v2.1.0.txt', newPrompt);
    console.log("💾 Preview salvo em /tmp/suporte_prompt_v2.1.0.txt");
    
    console.log("\n📊 ESTATÍSTICAS:");
    console.log(`  - Prompt antigo: ${currentPrompt.length} caracteres`);
    console.log(`  - Nova seção: ${newSection.length} caracteres`);
    console.log(`  - Prompt novo: ${newPrompt.length} caracteres`);
    
    if (process.argv.includes('apply')) {
      console.log("\n🚀 Aplicando atualização no OpenAI...");
      await updateAssistantPrompt('suporte', newPrompt);
      console.log("✅ Prompt do Suporte atualizado para v2.1.0!");
    } else {
      console.log("\n⚠️  Execute 'npx tsx update-suporte-prompt.ts apply' para aplicar");
    }
    
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

main();
