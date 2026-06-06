const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  try {
    const email = 'masumaakterakhi90@gmail.com';
    const password = '12345';
    
    // Find or create Super Admin role
    let superAdminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' }
    });
    
    if (!superAdminRole) {
      console.log('Super Admin role not found. Creating it...');
      superAdminRole = await prisma.role.create({
        data: {
          name: 'Super Admin',
          description: 'Full system access',
          is_system: true,
          status: 'active'
        }
      });
    }

    const hash = await bcrypt.hash(password, 10);
    
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('Admin user exists. Updating password and status...');
      const updated = await prisma.adminUser.update({
        where: { email },
        data: {
          password_hash: hash,
          status: 'active',
          role_id: superAdminRole.id
        }
      });
      console.log('Admin updated:', updated);
    } else {
      console.log('Admin user does not exist. Creating...');
      const created = await prisma.adminUser.create({
        data: {
          name: 'Super Admin',
          email,
          password_hash: hash,
          status: 'active',
          role_id: superAdminRole.id
        }
      });
      console.log('Admin created:', created);
    }

  } catch (error) {
    console.error('Error running script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
