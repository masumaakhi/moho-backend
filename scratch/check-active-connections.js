const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== REMOTE DB CONNECTION AND STATS ===");

  // 1. Get max_connections setting
  const maxConns = await prisma.$queryRaw`SHOW max_connections`;
  console.log("Max Connections setting:", maxConns);

  // 2. Get active connections count
  const activeConns = await prisma.$queryRaw`
    SELECT count(*), state
    FROM pg_stat_activity
    GROUP BY state
  `;
  console.log("Active Connections by state:", activeConns);

  // 3. Get list of active connections
  const connList = await prisma.$queryRaw`
    SELECT pid, usename, client_addr, application_name, state, query
    FROM pg_stat_activity
    LIMIT 20
  `;
  console.log("Sample Active Connections:");
  console.log(JSON.stringify(connList, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
