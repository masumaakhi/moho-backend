const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== ORDERS DIAGNOSTICS ===");
  const totalOrders = await prisma.order.count();
  console.log(`Total Orders: ${totalOrders}`);

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      order_number: true,
      user_id: true,
      customer_id: true,
      customer_name: true,
      customer_phone: true,
      customer_email: true,
      total_amount: true,
      order_status: true,
      created_at: true
    },
    orderBy: { created_at: 'desc' }
  });

  orders.forEach((o, index) => {
    console.log(`${index + 1}. Order Number: ${o.order_number}`);
    console.log(`   Customer Name: ${o.customer_name}`);
    console.log(`   Phone: ${o.customer_phone}`);
    console.log(`   Email: ${o.customer_email}`);
    console.log(`   Total: ${o.total_amount}`);
    console.log(`   Status: ${o.order_status}`);
    console.log(`   User ID: ${o.user_id}`);
    console.log(`   Customer ID: ${o.customer_id}`);
    console.log("----------------------------------------");
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
