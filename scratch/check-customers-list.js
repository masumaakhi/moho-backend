const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.customer.count();
  console.log("Total customers count:", count);
  const customers = await prisma.customer.findMany({ take: 5 });
  console.log("First 5 customers:", customers);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
