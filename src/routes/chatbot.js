const express = require("express");
const router = express.Router();
const pool = require("../config/database");

/**
 * Fetch the latest active conversation for a user.
 */
async function getLatestConversation(userId) {
  if (!userId) return null;

  const result = await pool.query(
    `SELECT * FROM conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Save or update the conversation state for a user.
 */
async function saveConversation(userId, data) {
  if (!userId) return;

  const current = await getLatestConversation(userId);

  if (current) {
    await pool.query(
      `UPDATE conversations
       SET current_category_id = $1,
           current_product_id = $2,
           current_crop_name = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [
        data.categoryId ?? null,
        data.productId ?? null,
        data.cropName ?? null,
        current.id,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO conversations
       (user_id, current_category_id, current_product_id, current_crop_name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        userId,
        data.categoryId ?? null,
        data.productId ?? null,
        data.cropName ?? null,
      ]
    );
  }
}

/**
 * Build the Main Menu string.
 */
async function buildMainMenu() {
  const result = await pool.query(
    `SELECT id, name FROM categories
     WHERE parent_id IS NULL
     ORDER BY id`
  );

  if (result.rows.length === 0) {
    return "No categories are available right now.";
  }

  return (
    "🌱 Welcome to Krishivan! 🌱\n" +
    "Your trusted agricultural partner.\n\n" +
    "Please choose a service:\n" +
    result.rows.map((item, index) => `${index + 1}. ${item.name}`).join("\n") +
    "\n\n👉 Type a number or category name." +
    "\n🛒 Type 'cart' to view your cart." +
    "\n❓ Type 'help' for options."
  );
}


async function buildCategoryView(category) {
  // First, check whether this category has subcategories
  const subcategoriesResult = await pool.query(
    `SELECT id, name
     FROM categories
     WHERE parent_id = $1
     ORDER BY id`,
    [category.id]
  );

  const subcategories = subcategoriesResult.rows;

  // If subcategories exist, show them first
  if (subcategories.length > 0) {
    return (
      `🌾 ${category.name}\n\n` +
      "Please choose a category:\n" +
      subcategories
        .map((sub, index) => `${index + 1}. ${sub.name}`)
        .join("\n") +
      '\n\nType a number or category name.\n' +
      'Type "back" to return or "menu" for the main menu.'
    );
  }

  // Only show products when the category has no subcategories
  const productsResult = await pool.query(
    `SELECT id, name, price, stock
     FROM products
     WHERE category_id = $1 AND active = TRUE
     ORDER BY id`,
    [category.id]
  );

  const products = productsResult.rows;

  if (products.length === 0) {
    return `No products are currently available in ${category.name}.`;
  }

  return (
    `🌾 Available ${category.name} products:\n\n` +
    products
      .map(
        (product, index) =>
          `${index + 1}. ${product.name}\n` +
          `Price: ₹${Number(product.price).toFixed(2)}\n` +
          `Stock: ${product.stock}`
      )
      .join("\n\n") +
    '\n\nType a product number or name.'
  );
}
/**
 * Build the display for a specific selected product.
 */
function buildProductDetailView(product) {
  return (
    `📦 ${product.name}\n\n` +
    `💰 Price: ₹${Number(product.price).toFixed(2)}\n` +
    `📦 Stock: ${product.stock} available\n` +
    (product.description ? `📝 Description: ${product.description}\n\n` : "\n") +
    `👉 How to order:\n` +
    `• Type "add" or "add to cart" to add 1 to your cart\n` +
    `• Or type "add <qty>" (e.g., "add 2")\n` +
    `• Type "cart" to view your cart\n` +
    `• Type "back" to view other products\n` +
    `• Type "menu" to return to the main menu`
  );
}

/**
 * Core Chatbot Message Processing Function.
 * Can be called directly from server.js (webhook) or via REST API.
 */
async function handleChatbotMessage({ message, user_id }) {
  if (!message || !String(message).trim()) {
    return { reply: "Please enter a message. Type 'Hi' to see the main menu." };
  }

  if (!user_id) {
    return { reply: "User information is missing. Please try again." };
  }

  const userId = Number(user_id);
  const text = String(message).trim();
  const lower = text.toLowerCase();

  // 1. GLOBAL COMMAND: Greetings & Main Menu
  const startWords = ["hi", "hii", "hiii", "hello", "hey", "start", "menu", "home", "restart", "main menu"];
  if (startWords.includes(lower)) {
    await saveConversation(userId, {
      categoryId: null,
      productId: null,
      cropName: null,
    });
    return { reply: await buildMainMenu() };
  }

  // 2. GLOBAL COMMAND: Help
  if (lower === "help" || lower === "support" || lower === "info") {
    return {
      reply:
        "🌾 Krishivan Chatbot Help\n\n" +
        "You can use these commands anytime:\n" +
        "• 'menu' or 'Hi' - Return to the main menu\n" +
        "• 'back' - Go back to the previous step\n" +
        "• 'cart' - View items in your shopping cart\n" +
        "• 'clear cart' - Empty your shopping cart\n" +
        "• 'checkout' - Review order and total\n" +
        "• 'confirm' - Place your order\n\n" +
        "👉 To browse, simply type the number or name of any option."
    };
  }

  // 3. GLOBAL COMMAND: View Cart
  if (lower === "cart" || lower === "view cart" || lower === "my cart" || lower === "show cart") {
    const cartResult = await pool.query(
      `SELECT c.quantity, p.id AS product_id, p.name, p.price, p.stock
       FROM cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1
       ORDER BY c.id`,
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return {
        reply: "🛒 Your shopping cart is currently empty!\n\nType 'menu' to browse our catalog."
      };
    }

    let total = 0;
    const items = cartResult.rows.map((item, index) => {
      const subtotal = Number(item.price) * Number(item.quantity);
      total += subtotal;
      return (
        `${index + 1}. ${item.name}\n` +
        `   Quantity: ${item.quantity} | Price: ₹${Number(item.price).toFixed(2)}\n` +
        `   Subtotal: ₹${subtotal.toFixed(2)}`
      );
    });

    return {
      reply:
        "🛒 Your Shopping Cart:\n\n" +
        items.join("\n\n") +
        "\n\n-----------------------------\n" +
        `💵 Grand Total: ₹${total.toFixed(2)}\n\n` +
        "👉 Next steps:\n" +
        "• Type 'checkout' to place your order\n" +
        "• Type 'clear cart' to empty your cart\n" +
        "• Type 'menu' to continue shopping"
    };
  }

  // 4. GLOBAL COMMAND: Clear Cart
  if (lower === "clear cart" || lower === "empty cart" || lower === "delete cart" || lower === "reset cart") {
    await pool.query("DELETE FROM cart WHERE user_id = $1", [userId]);
    return {
      reply: "🗑️ Your cart has been cleared!\n\nType 'menu' to browse categories."
    };
  }

  // 5. GLOBAL COMMAND: Checkout
  if (lower === "checkout" || lower === "check out" || lower === "buy now") {
    const cartResult = await pool.query(
      `SELECT c.quantity, p.name, p.price, p.stock
       FROM cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1`,
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return {
        reply: "Your cart is empty. Add a product first!\n\nType 'menu' to browse."
      };
    }

    let total = 0;
    for (const item of cartResult.rows) {
      if (Number(item.quantity) > Number(item.stock)) {
        return {
          reply: `⚠️ Insufficient stock for ${item.name} (Only ${item.stock} left). Please update your cart.`
        };
      }
      total += Number(item.price) * Number(item.quantity);
    }

    return {
      reply:
        "📋 Order Summary:\n\n" +
        cartResult.rows
          .map(
            (item, index) =>
              `${index + 1}. ${item.name} x ${item.quantity} = ₹${(
                Number(item.price) * Number(item.quantity)
              ).toFixed(2)}`
          )
          .join("\n") +
        "\n\n-----------------------------\n" +
        `💵 Total Amount: ₹${total.toFixed(2)}\n\n` +
        "👉 Type 'confirm' to place your order now.\n" +
        "Type 'menu' to return to shopping."
    };
  }

  // 6. GLOBAL COMMAND: Confirm Order
  if (lower === "confirm" || lower === "confirm order" || lower === "place order") {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const cartResult = await client.query(
        `SELECT c.product_id, c.quantity, p.name, p.price, p.stock
         FROM cart c
         JOIN products p ON p.id = c.product_id
         WHERE c.user_id = $1
         FOR UPDATE OF p`,
        [userId]
      );

      if (cartResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return { reply: "Your cart is empty. Please add products before placing an order." };
      }

      let total = 0;
      for (const item of cartResult.rows) {
        if (
          Number(item.quantity) < 1 ||
          Number(item.quantity) > Number(item.stock)
        ) {
          await client.query("ROLLBACK");
          return {
            reply: `⚠️ Insufficient stock for ${item.name}. Available: ${item.stock}. Please update your cart.`
          };
        }
        total += Number(item.price) * Number(item.quantity);
      }

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_amount, status)
         VALUES ($1, $2, 'Pending')
         RETURNING id`,
        [userId, total]
      );

      const orderId = orderResult.rows[0].id;

      for (const item of cartResult.rows) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.product_id, item.quantity, item.price]
        );

        await client.query(
          `UPDATE products
           SET stock = stock - $1
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      await client.query("DELETE FROM cart WHERE user_id = $1", [userId]);
      await client.query("COMMIT");

      await saveConversation(userId, {
        categoryId: null,
        productId: null,
        cropName: null,
      });

      return {
        reply:
          "🎉 Order Placed Successfully!\n\n" +
          `📦 Order ID: #${orderId}\n` +
          `💵 Total: ₹${total.toFixed(2)}\n` +
          "🚚 Status: Pending\n\n" +
          "Thank you for ordering with Krishivan! 🌱\n" +
          "Type 'Hi' or 'menu' to start a new order."
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
      throw error;
    } finally {
      client.release();
    }
  }

  // Load user conversation state
  let conversation = await getLatestConversation(userId);
  if (!conversation) {
    await saveConversation(userId, { categoryId: null, productId: null, cropName: null });
    conversation = await getLatestConversation(userId);
  }

  // 7. GLOBAL COMMAND: Back Navigation
  if (lower === "back" || lower === "go back" || lower === "return" || lower === "prev") {
    // If viewing a product, go back to that product's category view
    if (conversation.current_product_id) {
      await saveConversation(userId, {
        categoryId: conversation.current_category_id,
        productId: null,
        cropName: conversation.current_crop_name,
      });

      if (conversation.current_category_id) {
        const catRes = await pool.query("SELECT * FROM categories WHERE id = $1", [
          conversation.current_category_id,
        ]);
        if (catRes.rows.length > 0) {
          return { reply: await buildCategoryView(catRes.rows[0]) };
        }
      }
      return { reply: await buildMainMenu() };
    }
// Handle Help category separately
if (conversation.current_category_id) {
  const helpCheck = await pool.query(
    "SELECT name FROM categories WHERE id = $1",
    [conversation.current_category_id]
  );

  if (
    helpCheck.rows.length > 0 &&
    helpCheck.rows[0].name.toLowerCase() === "help"
  ) {
    return {
      reply:
        "🌱 Krishivan Help\n\n" +
        "How can we help you?\n" +
        "• Type 'menu' to browse products.\n" +
        "• Type 'cart' to view your cart.\n" +
        "• Type 'checkout' to place an order.\n" +
        "• Type 'back' to return to the main menu.\n\n" +
        "For further assistance, please contact the Krishivan team."
    };
  }
}
    // If viewing a category, go up to its parent or main menu
    if (conversation.current_category_id) {
      const catRes = await pool.query("SELECT * FROM categories WHERE id = $1", [
        conversation.current_category_id,
      ]);
      const currentCat = catRes.rows[0];

      if (currentCat && currentCat.parent_id) {
        const parentRes = await pool.query("SELECT * FROM categories WHERE id = $1", [
          currentCat.parent_id,
        ]);
        if (parentRes.rows.length > 0) {
          await saveConversation(userId, {
            categoryId: parentRes.rows[0].id,
            productId: null,
            cropName: null,
          });
          return { reply: await buildCategoryView(parentRes.rows[0]) };
        }
      }

      // Root level category -> go back to main menu
      await saveConversation(userId, {
        categoryId: null,
        productId: null,
        cropName: null,
      });
      return { reply: await buildMainMenu() };
    }

    return { reply: await buildMainMenu() };
  }

  // 8. ADD TO CART ("add", "add to cart", "add 2", "buy", "buy 2")
  const addMatch = lower.match(/^(?:add\s*to\s*cart|add|buy)(?:\s+(\d+))?$/i);
  if (addMatch) {
    const qty = addMatch[1] ? parseInt(addMatch[1], 10) : 1;

    if (isNaN(qty) || qty < 1) {
      return { reply: "Please specify a valid quantity (e.g. 'add 2')." };
    }

    let productIdToAdd = conversation.current_product_id;

    // If no product is currently selected, check if user is in a category with products
    if (!productIdToAdd && conversation.current_category_id) {
      const prodsRes = await pool.query(
        `SELECT id FROM products WHERE category_id = $1 AND active = TRUE ORDER BY id`,
        [conversation.current_category_id]
      );
      if (prodsRes.rows.length === 1) {
        productIdToAdd = prodsRes.rows[0].id;
      }
    }

    if (!productIdToAdd) {
      return {
        reply:
          "Please select a product first by typing its number or name.\n\n" +
          "Type 'menu' to browse categories."
      };
    }

    const productResult = await pool.query(
      `SELECT id, name, price, stock
       FROM products
       WHERE id = $1 AND active = TRUE`,
      [productIdToAdd]
    );

    if (productResult.rows.length === 0) {
      return { reply: "This product is currently unavailable." };
    }

    const product = productResult.rows[0];

    if (Number(product.stock) < 1) {
      return { reply: `Sorry, ${product.name} is currently out of stock.` };
    }

    const cartResult = await pool.query(
      `SELECT id, quantity FROM cart
       WHERE user_id = $1 AND product_id = $2
       LIMIT 1`,
      [userId, product.id]
    );

    const existingQty = cartResult.rows.length > 0 ? Number(cartResult.rows[0].quantity) : 0;

    if (existingQty + qty > Number(product.stock)) {
      return {
        reply:
          `⚠️ Only ${product.stock} units of ${product.name} are available ` +
          `(you already have ${existingQty} in your cart).`
      };
    }

    if (cartResult.rows.length > 0) {
      await pool.query(
        `UPDATE cart
         SET quantity = quantity + $1
         WHERE id = $2`,
        [qty, cartResult.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO cart (user_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [userId, product.id, qty]
      );
    }

    // Save state with the selected product
    await saveConversation(userId, {
      categoryId: conversation.current_category_id,
      productId: product.id,
      cropName: null,
    });

    const cartSummary = await pool.query(
      `SELECT SUM(c.quantity) AS total_items, SUM(p.price * c.quantity) AS total_price
       FROM cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1`,
      [userId]
    );

    const totalItems = cartSummary.rows[0]?.total_items || qty;
    const totalPrice = Number(cartSummary.rows[0]?.total_price || 0).toFixed(2);

    return {
      reply:
        `✅ Added ${qty}x ${product.name} to your cart! 🛒\n\n` +
        `Cart Total: ₹${totalPrice} (${totalItems} items)\n\n` +
        "👉 What would you like to do?\n" +
        "• Type 'cart' to view cart & checkout\n" +
        "• Type 'back' to choose another product\n" +
        "• Type 'menu' to return to the main menu"
    };
  }

  // 9. STATE MACHINE: Context-Aware Navigation

  // --- STATE A: User is at Main Menu (current_category_id IS NULL) ---
  if (!conversation.current_category_id) {
    const rootCategoriesRes = await pool.query(
      `SELECT id, name FROM categories WHERE parent_id IS NULL ORDER BY id`
    );
    const rootCategories = rootCategoriesRes.rows;

    const matchedCat = rootCategories.find(
      (cat, index) =>
        lower === String(index + 1) ||
        lower === cat.name.toLowerCase() ||
        lower === cat.name.toLowerCase().split(" ")[0]
    );

    if (matchedCat) {
      await saveConversation(userId, {
        categoryId: matchedCat.id,
        productId: null,
        cropName: null,
      });

      return { reply: await buildCategoryView(matchedCat) };
    }

    return {
      reply:
        "Sorry, I didn't recognize that option. 🤔\n\n" +
        (await buildMainMenu())
    };
  }

  // --- STATE B & C: User is inside a Category ---
  const currentCategoryId = conversation.current_category_id;
  const currentCategoryRes = await pool.query(
    "SELECT * FROM categories WHERE id = $1",
    [currentCategoryId]
  );
  const currentCategory = currentCategoryRes.rows[0];

  if (!currentCategory) {
    // Current category not found, reset
    await saveConversation(userId, { categoryId: null, productId: null, cropName: null });
    return { reply: await buildMainMenu() };
  }

  const subcategoriesRes = await pool.query(
    `SELECT id, name FROM categories WHERE parent_id = $1 ORDER BY id`,
    [currentCategoryId]
  );
  const subcategories = subcategoriesRes.rows;

  const productsRes = await pool.query(
    `SELECT id, name, description, price, stock
     FROM products
     WHERE category_id = $1 AND active = TRUE
     ORDER BY id`,
    [currentCategoryId]
  );
  const products = productsRes.rows;

  // Check if input matches a Subcategory
  const matchedSubcategory = subcategories.find(
    (sub, index) =>
      lower === String(index + 1) ||
      lower === sub.name.toLowerCase() ||
      lower === sub.name.toLowerCase().split(" ")[0]
  );

 if (matchedSubcategory) {
  await saveConversation(userId, {
    categoryId: matchedSubcategory.id,
    productId: null,
    cropName: null,
  });

  return {
    reply: await buildCategoryView(matchedSubcategory),
  };
}
  // Check if input matches a Product
  const offset = subcategories.length;
  const matchedProduct = products.find((prod, index) => {
    const listNumber = String(offset + index + 1);
    const prodNumber = String(index + 1);
    const prodName = prod.name.toLowerCase();

    return (
      lower === listNumber ||
      (offset === 0 && lower === prodNumber) ||
      lower === prodName ||
      prodName.includes(lower)
    );
  });

  if (matchedProduct) {
    await saveConversation(userId, {
      categoryId: currentCategoryId,
      productId: matchedProduct.id,
      cropName: null,
    });

    return { reply: buildProductDetailView(matchedProduct) };
  }

  // Fallback for unhandled input inside a category
  return {
    reply:
      `Sorry, I didn't understand "${text}".\n\n` +
      `• Type a number or name from the list above\n` +
      `• Type 'back' to go back\n` +
      `• Type 'menu' for the main menu`
  };
}

// REST API Route
router.post("/message", async (req, res) => {
  try {
    const result = await handleChatbotMessage(req.body);
    return res.json(result);
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({
      reply: "Something went wrong. Please type 'Hi' to restart.",
    });
  }
});

module.exports = router;
module.exports.handleChatbotMessage = handleChatbotMessage;
