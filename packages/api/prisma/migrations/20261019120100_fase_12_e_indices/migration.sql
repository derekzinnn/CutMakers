-- Fase 12 (marketplace invertido) + os 26 indices de performance da Fase 13.1
-- e o unique que fecha a corrida de versao de entrega.
--
-- Gerada por `prisma migrate diff` entre o schema da Fase 11 (93fc8ad) e o atual.
--
-- Esta e a migration que REALMENTE roda no staging: o `db push` da Fase 12 nunca
-- foi executado lá, entao ProjectRequest, RequestProposal, os enums
-- RequestStatus/RequestProposalStatus, Order.requestId, Order.revisionsIncluded,
-- Notification.relatedRequestId e os 3 NotificationType REQUEST_PROPOSAL_* estao
-- todos ausentes. Sem ela, qualquer chamada a /api/requests quebra.
--
-- Seguranca: nenhum DROP, TRUNCATE ou DELETE. As colunas novas sao nullable ou
-- NOT NULL DEFAULT, entao nao falham em tabela populada. Os valores novos de
-- enum nao sao usados nesta mesma transacao (requisito do Postgres).
--
-- UNICO PONTO QUE PODE FALHAR:
-- `CREATE UNIQUE INDEX "Delivery_orderId_version_key"` falha se houver entrega
-- com (orderId, version) repetido. Confira antes:
--   pnpm --filter @cutmakers/api deliveries:check
-- (verificado em 19/10/2026 no staging: 8 entregas, nenhuma duplicata)

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


ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_PROPOSAL_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_PROPOSAL_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_PROPOSAL_REJECTED';

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

-- CreateIndex
CREATE INDEX "ProjectRequest_status_categoryId_idx" ON "ProjectRequest"("status", "categoryId");

-- CreateIndex
CREATE INDEX "ProjectRequest_creatorId_idx" ON "ProjectRequest"("creatorId");

-- CreateIndex
CREATE INDEX "RequestProposal_editorId_idx" ON "RequestProposal"("editorId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestProposal_requestId_editorId_key" ON "RequestProposal"("requestId", "editorId");

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

