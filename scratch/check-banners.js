const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const banners = await prisma.banner.findMany();
  console.log("BANNERS IN DB:", banners);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
