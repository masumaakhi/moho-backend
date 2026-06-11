const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== CUSTOMER AND USER DATA DIAGNOSTICS ===");

  // 1. Total users and customers count
  const userCount = await prisma.user.count();
  const customerCount = await prisma.customer.count();
  console.log(`Total Users in 'users' table: ${userCount}`);
  console.log(`Total Customers in 'customers' table: ${customerCount}`);

  // 2. Fetch all users and check their relation with customers
  const allUsers = await prisma.user.findMany({
    include: {
      customer: true
    }
  });

  console.log("\n=== ALL USERS ===");
  allUsers.forEach((u, index) => {
    console.log(`${index + 1}. User ID: ${u.id}`);
    console.log(`   Name: ${u.name}`);
    console.log(`   Email: ${u.email}`);
    console.log(`   Phone: ${u.phone}`);
    console.log(`   Account Type: ${u.account_type}`);
    console.log(`   Status: ${u.status}`);
    console.log(`   Has Customer Record: ${u.customer ? 'YES' : 'NO'}`);
    if (u.customer) {
      console.log(`   Customer ID: ${u.customer.id}`);
      console.log(`   Customer Spend: ${u.customer.total_spend}`);
      console.log(`   Customer Orders: ${u.customer.total_orders}`);
    }
    console.log("----------------------------------------");
  });

  // 3. Check if there are any orphaned customer records without users (integrity check)
  const orphanedCustomers = await prisma.$queryRaw`
    SELECT id, name, email FROM customers WHERE user_id NOT IN (SELECT id FROM users)
  `;
  console.log(`Orphaned Customers (no user): ${orphanedCustomers.length}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
