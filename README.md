# Krishivan WhatsApp Chatbot Backend

## 1. Project Overview

The **Krishivan Chatbot Backend** is a Node.js-based backend application designed to support a chatbot for an agricultural products and services platform.

The chatbot allows users to browse agricultural products and services, view prices and stock availability, add products to a shopping cart, review their order summary, and place orders through a conversational interface.

The backend uses **Node.js, Express.js, and PostgreSQL** to process user messages, manage application logic, and store product and order information. Facebook Messenger integration enables users to interact with the chatbot through Messenger.

The project aims to make agricultural product discovery and ordering simpler by allowing users to interact using text messages rather than navigating a traditional website.

## 2. Project Objectives

The main objectives of this project are:

- Develop a backend for an agricultural chatbot.
- Integrate the backend with Facebook Messenger using webhooks.
- Display product categories and subcategories dynamically from the database.
- Allow users to browse products, prices, and available stock.
- Implement shopping cart functionality.
- Calculate item subtotals and the total order amount.
- Allow users to review and confirm orders.
- Store orders and order items in PostgreSQL.
- Update product stock after successful order placement.
- Provide navigation commands and help instructions.
- Handle invalid user inputs and common shopping scenarios.

## 3. Technologies Used

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime used to execute the backend |
| Express.js | Creates the server and handles HTTP requests and routes |
| PostgreSQL | Stores categories, products, conversations, cart items, users, and orders |
| `pg` | Connects the Node.js application to PostgreSQL |
| Facebook Messenger Platform | Provides the user-facing chat interface |
| Meta Graph API | Supports communication with the Messenger platform |
| Axios | HTTP client used for API requests where required |
| dotenv | Loads configuration values from environment variables |
| CORS | Configures Cross-Origin Resource Sharing where required |
| Nodemon | Restarts the server automatically during development |
| ngrok | Exposes the local server through a public URL during webhook testing |

## 4. System Architecture

The application follows a backend architecture in which messages from the user are processed by the chatbot logic and the required information is retrieved from or stored in PostgreSQL.

### Request flow

1. The user sends a message through Facebook Messenger.
2. Meta forwards the message to the configured webhook URL.
3. The backend receives the webhook request.
4. The chatbot processes the message and identifies the requested action.
5. The backend queries PostgreSQL when category, product, cart, or order information is needed.
6. The chatbot generates a response based on the result.
7. The response is sent back to the user through the Messenger integration.

### Main components

- **Messenger integration:** Receives user messages and sends chatbot replies.
- **Express server:** Handles incoming HTTP requests.
- **Chatbot route:** Processes chatbot messages and coordinates the conversational workflow.
- **Database configuration:** Establishes the PostgreSQL connection.
- **PostgreSQL database:** Stores application data and order information.

## 5. Main Features

### 5.1 Main Menu

The chatbot displays a main menu when a user starts a conversation.

The main categories include:

1. Inputs
2. FMCG
3. Machine Rental
4. Vehicle Rental
5. Crop
6. Help

Users can select an option by entering its number or category name.

### 5.2 Category and Subcategory Navigation

The chatbot retrieves categories and subcategories from PostgreSQL.

The Inputs category includes:

- Machines
- Hardware
- Seeds
- Fertilizers
- Pesticides

Users can select a subcategory to view the products associated with it.

The chatbot also supports navigation commands such as `back` and `menu`.

### 5.3 Product Listing

The chatbot displays available active products for the selected category.

Product information can include:

- Product name
- Price
- Available stock

The product listing is retrieved from the database, allowing the chatbot to reflect changes in stored product information.

### 5.4 Product Selection

Users can select a product by entering its displayed number or name.

The chatbot provides product information and allows the user to continue with the shopping process.

### 5.5 Shopping Cart

Users can add products to their cart and specify quantities.

The cart functionality includes:

- Adding products
- Updating quantities for existing cart items
- Viewing cart contents
- Calculating item subtotals
- Calculating the grand total
- Clearing the cart

The cart total is calculated using the product price and selected quantity.

### 5.6 Stock Validation

The backend checks product availability before adding requested quantities to the cart.

It also checks whether the requested quantity exceeds the available stock.

This helps prevent users from adding quantities that exceed the stock available at the time of the check.

### 5.7 Checkout

When users enter `checkout`, the chatbot displays an order summary containing:

- Selected products
- Quantities
- Item totals
- Grand total

The chatbot asks the user to confirm the order before proceeding.

### 5.8 Order Placement

After the user enters `confirm`, the backend creates an order and records its associated items in PostgreSQL.

The chatbot returns an order confirmation containing:

- Order ID
- Total amount
- Order status

The tested workflow returns a status of `Pending` for a newly placed order.

### 5.9 Stock Update

After a successful order, the backend reduces the relevant product stock according to the quantity ordered.

This behavior has been tested using the Tomato Seeds product.

For example, when the stock was 47 and an order contained two units, the stock decreased to 45.

### 5.10 Help and Error Handling

The chatbot provides instructions for supported commands, including:

- `Hi` — start or return to the main menu
- `menu` — browse categories
- `back` — return to the previous selection where supported
- `cart` — view cart contents
- `clear cart` — empty the cart
- `checkout` — review the order
- `confirm` — place the order after checkout

The chatbot also responds to unrecognized inputs with an explanatory message and navigation guidance.

## 6. Database Design

The application uses PostgreSQL to store the data required for chatbot operations.

The following tables are used by the application.

### 6.1 Categories

The `categories` table stores product categories and their hierarchy.

Typical fields include:

- `id` — category identifier
- `name` — category name
- `parent_id` — parent category identifier for subcategories

A `NULL` parent ID identifies a top-level category.

### 6.2 Products

The `products` table stores product information.

Fields used by the chatbot include:

- `id` — product identifier
- `name` — product name
- `description` — product description
- `price` — product price
- `stock` — available quantity
- `category_id` — associated category
- `active` — indicates whether the product is active

The chatbot uses active products when generating product listings.

### 6.3 Conversations

The `conversations` table stores information about a user's current chatbot interaction.

Fields include:

- `id` — conversation record identifier
- `user_id` — associated user identifier
- `current_category_id` — currently selected category
- `current_product_id` — currently selected product
- `current_crop_name` — crop-related conversation information where applicable
- `updated_at` — last update timestamp

This information helps the chatbot determine the context of a user's message.

### 6.4 Cart

The `cart` table stores products selected by users.

Fields include:

- `id` — cart record identifier
- `user_id` — associated user
- `product_id` — selected product
- `quantity` — selected quantity

The chatbot uses these records to calculate the shopping cart total and prepare the checkout summary.

### 6.5 Orders

The `orders` table stores placed orders.

Fields include:

- `id` — order identifier
- `user_id` — associated user
- `total_amount` — total order amount
- `status` — current order status

The application returns the generated order ID after a successful order placement.

### 6.6 Order Items

The `order_items` table stores the products associated with each order.

Fields include:

- `order_id` — associated order
- `product_id` — ordered product
- `quantity` — number of units ordered
- `price` — recorded unit price

This table allows an order to contain one or more products.

### 6.7 Messenger Users

The `messenger_users` table maps a Facebook Messenger user identifier to an internal application user.

The `facebook_psid` field stores the Messenger-scoped user identifier, while `user_id` refers to the application's internal user.

The mapping supports identifying the application user associated with a Messenger conversation.

## 7. Project Structure

The main project files include:

```text
krishivan-whatsapp/
├── src/
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   └── routes/
│       └── chatbot.js
├── package.json
├── package-lock.json
├── README.md
└── .env
```

**Note:** This is the expected high-level structure based on the files identified during development. Keep the actual structure in your README consistent with the folders and files present in your project.

### Important files

- `src/server.js` — initializes the Express server and registers routes.
- `src/config/database.js` — configures the PostgreSQL database connection.
- `src/routes/chatbot.js` — contains chatbot message processing, navigation, product selection, cart, and order logic.
- `package.json` — lists project dependencies and npm scripts.
- `.env` — contains local configuration and secret values; it must not be committed to a public repository.
- `README.md` — explains the project, setup, configuration, and usage.

## 8. Installation and Setup

### Prerequisites

Before running the project, install:

- Node.js and npm
- PostgreSQL
- pgAdmin or another PostgreSQL client
- Visual Studio Code or another code editor
- A Meta developer app with the required Messenger configuration for live integration testing
- ngrok for exposing a local server during webhook testing

### Step 1: Open the project folder

Open a terminal in the project directory:

```powershell
cd "C:\Users\Sanjana Hampanal\krishivan-whatsapp"
```

Use the actual project path if it is different on another computer.

### Step 2: Install dependencies

Run:

```powershell
npm install
```

This installs the dependencies listed in `package.json`.

### Step 3: Configure environment variables

Create a `.env` file in the project root and add the configuration values required by the application.

For example, a database configuration might use:

```text
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
```

The variable names above are examples. Use the exact names expected by `src/config/database.js`.

Add the required Messenger configuration variables according to the application's code, such as the access token and webhook verification token, if those are used.

**Security:** Do not commit `.env`, access tokens, app secrets, or database passwords to GitHub.

### Step 4: Set up PostgreSQL

1. Start the PostgreSQL service.
2. Open pgAdmin.
3. Connect to the database used by the project.
4. Confirm that the required tables exist.
5. Ensure the database credentials match the application's configuration.

The application requires the category, product, conversation, cart, order, order-item, and Messenger-user data used by the code.

### Step 5: Start the backend server

Run:

```powershell
node src/server.js
```

The expected startup message is:

```text
Server running on http://localhost:5000
```

This confirms that the server has started. It does not, by itself, confirm that the Messenger webhook or every database operation is working.

### Step 6: Test the local server

Open a browser and visit:

```text
http://localhost:5000
```

The root endpoint should return the response configured in `src/server.js`.

If the application exposes a database test endpoint, use it to verify the PostgreSQL connection.

### Step 7: Test Messenger integration

For local webhook testing:

1. Start the backend server.
2. Open a second terminal.
3. Run `ngrok http 5000`.
4. Copy the HTTPS forwarding URL generated by ngrok.
5. Configure the Meta webhook callback URL using the required webhook path.
6. Ensure the verification token matches the value expected by the backend.
7. Confirm that the required Messenger webhook events are subscribed.
8. Send a message to the connected Facebook Page and check the chatbot response.

The webhook path and configuration must match the routes actually implemented in the project.

## 9. Chatbot Usage Guide

The following commands can be used to interact with the chatbot.

| Command | Purpose |
|---|---|
| `Hi` | Start the chatbot or display the main menu |
| `menu` | Return to the main menu |
| A category number or name | Select a main category |
| A subcategory number or name | Select a subcategory |
| A product number or name | Select a product |
| `add 2` | Request adding two units of the selected product |
| `cart` | Display the cart |
| `clear cart` | Clear cart contents |
| `checkout` | Display the order summary |
| `confirm` | Confirm an order after checkout |
| `back` | Navigate backward where supported |
| `help` | Display usage instructions |

The exact commands accepted at each step depend on the chatbot's current conversation state and implemented message-handling logic.

## 10. Testing and Verification

The following functionality has been tested during development.

### 10.1 Category navigation

The chatbot displays the main menu and allows navigation into categories and subcategories.

The Inputs category displays Machines, Hardware, Seeds, Fertilizers, and Pesticides.

### 10.2 Product listing

The Seeds category displays Tomato Seeds and Onion Seeds with their prices and current stock.

The chatbot has also been tested with the Machine Rental, Vehicle Rental, and Crop categories.

### 10.3 Cart calculation

The cart has been tested with multiple products and quantities. It displays line-item subtotals and the grand total.

### 10.4 Order creation

A test order was successfully created with the following details:

- Order ID: `11`
- Product: Tomato Seeds
- Quantity: `2`
- Unit price: ₹120
- Total amount: ₹240
- Status: `Pending`

The order was present in PostgreSQL, and the corresponding order-item record contained product ID `6`, quantity `2`, and unit price `120.00`.

### 10.5 Stock update

Before Order #11, Tomato Seeds stock was 47. After ordering two units, the database showed stock of 45.

This verifies the stock reduction for that test order.

### 10.6 Invalid input and navigation

Invalid input handling, cart clearing, back navigation, and stock validation have also been tested during development.

### Testing limitations

These tests demonstrate the flows exercised during local development. They do not constitute a full production security review, concurrency test, load test, or formal end-to-end test suite.

Duplicate order prevention should be tested separately by sending `confirm` again after a successful order and checking whether a second order is created.

## 11. Demo Data and Production Readiness

Some products were inserted for demonstration and testing, including:

- Organic Fertilizer
- Demo Tractor Rental - Per Day
- Demo Farm Vehicle Rental - Per Day
- Demo Tomato Crop - Per Kg

These entries are sample data and should not be treated as approved commercial listings.

Before production deployment:

- Replace demo products and prices with business-approved information.
- Confirm that product descriptions and stock quantities are accurate.
- Verify the order lifecycle with the Krishivan team.
- Test repeated confirmation and duplicate-order prevention.
- Verify stock handling when multiple orders are placed close together.
- Confirm error handling and database transaction behavior.
- Validate webhook security and Meta credentials.
- Review dependencies for known security vulnerabilities.
- Configure production hosting and environment variables securely.

## 12. Security Considerations

The project uses credentials to connect to PostgreSQL and interact with Meta services.

The following practices should be followed:

- Keep secrets in environment variables.
- Never expose access tokens, app secrets, or database passwords in source code.
- Add `.env` to `.gitignore`.
- Do not publish private credentials in GitHub repositories or README examples.
- Validate incoming request data.
- Use parameterized SQL queries for database operations.
- Protect webhook endpoints using the appropriate verification and request-validation mechanisms.
- Use HTTPS for public webhook endpoints.
- Restrict production database access to authorized systems.
- Review dependencies and update vulnerable packages after assessing compatibility.

## 13. Limitations

The current implementation has been tested locally using the available database and demo data.

The following areas require additional verification before production use:

- Duplicate order prevention
- Concurrent stock updates
- Database transaction handling for order creation and stock reduction
- Production hosting and monitoring
- Authentication and webhook request validation
- Error logging and recovery
- Real business product data
- End-to-end testing across all categories and order scenarios

A locally working chatbot should not be considered production-ready until these checks are completed.

## 14. Future Enhancements

Potential improvements include:

- Displaying product images and detailed descriptions.
- Adding order-status tracking.
- Providing order history for returning users.
- Supporting cancellation and return workflows.
- Improving search by product name and category.
- Adding multilingual support for agricultural users.
- Improving logging and monitoring.
- Adding automated integration tests.
- Improving database transaction handling.
- Deploying the backend to a production hosting platform.
- Integrating approved payment and delivery workflows if required by the business.

These are proposed enhancements, not claims that they are already implemented.

## 15. Conclusion

The Krishivan Chatbot Backend provides a conversational interface for browsing agricultural products and services, managing a shopping cart, and placing orders.

The project combines Node.js, Express.js, PostgreSQL, and Facebook Messenger integration to connect user messages with database-backed product and order operations.

The main shopping flow has been tested locally, including product selection, cart calculation, checkout, order creation, and stock reduction.

Further testing, security review, production configuration, and replacement of demo data are recommended before the system is used for real customers.

## 16. Project Status

**Current status:** Core chatbot shopping workflow tested locally.

**Verified:** Category navigation, product listing, cart calculations, checkout summary, order persistence, and stock reduction.

**Remaining:** Verify duplicate-order prevention, confirm production webhook configuration, review security and dependencies, and prepare the final deployment and handover.

