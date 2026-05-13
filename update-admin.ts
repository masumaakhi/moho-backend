import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'masumaakterakhi90@gmail.com';
  const password = '12345';
  const hash = await bcrypt.hash(password, 10);

  await prisma.adminUser.update({
    where: { email },
    data: { password_hash: hash },
  });

  console.log(`Updated password for ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
