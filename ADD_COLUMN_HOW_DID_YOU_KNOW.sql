-- SQL para adicionar coluna "how_did_you_know" na tabela sales
-- Execute no banco de desenvolvimento

ALTER TABLE "sales" ADD COLUMN "how_did_you_know" TEXT;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN "sales"."how_did_you_know" IS 'Como o cliente conheceu a TR Telecom (indicação, Google, Facebook, etc)';
