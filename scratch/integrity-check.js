const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== COMPREHENSIVE DB INTEGRITY CHECK ===");

  // Helper to query and report orphans
  async function checkOrphans(label, parentTable, childTable, childFK, parentPK = 'id') {
    try {
      const query = `
        SELECT c.id as child_id, c."${childFK}" as fk_val
        FROM "${childTable}" c
        LEFT JOIN "${parentTable}" p ON c."${childFK}" = p."${parentPK}"
        WHERE c."${childFK}" IS NOT NULL AND p."${parentPK}" IS NULL
      `;
      const orphans = await prisma.$queryRawUnsafe(query);
      if (orphans.length > 0) {
        console.warn(`[WARNING] Found ${orphans.length} orphaned rows in '${childTable}' referencing '${parentTable}' (${childFK}):`);
        console.log(orphans);
      } else {
        console.log(`[OK] '${childTable}' -> '${parentTable}' (${childFK}) is clean.`);
      }
    } catch (err) {
      console.error(`Error checking ${label}:`, err.message);
    }
  }

  // 1. Customer -> User (Required)
  await checkOrphans("Customer to User", "users", "customers", "user_id");

  // 2. CustomerAddress -> Customer (Required)
  await checkOrphans("CustomerAddress to Customer", "customers", "customer_addresses", "customer_id");

  // 3. CustomerNote -> Customer (Required)
  await checkOrphans("CustomerNote to Customer", "customers", "customer_notes", "customer_id");

  // 4. PasswordReset -> User (Required)
  await checkOrphans("PasswordReset to User", "users", "password_resets", "user_id");

  // 5. Product -> Category (Required)
  await checkOrphans("Product to Category", "categories", "products", "category_id");

  // 6. ProductImage -> Product (Required)
  await checkOrphans("ProductImage to Product", "products", "product_images", "product_id");

  // 7. ProductVariant -> Product (Required)
  await checkOrphans("ProductVariant to Product", "products", "product_variants", "product_id");

  // 8. ProductFAQ -> Product (Required)
  await checkOrphans("ProductFAQ to Product", "products", "product_faqs", "product_id");

  // 9. ProductReview -> Product (Required)
  await checkOrphans("ProductReview to Product", "products", "product_reviews", "product_id");

  // 10. CartItem -> Cart (Required)
  await checkOrphans("CartItem to Cart", "carts", "cart_items", "cart_id");
  // 11. CartItem -> Product (Required)
  await checkOrphans("CartItem to Product", "products", "cart_items", "product_id");

  // 12. OrderItem -> Order (Required)
  await checkOrphans("OrderItem to Order", "orders", "order_items", "order_id");
  // 13. OrderItem -> Product (Required)
  await checkOrphans("OrderItem to Product", "products", "order_items", "product_id");

  // 14. Payment -> Order (Required)
  await checkOrphans("Payment to Order", "orders", "payments", "order_id");

  // 15. OrderStatusHistory -> Order (Required)
  await checkOrphans("OrderStatusHistory to Order", "orders", "order_status_history", "order_id");

  // 16. SuspiciousOrder -> Order (Required)
  await checkOrphans("SuspiciousOrder to Order", "orders", "suspicious_orders", "order_id");

  // 17. DuplicateOrderMatch -> Order (new_order_id)
  await checkOrphans("DuplicateOrderMatch to Order (new)", "orders", "duplicate_order_matches", "new_order_id");
  // 18. DuplicateOrderMatch -> Order (old_order_id)
  await checkOrphans("DuplicateOrderMatch to Order (old)", "orders", "duplicate_order_matches", "old_order_id");

  // 19. DeliveryBooking -> Order (Required)
  await checkOrphans("DeliveryBooking to Order", "orders", "delivery_bookings", "order_id");

  // 20. DeliveryTrackingEvent -> DeliveryBooking (Required)
  await checkOrphans("DeliveryTrackingEvent to DeliveryBooking", "delivery_bookings", "delivery_tracking_events", "booking_id");

  // 21. DeliveryRetryLog -> DeliveryBooking (Required)
  await checkOrphans("DeliveryRetryLog to DeliveryBooking", "delivery_bookings", "delivery_retry_logs", "booking_id");

  // 22. Invoice -> Order (Required)
  await checkOrphans("Invoice to Order", "orders", "invoices", "order_id");

  // 23. RolePermission -> Role (Required)
  await checkOrphans("RolePermission to Role", "roles", "role_permissions", "role_id");
  // 24. RolePermission -> Permission (Required)
  await checkOrphans("RolePermission to Permission", "permissions", "role_permissions", "permission_id");

  console.log("=== CHECK COMPLETE ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
