/**
 * Normaliza emails existentes para minúsculas.
 *
 * Por que isso é necessário: o unique de `User.email` é case-sensitive no
 * Postgres. Antes da normalização no cadastro, era possível gravar
 * "Derek@Gmail.com". Agora que login e registro passam o email por
 * `.toLowerCase()`, essas contas antigas não são mais encontradas — a pessoa
 * digita o email certo e recebe "Credenciais inválidas".
 *
 * Rode UMA VEZ, depois do deploy da normalização:
 *   pnpm --filter @cutmakers/api emails:check      (só relatório, não escreve)
 *   pnpm --filter @cutmakers/api emails:normalize  (aplica)
 *
 * Colisões (duas contas que viram o mesmo email em minúsculas) NÃO são
 * resolvidas automaticamente: envolve decidir qual conta mantém os pedidos,
 * então o script apenas reporta e deixa a decisão para você.
 */
import { prisma } from '../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const needsFix = users.filter((u) => u.email !== u.email.trim().toLowerCase())

  if (needsFix.length === 0) {
    console.log('Nada a fazer: todos os', users.length, 'emails já estão normalizados.')
    return
  }

  // Agrupa pelo email normalizado para detectar colisões antes de escrever
  const byNormalized = new Map<string, typeof users>()
  for (const u of users) {
    const key = u.email.trim().toLowerCase()
    byNormalized.set(key, [...(byNormalized.get(key) ?? []), u])
  }

  const collisions = [...byNormalized.entries()].filter(([, group]) => group.length > 1)

  console.log(`${needsFix.length} de ${users.length} emails precisam de normalização.`)

  if (collisions.length > 0) {
    console.log(`\n⚠️  ${collisions.length} colisão(ões) — precisam de decisão manual:`)
    for (const [normalized, group] of collisions) {
      console.log(`\n  ${normalized}`)
      for (const u of group) {
        const orders = await prisma.order.count({
          where: { OR: [{ creatorId: u.id }, { editorId: u.id }] },
        })
        console.log(
          `    ${u.email}  ·  ${u.name}  ·  criada em ${u.createdAt.toISOString().slice(0, 10)}  ·  ${orders} pedido(s)`,
        )
      }
    }
    console.log('\nResolva as colisões (merge ou remoção) antes de aplicar. Nada foi escrito.')
    return
  }

  if (!APPLY) {
    console.log('\nSem colisões. Emails que seriam alterados:')
    for (const u of needsFix) {
      console.log(`  ${u.email}  ->  ${u.email.trim().toLowerCase()}`)
    }
    console.log('\nRode com --apply para gravar.')
    return
  }

  for (const u of needsFix) {
    await prisma.user.update({
      where: { id: u.id },
      data: { email: u.email.trim().toLowerCase() },
    })
    console.log(`  ${u.email}  ->  ${u.email.trim().toLowerCase()}`)
  }
  console.log(`\n${needsFix.length} email(s) normalizado(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
