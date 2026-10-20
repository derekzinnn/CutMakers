-- Fases 10 e 11: contratos por pedido (OrderAgreement + User.termsAcceptedAt +
-- NotificationType.CONTRACT_ACCEPTED) e trilha de auditoria (AuditLog).
--
-- Gerada por `prisma migrate diff` entre o schema da Fase 8 (fdc9655, de onde
-- veio o baseline 0_init) e o da Fase 11 (93fc8ad, o commit anterior a Fase 12).
--
-- POR QUE ESTA MIGRATION E SEPARADA DA SEGUINTE:
-- O banco de staging ja tinha estas mudancas (aplicadas via `db push`) mas NAO
-- as da Fase 12. Uma migration unica cobrindo 10->12 falharia aqui, em
-- `CREATE TABLE "OrderAgreement"` (ja existe). A fronteira entre as duas
-- migrations e exatamente o estado real daquele banco, o que permite marcar
-- esta como aplicada e deixar so a proxima rodar.
--
-- Em banco que JA tem estas estruturas (staging atual), nao rode: marque como
-- aplicada, sem executar o SQL:
--   pnpm --filter @cutmakers/api exec prisma migrate resolve --applied 0_init
--   pnpm --filter @cutmakers/api exec prisma migrate resolve --applied 20261019120000_fases_10_11
-- Em banco novo (ou no schema de teste), ela roda normalmente via migrate deploy.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_ACCEPTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAgreement" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "creatorAcceptedAt" TIMESTAMP(3),
    "editorAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAgreement_orderId_key" ON "OrderAgreement"("orderId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAgreement" ADD CONSTRAINT "OrderAgreement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

