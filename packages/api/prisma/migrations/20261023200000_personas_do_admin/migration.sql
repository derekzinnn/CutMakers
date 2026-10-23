-- Personas do admin: criador/editor DISTINTOS pertencentes a uma conta ADMIN (coluna nullable: nenhum dado existente muda)
ALTER TABLE "User" ADD COLUMN "personaOfId" TEXT;
CREATE UNIQUE INDEX "User_personaOfId_role_key" ON "User"("personaOfId", "role");
ALTER TABLE "User" ADD CONSTRAINT "User_personaOfId_fkey" FOREIGN KEY ("personaOfId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
