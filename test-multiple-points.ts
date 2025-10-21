/**
 * Teste de Detecção de Múltiplos Pontos
 * 
 * Este script testa a lógica de agrupamento de boletos por ponto
 * usando dados reais do caso da Adriana Peres (exemplo fornecido)
 */

interface ConsultaBoletoResult {
  ID_TRANSACAO?: string;
  NOME?: string;
  CIDADE?: string;
  BAIRRO?: string;
  RUA?: string;
  DATA_VENCIMENTO: string;
  VALOR_TOTAL: string;
  PIX_TXT: string;
  CODIGO_BARRA_TRANSACAO: string;
  link_carne_completo: string;
  STATUS: string;
}

interface PontoInfo {
  numero: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  boletos: ConsultaBoletoResult[];
  totalBoletos: number;
  totalVencidos: number;
  valorTotal: number;
}

// Dados de teste - caso real da Adriana Peres
const boletosTestData: ConsultaBoletoResult[] = [
  {
    "ID_TRANSACAO": "769214128",
    "NOME": "ADRIANA PERES DA SILVA AZEVEDO (C.I)",
    "CIDADE": "TRES RIOS",
    "BAIRRO": "VILA ISABEL",
    "RUA": "FELICIANO CERQUEIRA DE CARVALHO",
    "DATA_VENCIMENTO": "2024-10-15",
    "VALOR_TOTAL": "51.29",
    "PIX_TXT": "00020101...",
    "CODIGO_BARRA_TRANSACAO": "36490.00092...",
    "link_carne_completo": "https://download.gerencianet.com.br/...",
    "STATUS": "VENCIDO"
  },
  {
    "ID_TRANSACAO": "810903073",
    "NOME": "ADRIANA PERES DA SILVA AZEVEDO (C.I)",
    "CIDADE": "TRES RIOS",
    "BAIRRO": "VILA ISABEL",
    "RUA": "FELICIANO CERQUEIRA DE CARVALHO",
    "DATA_VENCIMENTO": "2025-01-03",
    "VALOR_TOTAL": "300.00",
    "PIX_TXT": "00020101...",
    "CODIGO_BARRA_TRANSACAO": "36490.00076...",
    "link_carne_completo": "https://download.gerencianet.com.br/...",
    "STATUS": "VENCIDO"
  },
  {
    "ID_TRANSACAO": "855258840",
    "NOME": "2 ADRIANA PERES DA SILVA AZEVEDO",
    "CIDADE": "TRES RIOS",
    "BAIRRO": "TRIÂNGULO",
    "RUA": "JOÃO ALEXANDRE",
    "DATA_VENCIMENTO": "2025-10-15",
    "VALOR_TOTAL": "109.90",
    "PIX_TXT": "00020101...",
    "CODIGO_BARRA_TRANSACAO": "36490.00068...",
    "link_carne_completo": "https://download.gerencianet.com.br/...",
    "STATUS": "VENCIDO"
  },
  {
    "ID_TRANSACAO": "855258841",
    "NOME": "2 ADRIANA PERES DA SILVA AZEVEDO",
    "CIDADE": "TRES RIOS",
    "BAIRRO": "TRIÂNGULO",
    "RUA": "JOÃO ALEXANDRE",
    "DATA_VENCIMENTO": "2025-11-15",
    "VALOR_TOTAL": "109.90",
    "PIX_TXT": "00020101...",
    "CODIGO_BARRA_TRANSACAO": "36490.00043...",
    "link_carne_completo": "https://download.gerencianet.com.br/...",
    "STATUS": "EM DIA"
  },
  {
    "ID_TRANSACAO": "855258842",
    "NOME": "2 ADRIANA PERES DA SILVA AZEVEDO",
    "CIDADE": "TRES RIOS",
    "BAIRRO": "TRIÂNGULO",
    "RUA": "JOÃO ALEXANDRE",
    "DATA_VENCIMENTO": "2025-12-15",
    "VALOR_TOTAL": "109.90",
    "PIX_TXT": "00020101...",
    "CODIGO_BARRA_TRANSACAO": "36490.00027...",
    "link_carne_completo": "https://download.gerencianet.com.br/...",
    "STATUS": "EM DIA"
  },
  {
    "ID_TRANSACAO": "855258843",
    "NOME": "2 ADRIANA PERES DA SILVA AZEVEDO",
    "CIDADE": "TRES RIOS",
    "BAIRRO": "TRIÂNGULO",
    "RUA": "JOÃO ALEXANDRE",
    "DATA_VENCIMENTO": "2026-01-15",
    "VALOR_TOTAL": "109.90",
    "PIX_TXT": "00020101...",
    "CODIGO_BARRA_TRANSACAO": "36490.00019...",
    "link_carne_completo": "https://download.gerencianet.com.br/...",
    "STATUS": "EM DIA"
  }
];

// ====================================
// LÓGICA DE DETECÇÃO (copiada de ai-tools.ts)
// ====================================

function detectarMultiplosPontos(boletosEmAberto: ConsultaBoletoResult[]) {
  const pontosMap = new Map<string, PontoInfo>();
  
  boletosEmAberto.forEach(boleto => {
    // Tentar extrair número do ponto do início do nome
    const nomeMatch = boleto.NOME?.match(/^(\d+)\s+(.+)$/);
    
    let pontoNumero: string;
    let nomeCliente: string;
    
    if (nomeMatch) {
      // Nome começa com número: "2 ADRIANA..."
      pontoNumero = nomeMatch[1];
      nomeCliente = nomeMatch[2];
    } else {
      // Nome sem número no início -> Ponto 1 (padrão)
      pontoNumero = "1";
      nomeCliente = boleto.NOME || "Cliente";
    }
    
    // Criar ou recuperar informações do ponto
    if (!pontosMap.has(pontoNumero)) {
      pontosMap.set(pontoNumero, {
        numero: pontoNumero,
        nome: nomeCliente,
        endereco: boleto.RUA || '',
        bairro: boleto.BAIRRO || '',
        cidade: boleto.CIDADE || '',
        boletos: [],
        totalBoletos: 0,
        totalVencidos: 0,
        valorTotal: 0
      });
    }
    
    const ponto = pontosMap.get(pontoNumero)!;
    
    // Adicionar boleto ao ponto
    ponto.boletos.push(boleto);
    ponto.totalBoletos++;
    
    // Verificar se está vencido
    if (boleto.STATUS?.toUpperCase().includes('VENCIDO')) {
      ponto.totalVencidos++;
    }
    
    // Somar valor (converter de string para número)
    const valor = parseFloat(boleto.VALOR_TOTAL.replace(',', '.')) || 0;
    ponto.valorTotal += valor;
  });
  
  const pontos = Array.from(pontosMap.values()).sort((a, b) => 
    parseInt(a.numero) - parseInt(b.numero)
  );
  
  return {
    hasMultiplePoints: pontos.length > 1,
    totalBoletos: boletosEmAberto.length,
    pontos
  };
}

// ====================================
// EXECUTAR TESTE
// ====================================

console.log('🧪 TESTE: Detecção de Múltiplos Pontos\n');
console.log('📊 Dados de Entrada:', {
  totalBoletos: boletosTestData.length,
  nomes: [...new Set(boletosTestData.map(b => b.NOME))]
});

console.log('\n' + '='.repeat(60) + '\n');

const resultado = detectarMultiplosPontos(boletosTestData);

console.log('✅ RESULTADO DA DETECÇÃO:\n');
console.log(`📍 Múltiplos Pontos: ${resultado.hasMultiplePoints ? 'SIM' : 'NÃO'}`);
console.log(`📊 Total de Boletos: ${resultado.totalBoletos}`);
console.log(`🏠 Pontos Detectados: ${resultado.pontos.length}\n`);

console.log('='.repeat(60) + '\n');

// Exibir detalhes de cada ponto
resultado.pontos.forEach((ponto, index) => {
  console.log(`🏠 PONTO ${ponto.numero}:`);
  console.log(`   Nome: ${ponto.nome}`);
  console.log(`   Endereço: ${ponto.endereco}, ${ponto.bairro}`);
  console.log(`   Cidade: ${ponto.cidade}`);
  console.log(`   Total de Boletos: ${ponto.totalBoletos}`);
  console.log(`   Boletos Vencidos: ${ponto.totalVencidos}`);
  console.log(`   Valor Total: R$ ${ponto.valorTotal.toFixed(2)}`);
  console.log(`   Boletos:`);
  
  ponto.boletos.forEach((boleto, idx) => {
    const statusIcon = boleto.STATUS.includes('VENCIDO') ? '🔴' : '🟢';
    console.log(`     ${idx + 1}. ${statusIcon} ${boleto.DATA_VENCIMENTO} - R$ ${boleto.VALOR_TOTAL} (${boleto.STATUS})`);
  });
  
  if (index < resultado.pontos.length - 1) {
    console.log('');
  }
});

console.log('\n' + '='.repeat(60) + '\n');

// Simular apresentação ao cliente
console.log('💬 COMO O ASSISTENTE APRESENTARIA:\n');

if (resultado.hasMultiplePoints) {
  console.log('📍 Identifiquei que você possui 2 pontos de internet:\n');
  
  resultado.pontos.forEach(ponto => {
    const emDia = ponto.totalBoletos - ponto.totalVencidos;
    console.log(`🏠 PONTO ${ponto.numero} - ${ponto.endereco}, ${ponto.bairro}`);
    console.log(`   • ${ponto.totalBoletos} boletos (${ponto.totalVencidos} vencido${ponto.totalVencidos !== 1 ? 's' : ''}, ${emDia} em dia)`);
    console.log(`   • Valor total: R$ ${ponto.valorTotal.toFixed(2)}\n`);
  });
  
  console.log('Para qual ponto você deseja ver os boletos detalhados?');
} else {
  console.log(`📄 Encontrei ${resultado.totalBoletos} boleto(s):\n`);
  
  resultado.pontos[0].boletos.forEach((boleto, idx) => {
    const statusIcon = boleto.STATUS.includes('VENCIDO') ? '🔴' : '🟢';
    console.log(`${idx + 1}. ${statusIcon} ${boleto.STATUS} - R$ ${boleto.VALOR_TOTAL} (Venc: ${boleto.DATA_VENCIMENTO})`);
  });
}

console.log('\n✅ TESTE CONCLUÍDO!');
