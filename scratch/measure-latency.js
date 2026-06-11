const { PrismaClient } = require('@prisma/client');

async function main() {
  const dbUrl = "postgresql://postgres:8JMuQwl82ndXQzl43yHfRfZjqmG0XFP9OtbqaGZgxMcOOTZebsa7zEiqlzYMZ7ct@72.61.173.98:5432/postgres?connection_limit=5";
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  });

  try {
    await prisma.$connect();
    console.log("Connected to database.");

    // Sequential timing
    console.time("Sequential 5 Queries");
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$queryRaw`SELECT 2`;
    await prisma.$queryRaw`SELECT 3`;
    await prisma.$queryRaw`SELECT 4`;
    await prisma.$queryRaw`SELECT 5`;
    console.timeEnd("Sequential 5 Queries");

    // Parallel timing
    console.time("Parallel 5 Queries");
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 2`,
      prisma.$queryRaw`SELECT 3`,
      prisma.$queryRaw`SELECT 4`,
      prisma.$queryRaw`SELECT 5`
    ]);
    console.timeEnd("Parallel 5 Queries");

    // Let's also check real tables
    console.time("Sequential Real Queries");
    const p1 = await prisma.product.findMany({ take: 8, where: { is_trending: true } });
    const p2 = await prisma.product.findMany({ take: 8, where: { is_featured: true } });
    const r = await prisma.productReview.findMany({ take: 5 });
    const v = await prisma.customerVideoReview.findMany();
    console.timeEnd("Sequential Real Queries");

    console.time("Parallel Real Queries");
    await Promise.all([
      prisma.product.findMany({ take: 8, where: { is_trending: true } }),
      prisma.product.findMany({ take: 8, where: { is_featured: true } }),
      prisma.productReview.findMany({ take: 5 }),
      prisma.customerVideoReview.findMany()
    ]);
    console.timeEnd("Parallel Real Queries");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
