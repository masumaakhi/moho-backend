const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking for orphaned customer addresses...");
  const orphaned = await prisma.$queryRaw`
    SELECT ca.id, ca.customer_id, ca.address
    FROM customer_addresses ca
    LEFT JOIN customers c ON ca.customer_id = c.id
    WHERE c.id IS NULL
  `;
  console.log("Found", orphaned.length, "orphaned addresses:");
  console.log(JSON.stringify(orphaned, null, 2));

  // Also count total customer addresses
  const count = await prisma.customerAddress.count();
  console.log("Total customer addresses:", count);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
