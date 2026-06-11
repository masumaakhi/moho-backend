const { PrismaClient } = require('@prisma/client');

async function main() {
  const dbUrl = "postgresql://postgres:8JMuQwl82ndXQzl43yHfRfZjqmG0XFP9OtbqaGZgxMcOOTZebsa7zEiqlzYMZ7ct@72.61.173.98:5432/postgres";
  
  // Try with parameters
  const urlObj = new URL(dbUrl);
  urlObj.searchParams.set('connection_limit', '30');
  urlObj.searchParams.set('pool_timeout', '20');
  urlObj.searchParams.set('connect_timeout', '20');
  const modifiedUrl = urlObj.toString();

  console.log("Connecting with modified URL:", modifiedUrl);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: modifiedUrl
      }
    }
  });

  try {
    await prisma.$connect();
    console.log("Connected successfully!");
    const res = await prisma.$queryRaw`SELECT 1`;
    console.log("Query result:", res);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
