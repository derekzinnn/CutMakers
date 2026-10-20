-- Plano Premium: ranking por faixa de avaliacao.
--
-- `ratingBand` e a faixa de meia estrela derivada de avgRating. Existe como
-- coluna porque a busca publica ordena por ela: o Premium passa a DESEMPATAR
-- dentro da faixa em vez de atropelar a qualidade (antes `isPremium` era o
-- primeiro criterio do orderBy, entao um premium mediano ficava a frente de um
-- gratuito excelente).
--
-- O DEFAULT 0 so vale para linhas novas. Editores que JA tem avaliacao
-- precisam da faixa calculada, senao caem todos na banda 0 e perdem a posicao
-- que conquistaram — por isso o UPDATE de backfill abaixo.
--
-- O backfill e uma derivacao deterministica de uma coluna que ja existe
-- (mesma formula de lib/plans.ratingBandOf), nao um reparo de dados
-- inconsistentes, e foi exercitado no schema de teste antes de ir para o
-- public. Por isso fica aqui, diferente do reparo de versao de entrega.

-- AlterTable
ALTER TABLE "EditorProfile" ADD COLUMN     "ratingBand" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: floor(avgRating * 2) / 2  == ratingBandOf() do codigo
UPDATE "EditorProfile" SET "ratingBand" = FLOOR("avgRating" * 2) / 2 WHERE "avgRating" > 0;

-- CreateIndex (depois do backfill: o indice ja nasce sobre os dados corretos)
CREATE INDEX "EditorProfile_ratingBand_isPremium_avgRating_idx" ON "EditorProfile"("ratingBand", "isPremium", "avgRating");
