const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const details = await prisma.$queryRaw`
    SELECT 
        conname, 
        convalidated, 
        condeferrable, 
        condeferred,
        confupdtype,
        confdeltype
    FROM pg_constraint 
    WHERE conname = 'customer_addresses_customer_id_fkey';
  `;
  console.log("Constraint details:", details);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
