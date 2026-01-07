import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detectar se é Neon (serverless) ou PostgreSQL normal
const isNeon = process.env.DATABASE_URL.includes('neon.tech') || 
               process.env.DATABASE_URL.includes('ep-');

let pool: any;
let db: any;
let initPromise: Promise<void> | null = null;

async function initializeDb() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (isNeon) {
      // Usar driver Neon (WebSocket)
      const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
      const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
      const ws = (await import("ws")).default;
      
      neonConfig.webSocketConstructor = ws;
      
      pool = new NeonPool({ 
        connectionString: process.env.DATABASE_URL!,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      db = neonDrizzle({ client: pool, schema });
  } else {
    // Usar driver PostgreSQL normal (TCP)
    // Importar pg de forma compatível com ESM
    const pgModule = await import('pg');
    const { drizzle: pgDrizzle } = await import('drizzle-orm/node-postgres');
    
    // pg em ESM exporta Pool como named export
    // Verificar diferentes formas de exportação
    let PgPool = pgModule.Pool;
    
    // Se não encontrou, tentar default export
    if (!PgPool && pgModule.default) {
      PgPool = pgModule.default.Pool || pgModule.default;
    }
    
    if (!PgPool || typeof PgPool !== 'function') {
      console.error('❌ [DB] Erro ao importar Pool do pg:', {
        hasPool: !!pgModule.Pool,
        hasDefault: !!pgModule.default,
        keys: Object.keys(pgModule),
        poolType: typeof PgPool
      });
      throw new Error(`Pool não encontrado no módulo pg. Verifique se o pacote 'pg' está instalado.`);
    }
    
    console.log('✅ [DB] Pool importado com sucesso do módulo pg');
    
    pool = new PgPool({ 
      connectionString: process.env.DATABASE_URL!,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    db = pgDrizzle({ client: pool, schema });
    console.log('✅ [DB] Conexão PostgreSQL inicializada');
  }
  })();

  return initPromise;
}

// Inicializar imediatamente
initializeDb().catch((err) => {
  console.error('❌ [DB] Erro ao inicializar banco de dados:', err);
});

export { pool, db, initializeDb };
