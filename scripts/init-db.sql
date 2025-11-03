-- Script de inicialização do PostgreSQL
-- Executado automaticamente na primeira vez que o container é criado

-- Criar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Verificar sucesso
SELECT 'PostgreSQL inicializado com sucesso!' as status;
SELECT version() as postgresql_version;

-- Mensagens úteis
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'LIA CORTEX - Banco de Desenvolvimento';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database: lia_cortex_dev';
    RAISE NOTICE 'User: postgres';
    RAISE NOTICE 'Port: 5432';
    RAISE NOTICE '';
    RAISE NOTICE 'Próximos passos:';
    RAISE NOTICE '1. Execute: npm run db:push';
    RAISE NOTICE '2. Execute: npx tsx scripts/seed-dev.ts';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
