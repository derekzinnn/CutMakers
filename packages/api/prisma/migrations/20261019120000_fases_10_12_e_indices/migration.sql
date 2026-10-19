-- Migration das Fases 10, 11 e 12 + indices de performance.
--
-- Por que ela existe: ate aqui o repo tinha apenas o baseline 0_init (Fase 8).
-- Tudo depois disso foi aplicado via `prisma db push`, que nao versiona nada.
-- Producao roda `migrate deploy`, entao sem esta migration nenhuma das mudancas
-- das Fases 10-12 nem os indices chegam ao banco de producao.
--
-- Como foi gerada (reproduzivel):
--   prisma migrate diff \
--     --from-schema-datamodel <schema.prisma em fdc9655, a Fase 8> \
--     --to-schema-datamodel  prisma/schema.prisma \
--     --script
--
-- A cadeia foi conferida: regenerar 0_init a partir do schema da Fase 8 produz
-- um arquivo byte-identico ao que esta versionado, entao baseline + este delta
-- correspondem exatamente ao schema atual.
--
-- Conteudo: 4 tabelas novas (ProjectRequest, RequestProposal, AuditLog,
-- OrderAgreement), 2 enums novos, 4 valores em NotificationType, 4 colunas
-- (todas nullable ou com default), 29 indices e 4 unique. Nenhum DROP, nenhum
-- TRUNCATE, nenhuma coluna NOT NULL sem default — nao ha perda de dados.
--
-- ATENCAO ANTES DE APLICAR EM BANCO COM DADOS:
-- A linha `CREATE UNIQUE INDEX "Delivery_orderId_version_key"` FALHA se ja
-- existirem entregas com (orderId, version) repetido — justamente o bug que
-- esta constraint passa a impedir. Rode antes:
--     pnpm --filter @cutmakers/api deliveries:check
-- e, se houver duplicatas, `deliveries:fix` para renumerar por ordem
-- cronologica. O reparo ficou fora desta migration de proposito: e um UPDATE
-- de dados, e migration de producao nao e lugar para isso.
--
-- Nota do proprio Prisma sobre o ALTER TYPE multiplo abaixo: em PostgreSQL 11
-- ou anterior seria necessario quebrar em varias migrations. O Supabase roda
-- PG 15+, e os valores novos nao sao usados nesta mesma transacao, entao passa.

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_PROPOSAL_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_PROPOSAL_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_PROPOSAL_REJECTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "revisionsIncluded" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "relatedRequestId" TEXT;

-- CreateTable
CREATE TABLE "ProjectRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetMin" DECIMAL(10,2),
    "budgetMax" DECIMAL(10,2),
    "deadline" TIMESTAMP(3),
    "revisionsIncluded" INTEGER NOT NULL DEFAULT 2,
    "referenceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestProposal" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RequestProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestProposal_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "ProjectRequest_status_categoryId_idx" ON "ProjectRequest"("status", "categoryId");

-- CreateIndex
CREATE INDEX "ProjectRequest_creatorId_idx" ON "ProjectRequest"("creatorId");

-- CreateIndex
CREATE INDEX "RequestProposal_editorId_idx" ON "RequestProposal"("editorId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestProposal_requestId_editorId_key" ON "RequestProposal"("requestId", "editorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAgreement_orderId_key" ON "OrderAgreement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_requestId_key" ON "Order"("requestId");

-- CreateIndex
CREATE INDEX "Order_creatorId_createdAt_idx" ON "Order"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_editorId_createdAt_idx" ON "Order"("editorId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_updatedAt_idx" ON "Order"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "OrderFile_orderId_idx" ON "OrderFile"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_version_key" ON "Delivery"("orderId", "version");

-- CreateIndex
CREATE INDEX "Revision_orderId_createdAt_idx" ON "Revision"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Revision_orderId_status_idx" ON "Revision"("orderId", "status");

-- CreateIndex
CREATE INDEX "Transaction_payerId_createdAt_idx" ON "Transaction"("payerId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_payeeId_createdAt_idx" ON "Transaction"("payeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_externalPaymentId_idx" ON "Transaction"("externalPaymentId");

-- CreateIndex
CREATE INDEX "Subscription_editorProfileId_status_idx" ON "Subscription"("editorProfileId", "status");

-- CreateIndex
CREATE INDEX "Subscription_status_expiresAt_idx" ON "Subscription"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_externalSubscriptionId_idx" ON "Subscription"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "Conversation_creatorId_createdAt_idx" ON "Conversation"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_editorId_createdAt_idx" ON "Conversation"("editorId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_revieweeId_createdAt_idx" ON "Review"("revieweeId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "OrderProposal_orderId_createdAt_idx" ON "OrderProposal"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderProposal_orderId_status_idx" ON "OrderProposal"("orderId", "status");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProjectRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedRequestId_fkey" FOREIGN KEY ("relatedRequestId") REFERENCES "ProjectRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRequest" ADD CONSTRAINT "ProjectRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestProposal" ADD CONSTRAINT "RequestProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProjectRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestProposal" ADD CONSTRAINT "RequestProposal_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAgreement" ADD CONSTRAINT "OrderAgreement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

