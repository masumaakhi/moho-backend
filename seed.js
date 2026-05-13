const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding dummy data...");

  // 1. Create a Category
  const category = await prisma.category.create({
    data: {
      name: "Hair Care",
      slug: "hair-care",
      description: "Premium hair care products",
      status: "active"
    }
  });

  // 2. Create Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        category_id: category.id,
        name: "Organic Coconut Oil",
        slug: "organic-coconut-oil",
        base_price: 1200,
        new_price: 950,
        stock_quantity: 50,
        status: "active",
        is_trending: true,
        is_featured: true,
        short_description: "Pure and cold-pressed coconut oil.",
        images: {
          create: [{ image_url: "https://res.cloudinary.com/drlo4ktpa/image/upload/q_auto/f_auto/v1775157198/mohul1_la8i4g.jpg" }]
        }
      }
    }),
    prisma.product.create({
      data: {
        category_id: category.id,
        name: "Herbal Nourish Oil",
        slug: "herbal-nourish-oil",
        base_price: 1500,
        new_price: 1350,
        stock_quantity: 20,
        status: "active",
        is_trending: true,
        is_featured: false,
        short_description: "Nourishes scalp and promotes growth.",
        images: {
          create: [{ image_url: "https://res.cloudinary.com/drlo4ktpa/image/upload/q_auto/f_auto/v1775157513/mohul4_zh5tgp.jpg" }]
        }
      }
    })
  ]);

  // 3. Create a Homepage Section
  await prisma.homepageSection.create({
    data: {
      section_key: "hero",
      title: "Welcome to Mohul",
      is_active: true
    }
  });

  console.log("Seeding complete! You can now test the frontend.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
