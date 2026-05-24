const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('Testing Prisma connection...');
  const start = Date.now();
  try {
    await prisma.$connect();
    console.log(`Connected successfully in ${Date.now() - start}ms!`);
    const usersCount = await prisma.user.count();
    console.log(`Total users in database: ${usersCount}`);
  } catch (error) {
    console.error('Prisma connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
