const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Create Permissions
  const permissions = [
    { name: 'Manage Products', code: 'products.manage' },
    { name: 'View Products', code: 'products.view' },
    { name: 'Manage Orders', code: 'orders.manage' },
    { name: 'View Orders', code: 'orders.view' },
    { name: 'Manage Customers', code: 'customers.manage' },
    { name: 'View Reports', code: 'reports.view' },
    { name: 'Manage Admins', code: 'admins.manage' },
    { name: 'System Settings', code: 'settings.manage' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: p,
    });
  }

  const allPerms = await prisma.permission.findMany();

  // 2. Create Roles
  const roles = [
    { name: 'Super Admin', description: 'Full system access', is_system: true },
    { name: 'Store Manager', description: 'Manage products and orders', is_system: false },
    { name: 'Editor', description: 'Manage content and products', is_system: false },
  ];

  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });

    if (r.name === 'Super Admin') {
      // Assign all permissions
      for (const p of allPerms) {
        await prisma.rolePermission.upsert({
          where: { role_id_permission_id: { role_id: role.id, permission_id: p.id } },
          update: {},
          create: { role_id: role.id, permission_id: p.id },
        });
      }
    }
  }

  console.log('Roles and Permissions seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
