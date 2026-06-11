const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.findUnique({
    where: { id: '6bf3ceec-58eb-4a6f-9b8e-559ee811c704' }
  });
  console.log("Customer:", customer);

  const customerRaw = await prisma.$queryRaw`
    SELECT * FROM customers WHERE id = '6bf3ceec-58eb-4a6f-9b8e-559ee811c704'
  `;
  console.log("Customer Raw:", customerRaw);

  const customerDeleted = await prisma.$queryRaw`
    SELECT * FROM customers WHERE id = '6bf3ceec-58eb-4a6f-9b8e-559ee811c704' AND deleted_at IS NOT NULL
  `;
  console.log("Customer Raw (Deleted):", customerDeleted);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
