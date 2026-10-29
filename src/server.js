require("dotenv").config();

const express = require("express");
const pool = require("./config/database");
const chatbotRoutes = require("./routes/chatbot");
const { handleChatbotMessage } = require("./routes/chatbot");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use("/api/chatbot", chatbotRoutes);

// Facebook Messenger Webhook Verification
app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Messenger webhook verified!");
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

// Facebook Messenger Webhook Handler
app.post("/webhook", async (req, res) => {
    res.status(200).send("EVENT_RECEIVED");

    try {
        for (const entry of req.body.entry || []) {
            for (const event of entry.messaging || []) {
                if (event.message?.is_echo) {
                    continue;
                }

                const message = (
                    event.message?.text ||
                    event.message?.quick_reply?.payload ||
                    event.postback?.payload ||
                    ""
                ).trim();

                if (!message) {
                    continue;
                }

                const senderId = event.sender.id;

                // Find or create this Facebook customer's database user.
                let result = await pool.query(
                    `SELECT user_id FROM messenger_users
                     WHERE facebook_psid = $1`,
                    [senderId]
                );

                let userId;

                if (result.rows.length > 0) {
                    userId = result.rows[0].user_id;
                } else {
                    const client = await pool.connect();

                    try {
                        await client.query("BEGIN");

                        result = await client.query(
                            `INSERT INTO users (name, phone)
                             VALUES ($1, $2)
                             RETURNING id`,
                            ["Messenger Customer", `FB_${senderId}`]
                        );

                        userId = result.rows[0].id;

                        await client.query(
                            `INSERT INTO messenger_users
                             (facebook_psid, user_id)
                             VALUES ($1, $2)`,
                            [senderId, userId]
                        );

                        await client.query("COMMIT");
                    } catch (error) {
                        await client.query("ROLLBACK");
                        throw error;
                    } finally {
                        client.release();
                    }
                }

                // Process message directly through the chatbot handler
                const chatbotResponse = await handleChatbotMessage({
                    message: message,
                    user_id: userId
                });

                const reply =
                    chatbotResponse?.reply ||
                    chatbotResponse?.message ||
                    "Sorry, I couldn't process that message.";

                const graphVersion = process.env.META_GRAPH_VERSION || "v21.0";

                await axios.post(
                    `https://graph.facebook.com/${graphVersion}/me/messages`,
                    {
                        recipient: { id: senderId },
                        message: {
                            text: String(reply).slice(0, 2000)
                        }
                    },
                    {
                        params: {
                            access_token: process.env.META_ACCESS_TOKEN
                        }
                    }
                );
            }
        }
    } catch (error) {
        console.error(
            "Messenger webhook error:",
            error.response?.data || error.message
        );
    }
});

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.json({
        message: "Krishivan WhatsApp Backend is running!"
    });
});

app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PostgreSQL connected successfully!",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});

app.get("/api/products", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM products WHERE active = TRUE"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get products"
        });
    }
});

app.get("/api/categories", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM categories"
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get categories"
        });
    }
});

app.get("/api/categories/:categoryId/products", async (req, res) => {
    try {
        const { categoryId } = req.params;

        const result = await pool.query(
            "SELECT * FROM products WHERE category_id = $1 AND active = TRUE",
            [categoryId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get category products"
        });
    }
});

app.post("/api/cart", async (req, res) => {
    try {
        const { user_id, product_id, quantity } = req.body;

        const result = await pool.query(
            `INSERT INTO cart (user_id, product_id, quantity)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [user_id, product_id, quantity || 1]
        );

        res.json({
            message: "Product added to cart",
            cart: result.rows[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to add product to cart"
        });
    }
});

app.get("/api/cart/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            `SELECT 
                cart.id,
                products.name,
                products.price,
                cart.quantity,
                (products.price * cart.quantity) AS total
             FROM cart
             JOIN products ON cart.product_id = products.id
             WHERE cart.user_id = $1`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get cart"
        });
    }
});

app.get("/test-cart", (req, res) => {
    res.json({
        message: "Cart route is working"
    });
});

app.post("/api/orders", async (req, res) => {
    const client = await pool.connect();

    try {
        const { user_id } = req.body;

        await client.query("BEGIN");

        // Get cart items
        const cartResult = await client.query(
            `SELECT 
                cart.product_id,
                cart.quantity,
                products.price
             FROM cart
             JOIN products ON cart.product_id = products.id
             WHERE cart.user_id = $1`,
            [user_id]
        );

        if (cartResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Cart is empty"
            });
        }

        // Calculate total
        const totalAmount = cartResult.rows.reduce(
            (total, item) =>
                total + Number(item.price) * item.quantity,
            0
        );

        // Create order
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, total_amount)
             VALUES ($1, $2)
             RETURNING *`,
            [user_id, totalAmount]
        );

        const order = orderResult.rows[0];

        // Add cart items to order_items
        for (const item of cartResult.rows) {
            await client.query(
                `INSERT INTO order_items
                 (order_id, product_id, quantity, price)
                 VALUES ($1, $2, $3, $4)`,
                [
                    order.id,
                    item.product_id,
                    item.quantity,
                    item.price
                ]
            );
        }

        // Clear cart
        await client.query(
            "DELETE FROM cart WHERE user_id = $1",
            [user_id]
        );

        await client.query("COMMIT");

        res.json({
            message: "Order placed successfully",
            order: order
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            message: "Failed to place order"
        });

    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
