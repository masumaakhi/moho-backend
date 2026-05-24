import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.customerVideoReview.findMany();
  console.log(JSON.stringify(reviews, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
