const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING CUSTOMER STATS & ORDER LINKING SYNC ===");

  const customers = await prisma.customer.findMany({
    include: {
      user: true
    }
  });

  for (const customer of customers) {
    console.log(`\nProcessing Customer: ${customer.name || 'Unnamed'} (ID: ${customer.id})`);
    
    // Find all matching orders
    const conditions = [
      { user_id: customer.user_id },
      { customer_id: customer.id }
    ];

    if (customer.phone) {
      conditions.push({ customer_phone: customer.phone });
    }
    if (customer.email) {
      conditions.push({ customer_email: customer.email.toLowerCase() });
    }
    if (customer.user?.phone) {
      conditions.push({ customer_phone: customer.user.phone });
    }
    if (customer.user?.email) {
      conditions.push({ customer_email: customer.user.email.toLowerCase() });
    }

    // Find orders that match any of the conditions
    const matchingOrders = await prisma.order.findMany({
      where: {
        OR: conditions
      }
    });

    console.log(`Found ${matchingOrders.length} matching orders for this customer.`);

    if (matchingOrders.length > 0) {
      const orderIds = matchingOrders.map(o => o.id);
      
      // Link these orders to this customer
      const linkResult = await prisma.order.updateMany({
        where: {
          id: { in: orderIds }
        },
        data: {
          customer_id: customer.id,
          user_id: customer.user_id
        }
      });
      console.log(`Linked ${linkResult.count} orders to Customer ID: ${customer.id}`);

      // Calculate total orders and total spend
      const totalOrders = matchingOrders.length;
      const totalSpend = matchingOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      // Update customer stats
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          total_orders: totalOrders,
          total_spend: totalSpend
        }
      });
      console.log(`Updated Customer Stats: total_orders = ${totalOrders}, total_spend = ${totalSpend}`);
    } else {
      // Reset to 0 if no orders
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          total_orders: 0,
          total_spend: 0
        }
      });
      console.log("Reset Customer Stats to 0.");
    }
  }

  console.log("\n=== SYNC COMPLETE ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
