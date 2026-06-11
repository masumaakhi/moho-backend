const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking for orphaned notes...");
  const orphanedNotes = await prisma.$queryRaw`
    SELECT id, customer_id FROM customer_notes cn
    WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = cn.customer_id)
  `;
  console.log("Orphaned CustomerNotes:", orphanedNotes);

  console.log("Checking for orphaned addresses...");
  const orphanedAddresses = await prisma.$queryRaw`
    SELECT id, customer_id, address FROM customer_addresses ca
    WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = ca.customer_id)
  `;
  console.log("Orphaned CustomerAddresses:", orphanedAddresses);

  console.log("Checking for orphaned orders...");
  const orphanedOrders = await prisma.$queryRaw`
    SELECT id, customer_id FROM orders o
    WHERE customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)
  `;
  console.log("Orphaned Orders:", orphanedOrders);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
