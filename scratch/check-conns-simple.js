const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const maxConns = await prisma.$queryRaw`SHOW max_connections`;
  console.log("Max Connections setting:", maxConns);

  const activeConns = await prisma.$queryRaw`
    SELECT count(*), state
    FROM pg_stat_activity
    GROUP BY state
  `;
  console.log("Active Connections by state:", activeConns);

  const totalConns = await prisma.$queryRaw`
    SELECT count(*) FROM pg_stat_activity
  `;
  console.log("Total active connections:", totalConns);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
