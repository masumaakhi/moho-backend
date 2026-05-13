const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = [
    { key: 'business_name', value: 'Mohul Organic', group: 'general' },
    { key: 'business_phone', value: '+880 1755-XXXXXX', group: 'general' },
    { key: 'business_address', value: 'House 12, Road 5, Mirpur 10, Dhaka 1216', group: 'general' },
    { key: 'delivery_charge_default', value: '80', group: 'delivery' },
    { key: 'delivery_charge_inside', value: '60', group: 'delivery' },
    { key: 'delivery_charge_outside', value: '120', group: 'delivery' },
    { key: 'inventory_alert_threshold', value: '10', group: 'notification' },
    { key: 'auto_send_daily_digest', value: 'true', group: 'notification' },
    { key: 'admin_report_email', value: 'admin@mohul.com', group: 'notification' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log('Default settings seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
