import { db } from '../server/db';
import { users, contacts, messageTemplates } from '../shared/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Iniciando seed de dados de desenvolvimento...\n');

  try {
    // 1. Criar usuários de teste
    console.log('👤 Criando usuários...');
    const hashedPassword = await bcrypt.hash('abc123', 10);
    
    await db.insert(users).values([
      {
        username: 'admin_dev',
        password: hashedPassword,
        role: 'ADMIN',
        fullName: 'Admin Desenvolvimento',
      },
      {
        username: 'supervisor_dev',
        password: hashedPassword,
        role: 'SUPERVISOR',
        fullName: 'Supervisor Desenvolvimento',
      },
      {
        username: 'agent_dev',
        password: hashedPassword,
        role: 'AGENT',
        fullName: 'Agente Desenvolvimento',
      },
    ]).onConflictDoNothing();
    console.log('  ✅ 3 usuários criados (senha: abc123)');

    // 2. Criar contatos de teste
    console.log('\n📞 Criando contatos...');
    await db.insert(contacts).values([
      {
        name: 'Cliente Teste 1',
        phoneNumber: '5524999999001',
        document: '111.111.111-11',
      },
      {
        name: 'Cliente Teste 2',
        phoneNumber: '5524999999002',
      },
      {
        name: 'Empresa Teste LTDA',
        phoneNumber: '5524999999003',
        document: '11.111.111/0001-11',
      },
    ]).onConflictDoNothing();
    console.log('  ✅ 3 contatos criados');

    // 3. Criar templates de mensagens (se ainda não existirem)
    console.log('\n💬 Criando templates de mensagens...');
    await db.insert(messageTemplates).values([
      {
        key: 'agent_welcome',
        name: 'Boas-vindas Agente',
        template: 'Olá! Sou da equipe de {departmentName} da TR Telecom. Vi que você precisa de ajuda e já estou cuidando do seu atendimento.',
        category: 'system',
      },
      {
        key: 'nps_survey',
        name: 'Pesquisa NPS',
        template: 'Em uma escala de 0 a 10, quanto você recomendaria a TR Telecom para um amigo?',
        category: 'system',
      },
    ]).onConflictDoNothing();
    console.log('  ✅ Templates de mensagens criados');

    console.log('\n========================================');
    console.log('✅ Seed concluído com sucesso!');
    console.log('========================================');
    console.log('\n📝 Credenciais de acesso:');
    console.log('  Admin:      admin_dev / abc123');
    console.log('  Supervisor: supervisor_dev / abc123');
    console.log('  Agente:     agent_dev / abc123');
    console.log('\n🚀 Próximo passo: npm run dev:local');
    console.log('========================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro no seed:', err);
    process.exit(1);
  }
}

seed();
