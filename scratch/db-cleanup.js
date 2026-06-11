const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING DATABASE CLEANUP ===");

  // 1. Delete orphaned CustomerAddress
  const deletedAddress = await prisma.$executeRaw`
    DELETE FROM customer_addresses
    WHERE customer_id NOT IN (SELECT id FROM customers)
  `;
  console.log(`Deleted ${deletedAddress} orphaned address records from customer_addresses.`);

  // 2. Set orphaned customer_id to NULL in orders
  const updatedOrders = await prisma.$executeRaw`
    UPDATE orders
    SET customer_id = NULL
    WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM customers)
  `;
  console.log(`Updated ${updatedOrders} orphaned customer references in orders to NULL.`);

  console.log("=== CLEANUP COMPLETE ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
