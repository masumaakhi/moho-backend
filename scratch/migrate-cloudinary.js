const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// The old Cloudinary cloud name that we want to search for and replace
const OLD_CLOUD_NAME = 'dnz7xa2ka';

// Configure Cloudinary with new credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('----------------------------------------------------');
console.log('Cloudinary Image Migration Script');
console.log('----------------------------------------------------');
console.log('Old Cloud Name (Source):', OLD_CLOUD_NAME);
console.log('New Cloud Name (Target):', process.env.CLOUD_NAME);
console.log('New API Key:', process.env.CLOUDINARY_API_KEY);
console.log('----------------------------------------------------');

if (!process.env.CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Error: Please configure the new Cloudinary credentials in backend/.env first!');
  process.exit(1);
}

if (process.env.CLOUD_NAME === OLD_CLOUD_NAME) {
  console.error('Error: The CLOUD_NAME in .env is still set to the old cloud name! Please change it to your new cloud name first.');
  process.exit(1);
}

// Helper function to upload remote URL to new Cloudinary
async function uploadToNewCloudinary(url, resourceType = 'auto') {
  try {
    console.log(`  Uploading: ${url}`);
    const uploadResult = await cloudinary.uploader.upload(url, {
      resource_type: resourceType,
      folder: 'mohul_migration'
    });
    console.log(`  Uploaded successfully! New URL: ${uploadResult.secure_url}`);
    return uploadResult.secure_url;
  } catch (error) {
    console.error(`  [ERROR] Upload failed:`, error.message);
    return null;
  }
}

async function migrate() {
  try {
    // 1. Migrate Categories
    console.log('\n--- 1. Migrating Categories ---');
    const categories = await prisma.category.findMany({
      where: {
        image_url: {
          contains: OLD_CLOUD_NAME
        }
      }
    });
    console.log(`Found ${categories.length} categories to migrate.`);
    for (const cat of categories) {
      console.log(`Migrating Category ID: ${cat.id} (${cat.name})`);
      const newUrl = await uploadToNewCloudinary(cat.image_url);
      if (newUrl) {
        await prisma.category.update({
          where: { id: cat.id },
          data: { image_url: newUrl }
        });
      }
    }

    // 2. Migrate Product Images
    console.log('\n--- 2. Migrating Product Images ---');
    const productImages = await prisma.productImage.findMany({
      where: {
        image_url: {
          contains: OLD_CLOUD_NAME
        }
      }
    });
    console.log(`Found ${productImages.length} product images to migrate.`);
    for (const img of productImages) {
      console.log(`Migrating Product Image ID: ${img.id}`);
      const newUrl = await uploadToNewCloudinary(img.image_url);
      if (newUrl) {
        await prisma.productImage.update({
          where: { id: img.id },
          data: { image_url: newUrl }
        });
      }
    }

    // 3. Migrate Homepage Sections
    console.log('\n--- 3. Migrating Homepage Sections ---');
    const homepageSections = await prisma.homepageSection.findMany({
      where: {
        image_url: {
          contains: OLD_CLOUD_NAME
        }
      }
    });
    console.log(`Found ${homepageSections.length} homepage sections to migrate.`);
    for (const section of homepageSections) {
      console.log(`Migrating Homepage Section Key: ${section.section_key}`);
      const newUrl = await uploadToNewCloudinary(section.image_url);
      if (newUrl) {
        await prisma.homepageSection.update({
          where: { id: section.id },
          data: { image_url: newUrl }
        });
      }
    }

    // 4. Migrate Banners
    console.log('\n--- 4. Migrating Banners ---');
    const banners = await prisma.banner.findMany({
      where: {
        image_url: {
          contains: OLD_CLOUD_NAME
        }
      }
    });
    console.log(`Found ${banners.length} banners to migrate.`);
    for (const banner of banners) {
      console.log(`Migrating Banner ID: ${banner.id} (${banner.title})`);
      const newUrl = await uploadToNewCloudinary(banner.image_url);
      if (newUrl) {
        await prisma.banner.update({
          where: { id: banner.id },
          data: { image_url: newUrl }
        });
      }
    }

    // 5. Migrate Testimonials
    console.log('\n--- 5. Migrating Testimonials ---');
    const testimonials = await prisma.testimonial.findMany({
      where: {
        OR: [
          { avatar_url: { contains: OLD_CLOUD_NAME } },
          { review_image_url: { contains: OLD_CLOUD_NAME } }
        ]
      }
    });
    console.log(`Found ${testimonials.length} testimonials to migrate.`);
    for (const t of testimonials) {
      console.log(`Migrating Testimonial ID: ${t.id} (${t.name})`);
      const updates = {};
      if (t.avatar_url && t.avatar_url.includes(OLD_CLOUD_NAME)) {
        const newAvatar = await uploadToNewCloudinary(t.avatar_url);
        if (newAvatar) updates.avatar_url = newAvatar;
      }
      if (t.review_image_url && t.review_image_url.includes(OLD_CLOUD_NAME)) {
        const newReviewImg = await uploadToNewCloudinary(t.review_image_url);
        if (newReviewImg) updates.review_image_url = newReviewImg;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.testimonial.update({
          where: { id: t.id },
          data: updates
        });
      }
    }

    // 6. Migrate Customer Video Reviews
    console.log('\n--- 6. Migrating Customer Video Reviews ---');
    const videoReviews = await prisma.customerVideoReview.findMany({
      where: {
        video_url: {
          contains: OLD_CLOUD_NAME
        }
      }
    });
    console.log(`Found ${videoReviews.length} video reviews to migrate.`);
    for (const vid of videoReviews) {
      console.log(`Migrating Video Review ID: ${vid.id}`);
      const newUrl = await uploadToNewCloudinary(vid.video_url, 'video');
      if (newUrl) {
        await prisma.customerVideoReview.update({
          where: { id: vid.id },
          data: { video_url: newUrl }
        });
      }
    }

    // 7. Migrate User Avatars
    console.log('\n--- 7. Migrating User Avatars ---');
    const users = await prisma.user.findMany({
      where: {
        avatar_url: {
          contains: OLD_CLOUD_NAME
        }
      }
    });
    console.log(`Found ${users.length} users to migrate.`);
    for (const u of users) {
      console.log(`Migrating User Avatar ID: ${u.id} (${u.name || 'No Name'})`);
      const newUrl = await uploadToNewCloudinary(u.avatar_url);
      if (newUrl) {
        await prisma.user.update({
          where: { id: u.id },
          data: { avatar_url: newUrl }
        });
      }
    }

    console.log('\n====================================================');
    console.log('Migration Completed Successfully!');
    console.log('====================================================');

  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
