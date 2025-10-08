/**
 * Script para criar um usuário administrador inicial
 * Uso: npx tsx server/create-admin-user.ts
 */

import { storage } from "./storage";
import { hashPassword } from "./lib/auth";

async function createAdminUser() {
  console.log("🔐 Criando usuário administrador inicial...\n");

  const username = "admin";
  const password = "admin123"; // TROCAR EM PRODUÇÃO!
  const fullName = "Administrador";

  try {
    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      console.log("⚠️  Usuário 'admin' já existe!");
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Nome: ${existingUser.fullName}`);
      console.log(`   Role: ${existingUser.role}`);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await storage.createUser({
      username,
      password: hashedPassword,
      fullName,
      role: "ADMIN",
      status: "active",
    });

    console.log("✅ Usuário administrador criado com sucesso!");
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Nome: ${user.fullName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Senha: ${password}`);
    console.log("\n⚠️  IMPORTANTE: Troque a senha após o primeiro login!");
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    process.exit(1);
  }
}

createAdminUser();
