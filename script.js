/* ============================================================
   MyLocalMarket | script.js  (shared by ALL pages)
   Plain JavaScript only (no frameworks, no backend).

   Every page loads this same file. Each <body> has a
   data-page attribute (home, shop, cart, checkout,
   confirmation, dashboard) and init() at the bottom runs
   only the code that belongs to the page that is open.

   Sections:
   1.  Configuration (delivery fee, pickup options, etc.)
   2.  Sample data (starting products)
   3.  State + localStorage helpers
   4.  Small helper functions (formatting, escaping)
   5.  Product cards (used on the landing page and the shop page)
   6.  Landing page
   7.  Shop page (search + category filters)
   8.  Cart (logic + cart page)
   9.  Checkout page + validation
   10. Confirmation page
   11. Shop owner dashboard (stats + inventory management)
   12. Toast messages
   13. Start-up
   ============================================================ */

"use strict";

/* ------------------------------------------------------------
   1. CONFIGURATION
   Change these values in ONE place to change them everywhere.
------------------------------------------------------------ */
const CONFIG = {
  currency: "GH₵",
  deliveryFee: 10, // Sample delivery fee in cedis
  deliveryInfo: "Expected delivery: within 2 to 3 hours of placing your order (sample estimate).",
  pickupLocation: "Auntie Ama's Foodstuff Shop, Stall 14, Madina Market, Accra (sample address)",
  pickupTimes: [
    "Today, 2:00 PM to 4:00 PM",
    "Today, 4:00 PM to 6:00 PM",
    "Tomorrow, 8:00 AM to 10:00 AM",
    "Tomorrow, 10:00 AM to 12:00 PM"
  ],
  lowStockLevel: 5, // Show "Only N left" at or below this quantity

  // Product photos live in this folder, one file per product (see images/README.txt).
  // A product named "Hot Pepper" looks for images/hot-pepper.jpg by default.
  imageFolder: "images/",
  imageExtension: ".jpg" // Change to ".png" or ".webp" if your photos use another format
};

const CATEGORIES = ["Vegetables", "Fruits", "Grains", "Tubers", "Cooking Ingredients"];

// Keys used to save data in the browser's localStorage.
// All pages read the same keys, which is how the pages share data.
const STORAGE_KEYS = {
  products: "mlm_products",
  cart: "mlm_cart",
  orders: "mlm_orders"
};

/* ------------------------------------------------------------
   2. SAMPLE DATA
   Each row: [name, category, price (GH₵), unit, stock, emoji, minutes since stock update]
   Prices and quantities are sample values for the demonstration.
------------------------------------------------------------ */
function buildSampleProducts() {
  const rows = [
    // Vegetables
    ["Tomatoes", "Vegetables", 25, "small basket", 18, "🍅", 35],
    ["Onions", "Vegetables", 14, "kg", 30, "🧅", 90],
    ["Hot Pepper", "Vegetables", 8, "cup", 25, "🌶️", 20],
    ["Garden Eggs", "Vegetables", 10, "bowl", 12, "🍆", 150],
    ["Okro", "Vegetables", 9, "bowl", 0, "🥒", 45],
    ["Cabbage", "Vegetables", 12, "head", 15, "🥬", 200],
    ["Carrots", "Vegetables", 15, "kg", 4, "🥕", 60],
    // Fruits
    ["Pineapple", "Fruits", 12, "each", 20, "🍍", 120],
    ["Oranges", "Fruits", 6, "5 pieces", 40, "🍊", 75],
    ["Mangoes", "Fruits", 10, "3 pieces", 14, "🥭", 300],
    ["Watermelon", "Fruits", 25, "each", 0, "🍉", 25],
    // Grains
    ["Local Rice", "Grains", 95, "5 kg bag", 25, "🍚", 180],
    ["Black-eyed Beans", "Grains", 28, "kg", 40, "🫘", 240],
    ["Maize", "Grains", 9, "kg", 35, "🌽", 400],
    ["Gari", "Grains", 14, "kg", 30, "🥣", 100],
    // Tubers
    ["Yam", "Tubers", 35, "tuber", 22, "🍠", 55],
    ["Cassava", "Tubers", 12, "tuber", 28, "🥔", 130],
    ["Plantain", "Tubers", 28, "bunch", 16, "🍌", 40],
    ["Cocoyam", "Tubers", 18, "kg", 10, "🥔", 500],
    // Cooking ingredients
    ["Palm Oil", "Cooking Ingredients", 40, "litre", 18, "🛢️", 160],
    ["Vegetable Cooking Oil", "Cooking Ingredients", 45, "litre", 24, "🧴", 220],
    ["Salt", "Cooking Ingredients", 4, "pack", 50, "🧂", 600],
    ["Fresh Ginger", "Cooking Ingredients", 12, "250 g", 3, "🌿", 15],
    ["Garlic", "Cooking Ingredients", 8, "100 g", 15, "🧄", 80]
  ];

  // Turn each row into a product object
  return rows.map(function (row, index) {
    return {
      id: index + 1,
      name: row[0],
      category: row[1],
      price: row[2],
      unit: row[3],
      stock: row[4],
      emoji: row[5],
      image: defaultImagePath(row[0]),
      updatedAt: new Date(Date.now() - row[6] * 60000).toISOString()
    };
  });
}

/* ------------------------------------------------------------
   3. STATE + LOCALSTORAGE HELPERS
------------------------------------------------------------ */

// Read JSON from localStorage; use the fallback if nothing is saved or reading fails
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

// Save a value to localStorage as JSON
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage may be full or blocked. The site still works for this visit.
  }
}

// The main data of the app (loaded fresh every time a page opens)
let products = loadFromStorage(STORAGE_KEYS.products, null);
if (!Array.isArray(products) || products.length === 0) {
  products = buildSampleProducts();
  saveToStorage(STORAGE_KEYS.products, products);
}

// Products saved by an older version have no photo path yet, so give them the default one
products.forEach(function (p) {
  if (typeof p.image !== "string") p.image = defaultImagePath(p.name);
});
let cart = loadFromStorage(STORAGE_KEYS.cart, []);     // [{ id, qty }]
let orders = loadFromStorage(STORAGE_KEYS.orders, []); // newest first

// What the customer is currently filtering by on the shop page
let activeCategory = "All";

/* ------------------------------------------------------------
   4. SMALL HELPER FUNCTIONS
------------------------------------------------------------ */
function $(id) {
  return document.getElementById(id);
}

// 25 -> "GH₵ 25.00"
function formatPrice(amount) {
  return CONFIG.currency + " " + Number(amount).toFixed(2);
}

// Round to 2 decimal places to avoid floating point surprises
function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

// Stops user-typed text from being treated as HTML
function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, function (ch) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

// "35 min ago", "2 hr ago", or a date for older updates
function timeAgo(isoString) {
  const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " hr ago";
  return new Date(isoString).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// "Black-eyed Beans" -> "black-eyed-beans" (used for photo file names)
function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// "Hot Pepper" -> "images/hot-pepper.jpg"
function defaultImagePath(name) {
  return CONFIG.imageFolder + slugify(name) + CONFIG.imageExtension;
}

// The product photo as an <img>. If the file is missing, the error listener in
// init() swaps it for the product's emoji (taken from data-emoji), so nothing looks broken.
function pictureHTML(p, cssClass, altText) {
  if (!p.image) {
    return '<span class="emoji">' + escapeHTML(p.emoji) + "</span>";
  }
  return (
    '<img class="' + cssClass + '" src="' + escapeHTML(p.image) + '" alt="' + escapeHTML(altText) +
    '" data-emoji="' + escapeHTML(p.emoji) + '" loading="lazy">'
  );
}

function findProduct(id) {
  return products.find(function (p) {
    return p.id === id;
  });
}

function saveProducts() {
  saveToStorage(STORAGE_KEYS.products, products);
}

function saveCart() {
  saveToStorage(STORAGE_KEYS.cart, cart);
}

/* ------------------------------------------------------------
   5. PRODUCT CARDS (used on the landing page and the shop page)
------------------------------------------------------------ */

// How many of this product are already in the cart
function getCartQty(id) {
  const item = cart.find(function (entry) {
    return entry.id === id;
  });
  return item ? item.qty : 0;
}

// HTML for a single product card
function productCardHTML(p) {
  const inCart = getCartQty(p.id);
  const isOut = p.stock <= 0;
  const isLow = !isOut && p.stock <= CONFIG.lowStockLevel;

  let statusClass = "status-in";
  let statusText = "In stock · " + p.stock + " available";
  if (isOut) {
    statusClass = "status-out";
    statusText = "Out of stock";
  } else if (isLow) {
    statusClass = "status-low";
    statusText = "Only " + p.stock + " left";
  }

  const canAdd = !isOut && inCart < p.stock;
  let buttonLabel = "Add to Cart";
  if (isOut) buttonLabel = "Out of Stock";
  else if (inCart >= p.stock) buttonLabel = "Maximum in Cart";
  else if (inCart > 0) buttonLabel = "Add to Cart (" + inCart + " in cart)";

  return (
    '<article class="product-card' + (isOut ? " is-out" : "") + '" data-id="' + p.id + '">' +
      '<div class="product-image">' +
        pictureHTML(p, "product-photo", p.name) +
        (isOut ? '<span class="sold-out-ribbon">Sold out</span>' : "") +
      "</div>" +
      '<div class="product-body">' +
        '<span class="product-category">' + escapeHTML(p.category) + "</span>" +
        "<h3>" + escapeHTML(p.name) + "</h3>" +
        '<p class="product-price">' + formatPrice(p.price) + " <small>per " + escapeHTML(p.unit) + "</small></p>" +
        '<p class="stock-status ' + statusClass + '">' + statusText + "</p>" +
        '<p class="updated">Stock updated ' + timeAgo(p.updatedAt) + "</p>" +
        '<button type="button" class="btn btn-primary btn-add" data-add="' + p.id + '"' + (canAdd ? "" : " disabled") + ">" + buttonLabel + "</button>" +
      "</div>" +
    "</article>"
  );
}

// After the cart changes, redraw whatever product cards this page shows
function refreshProductViews() {
  const page = document.body.dataset.page;
  if (page === "shop") renderCatalogue();
  if (page === "home") renderFeatured();
}

/* ------------------------------------------------------------
   6. LANDING PAGE (index.html)
------------------------------------------------------------ */

// Live numbers under the hero, taken from the product list
function renderHomeStats() {
  const inStock = products.filter(function (p) {
    return p.stock > 0;
  }).length;

  // Find the most recent stock update among all products
  let latest = products[0].updatedAt;
  products.forEach(function (p) {
    if (new Date(p.updatedAt) > new Date(latest)) latest = p.updatedAt;
  });

  $("home-stats").innerHTML =
    '<div class="stat-chip"><strong>' + products.length + "</strong> foodstuffs listed</div>" +
    '<div class="stat-chip"><strong>' + inStock + "</strong> in stock right now</div>" +
    '<div class="stat-chip">Stock last updated <strong>' + timeAgo(latest) + "</strong></div>";
}

// One in-stock product from each category, showing the first four
function renderFeatured() {
  const picks = [];
  CATEGORIES.forEach(function (category) {
    const match = products.find(function (p) {
      return p.category === category && p.stock > 0;
    });
    if (match) picks.push(match);
  });
  $("featured-grid").innerHTML = picks.slice(0, 4).map(productCardHTML).join("");
}

function initHomePage() {
  renderHomeStats();
  renderFeatured();

  // Fill the delivery fee into the text, taken from CONFIG
  document.querySelectorAll("[data-fee]").forEach(function (el) {
    el.textContent = formatPrice(CONFIG.deliveryFee);
  });

  $("featured-grid").addEventListener("click", function (event) {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(Number(button.dataset.add));
  });
}

/* ------------------------------------------------------------
   7. SHOP PAGE (shop.html): browse, search, filter
------------------------------------------------------------ */

// Build the category buttons: All + each category
function renderCategoryChips() {
  const names = ["All"].concat(CATEGORIES);
  $("category-filters").innerHTML = names
    .map(function (name) {
      const activeClass = name === activeCategory ? " active" : "";
      return '<button type="button" class="chip' + activeClass + '" data-category="' + escapeHTML(name) + '">' + escapeHTML(name) + "</button>";
    })
    .join("");
}

// Show the products that match the search text and the chosen category
function renderCatalogue() {
  renderCategoryChips();

  const searchText = $("search-input").value.trim().toLowerCase();

  const filtered = products.filter(function (p) {
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchText);
    return matchesCategory && matchesSearch;
  });

  $("product-grid").innerHTML = filtered.map(productCardHTML).join("");
  $("no-results").hidden = filtered.length > 0;

  const inStockCount = filtered.filter(function (p) {
    return p.stock > 0;
  }).length;
  $("results-count").textContent =
    "Showing " + filtered.length + " item" + (filtered.length === 1 ? "" : "s") + " (" + inStockCount + " in stock)";
}

function initShopPage() {
  // Links from the landing page can open the shop pre-filtered:
  //   shop.html?category=Tubers   or   shop.html?q=rice
  const params = new URLSearchParams(window.location.search);
  const categoryFromUrl = params.get("category");
  if (categoryFromUrl && CATEGORIES.indexOf(categoryFromUrl) !== -1) {
    activeCategory = categoryFromUrl;
  }
  const searchFromUrl = params.get("q");
  if (searchFromUrl) $("search-input").value = searchFromUrl;

  $("search-input").addEventListener("input", renderCatalogue);
  $("category-filters").addEventListener("click", function (event) {
    const chip = event.target.closest("[data-category]");
    if (!chip) return;
    activeCategory = chip.dataset.category;
    renderCatalogue();
  });
  $("product-grid").addEventListener("click", function (event) {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(Number(button.dataset.add));
  });

  renderCatalogue();
}

/* ------------------------------------------------------------
   8. CART (logic used on every page + the cart page)
------------------------------------------------------------ */

// Removes items that no longer exist or are out of stock, and
// reduces quantities that are higher than the available stock.
function cleanCart() {
  cart = cart.filter(function (item) {
    const product = findProduct(item.id);
    if (!product || product.stock <= 0) return false;
    if (item.qty > product.stock) item.qty = product.stock;
    return item.qty > 0;
  });
  saveCart();
}

// The little number on the Cart link in the menu
function updateCartBadge() {
  let total = 0;
  cart.forEach(function (item) {
    total += item.qty;
  });
  $("cart-count").textContent = total;
}

function calcSubtotal() {
  let subtotal = 0;
  cart.forEach(function (item) {
    const product = findProduct(item.id);
    if (product) subtotal += product.price * item.qty;
  });
  return roundMoney(subtotal);
}

function addToCart(id) {
  const product = findProduct(id);
  if (!product) return;

  if (product.stock <= 0) {
    showToast(product.name + " is out of stock.", "error");
    return;
  }

  const existing = cart.find(function (item) {
    return item.id === id;
  });
  const currentQty = existing ? existing.qty : 0;

  // Never allow more than the available stock
  if (currentQty + 1 > product.stock) {
    showToast("Only " + product.stock + " " + product.name + " available.", "error");
    return;
  }

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: id, qty: 1 });
  }

  saveCart();
  updateCartBadge();
  refreshProductViews();
  showToast(product.name + " added to your cart.", "success");
}

// Change a cart quantity by +1 or -1
function changeCartQty(id, change) {
  const item = cart.find(function (entry) {
    return entry.id === id;
  });
  const product = findProduct(id);
  if (!item || !product) return;

  const newQty = item.qty + change;
  if (newQty < 1) return; // Use "Remove" to delete an item
  if (newQty > product.stock) {
    showToast("Only " + product.stock + " " + product.name + " available.", "error");
    return;
  }

  item.qty = newQty;
  saveCart();
  updateCartBadge();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(function (item) {
    return item.id !== id;
  });
  saveCart();
  updateCartBadge();
  renderCart();
  showToast("Item removed from your cart.", "success");
}

function renderCart() {
  cleanCart();
  updateCartBadge();

  const isEmpty = cart.length === 0;
  $("cart-empty").hidden = !isEmpty;
  $("cart-content").hidden = isEmpty;
  if (isEmpty) return;

  $("cart-items").innerHTML = cart
    .map(function (item) {
      const p = findProduct(item.id);
      const atMax = item.qty >= p.stock;
      return (
        '<div class="cart-row">' +
          '<div class="thumb thumb-cart">' + pictureHTML(p, "thumb-img", "") + "</div>" +
          "<div>" +
            '<div class="cart-name">' + escapeHTML(p.name) + "</div>" +
            '<div class="cart-unit-price">' + formatPrice(p.price) + " per " + escapeHTML(p.unit) + "</div>" +
            '<button type="button" class="remove-btn" data-action="remove" data-id="' + p.id + '">Remove</button>' +
          "</div>" +
          '<div class="qty-controls">' +
            '<button type="button" class="qty-btn" data-action="dec" data-id="' + p.id + '" aria-label="Decrease quantity of ' + escapeHTML(p.name) + '"' + (item.qty <= 1 ? " disabled" : "") + ">−</button>" +
            '<span class="qty-value">' + item.qty + "</span>" +
            '<button type="button" class="qty-btn" data-action="inc" data-id="' + p.id + '" aria-label="Increase quantity of ' + escapeHTML(p.name) + '"' + (atMax ? " disabled" : "") + ">+</button>" +
          "</div>" +
          '<div class="cart-line-total"><strong>' + formatPrice(p.price * item.qty) + "</strong>" +
            (atMax ? '<span class="small-note">Max stock reached</span>' : "") +
          "</div>" +
        "</div>"
      );
    })
    .join("");

  $("cart-subtotal").textContent = formatPrice(calcSubtotal());
}

function initCartPage() {
  $("cart-items").addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "inc") changeCartQty(id, 1);
    if (button.dataset.action === "dec") changeCartQty(id, -1);
    if (button.dataset.action === "remove") removeFromCart(id);
  });

  $("clear-cart").addEventListener("click", function () {
    cart = [];
    saveCart();
    updateCartBadge();
    renderCart();
    showToast("Cart cleared.", "success");
  });

  renderCart();
}

/* ------------------------------------------------------------
   9. CHECKOUT PAGE (checkout.html) + VALIDATION
------------------------------------------------------------ */

// Which fulfilment option is selected: "delivery", "pickup" or ""
function getFulfilment() {
  const selected = document.querySelector('input[name="fulfilment"]:checked');
  return selected ? selected.value : "";
}

// The delivery fee depends on the selected option (0 for pickup)
function calcDeliveryFee() {
  return getFulfilment() === "delivery" ? CONFIG.deliveryFee : 0;
}

// Show only the fields that belong to the chosen option
function updateFulfilmentPanels() {
  const choice = getFulfilment();
  $("delivery-fields").hidden = choice !== "delivery";
  $("pickup-fields").hidden = choice !== "pickup";
}

function renderCheckoutSummary() {
  $("checkout-items").innerHTML = cart
    .map(function (item) {
      const p = findProduct(item.id);
      return (
        '<div class="checkout-item"><span>' + escapeHTML(p.name) + " × " + item.qty + "</span><span>" +
        formatPrice(p.price * item.qty) + "</span></div>"
      );
    })
    .join("");

  const subtotal = calcSubtotal();
  const fee = calcDeliveryFee();
  const choice = getFulfilment();

  $("co-subtotal").textContent = formatPrice(subtotal);
  if (choice === "delivery") {
    $("co-delivery").textContent = formatPrice(fee);
  } else if (choice === "pickup") {
    $("co-delivery").textContent = "None (pickup)";
  } else {
    $("co-delivery").textContent = "Choose an option";
  }
  $("co-total").textContent = formatPrice(roundMoney(subtotal + fee));
}

function setError(fieldId, errorId, message) {
  $(errorId).textContent = message;
  const field = $(fieldId) ? $(fieldId).closest(".field") : null;
  if (field) field.classList.toggle("has-error", message !== "");
}

function clearCheckoutErrors() {
  setError("cust-name", "err-name", "");
  setError("cust-phone", "err-phone", "");
  setError("cust-address", "err-address", "");
  setError("pickup-time", "err-pickup-time", "");
  $("err-fulfilment").textContent = "";
}

// Accepts 0241234567, 024 123 4567, 024-123-4567, +233241234567, 233241234567
function isValidGhanaPhone(value) {
  const cleaned = value.replace(/[\s-]/g, "");
  return /^(0\d{9}|\+233\d{9}|233\d{9})$/.test(cleaned);
}

// Checks every required field. Returns an object with the first problem field.
function validateCheckout() {
  clearCheckoutErrors();
  let firstBadField = null;

  const name = $("cust-name").value.trim();
  const phone = $("cust-phone").value.trim();
  const choice = getFulfilment();

  if (name.length < 2) {
    setError("cust-name", "err-name", "Please enter your full name.");
    firstBadField = firstBadField || $("cust-name");
  }

  if (phone === "") {
    setError("cust-phone", "err-phone", "Please enter your contact number.");
    firstBadField = firstBadField || $("cust-phone");
  } else if (!isValidGhanaPhone(phone)) {
    setError("cust-phone", "err-phone", "Enter a valid Ghana number, e.g. 024 123 4567.");
    firstBadField = firstBadField || $("cust-phone");
  }

  if (choice === "") {
    $("err-fulfilment").textContent = "Please choose Home Delivery or Shop Pickup.";
    firstBadField = firstBadField || document.querySelector('input[name="fulfilment"]');
  }

  if (choice === "delivery" && $("cust-address").value.trim().length < 5) {
    setError("cust-address", "err-address", "Please describe where we should deliver (at least 5 characters).");
    firstBadField = firstBadField || $("cust-address");
  }

  if (choice === "pickup" && $("pickup-time").value === "") {
    setError("pickup-time", "err-pickup-time", "Please choose a pickup time.");
    firstBadField = firstBadField || $("pickup-time");
  }

  return { valid: firstBadField === null, firstBadField: firstBadField };
}

// Creates a reference like MLM-261010-4821 that is not used by any saved order
function generateOrderRef() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  let ref;
  let isTaken;
  do {
    const random = String(Math.floor(1000 + Math.random() * 9000));
    ref = "MLM-" + yy + mm + dd + "-" + random;
    isTaken = orders.some(function (order) {
      return order.ref === ref;
    });
  } while (isTaken);
  return ref;
}

function placeOrder() {
  const result = validateCheckout();
  if (!result.valid) {
    showToast("Please fix the highlighted fields.", "error");
    if (result.firstBadField) result.firstBadField.focus();
    return;
  }

  // Check stock again: it may have changed since the items were added
  const problems = [];
  cart.forEach(function (item) {
    const p = findProduct(item.id);
    if (!p || p.stock < item.qty) {
      problems.push(p ? p.name : "An item");
    }
  });
  if (problems.length > 0) {
    cleanCart();
    updateCartBadge();
    showToast("Stock changed for: " + problems.join(", ") + ". Please review your cart.", "error");
    setTimeout(function () {
      window.location.href = "cart.html";
    }, 1800);
    return;
  }

  const choice = getFulfilment();
  const subtotal = calcSubtotal();
  const fee = calcDeliveryFee();

  // Build the order record
  const orderItems = cart.map(function (item) {
    const p = findProduct(item.id);
    return {
      name: p.name,
      unit: p.unit,
      price: p.price,
      qty: item.qty,
      lineTotal: roundMoney(p.price * item.qty)
    };
  });

  const order = {
    ref: generateOrderRef(),
    createdAt: new Date().toISOString(),
    customerName: $("cust-name").value.trim(),
    customerPhone: $("cust-phone").value.trim(),
    items: orderItems,
    subtotal: subtotal,
    deliveryFee: fee,
    total: roundMoney(subtotal + fee),
    fulfilment: choice,
    address: choice === "delivery" ? $("cust-address").value.trim() : "",
    pickupTime: choice === "pickup" ? $("pickup-time").value : "",
    pickupLocation: choice === "pickup" ? CONFIG.pickupLocation : ""
  };

  // Reduce the demonstration stock
  cart.forEach(function (item) {
    const p = findProduct(item.id);
    p.stock -= item.qty;
    p.updatedAt = new Date().toISOString();
  });

  orders.unshift(order); // newest first
  saveProducts();
  saveToStorage(STORAGE_KEYS.orders, orders);

  // Clear the cart
  cart = [];
  saveCart();
  updateCartBadge();

  // Stop a second click from placing the order twice, then go to the confirmation page
  $("place-order-btn").disabled = true;
  window.location.href = "confirmation.html?ref=" + encodeURIComponent(order.ref);
}

function initCheckoutPage() {
  // Nothing to check out? Show a friendly message instead of the form.
  if (cart.length === 0) {
    $("checkout-empty").hidden = false;
    $("checkout-content").hidden = true;
    return;
  }

  // Fill the pickup-time drop-down from CONFIG
  $("pickup-time").innerHTML =
    '<option value="">Select a time…</option>' +
    CONFIG.pickupTimes
      .map(function (time) {
        return '<option value="' + escapeHTML(time) + '">' + escapeHTML(time) + "</option>";
      })
      .join("");

  $("delivery-desc").textContent = "Brought to you for " + formatPrice(CONFIG.deliveryFee);
  $("pickup-desc").textContent = "Collect from the shop. No delivery fee.";
  $("delivery-info").textContent = CONFIG.deliveryInfo;
  $("pickup-location").textContent = CONFIG.pickupLocation;

  document.querySelectorAll('input[name="fulfilment"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      $("err-fulfilment").textContent = "";
      updateFulfilmentPanels();
      renderCheckoutSummary();
    });
  });

  $("checkout-form").addEventListener("submit", function (event) {
    event.preventDefault();
    placeOrder();
  });

  updateFulfilmentPanels();
  renderCheckoutSummary();
}

/* ------------------------------------------------------------
   10. CONFIRMATION PAGE (confirmation.html)
   The checkout page sends the customer here with ?ref=MLM-...
------------------------------------------------------------ */
function renderConfirmation(order) {
  const itemsHTML = order.items
    .map(function (item) {
      return (
        '<div class="checkout-item"><span>' + escapeHTML(item.name) + " × " + item.qty +
        " (" + formatPrice(item.price) + " per " + escapeHTML(item.unit) + ")</span><span>" +
        formatPrice(item.lineTotal) + "</span></div>"
      );
    })
    .join("");

  let methodHTML;
  if (order.fulfilment === "delivery") {
    methodHTML =
      "<p><strong>Method:</strong> 🚚 Home Delivery</p>" +
      "<p><strong>Delivery address:</strong> " + escapeHTML(order.address) + "</p>" +
      "<p>" + escapeHTML(CONFIG.deliveryInfo) + "</p>";
  } else {
    methodHTML =
      "<p><strong>Method:</strong> 🏪 Shop Pickup</p>" +
      "<p><strong>Pickup location:</strong> " + escapeHTML(order.pickupLocation) + "</p>" +
      "<p><strong>Pickup time:</strong> " + escapeHTML(order.pickupTime) + "</p>";
  }

  const feeText = order.fulfilment === "delivery" ? formatPrice(order.deliveryFee) : "None (pickup)";

  $("confirmation-content").innerHTML =
    '<div class="confirm-header">' +
      '<div class="confirm-icon" aria-hidden="true">✅</div>' +
      "<h2>Thank you, " + escapeHTML(order.customerName) + "! Your order has been placed.</h2>" +
      '<p>Demonstration order reference:</p><span class="order-ref">' + escapeHTML(order.ref) + "</span>" +
    "</div>" +
    '<div class="confirm-section"><h3>Items</h3>' + itemsHTML + "</div>" +
    '<div class="confirm-section">' +
      '<div class="summary-line"><span>Subtotal</span><strong>' + formatPrice(order.subtotal) + "</strong></div>" +
      '<div class="summary-line"><span>Delivery fee</span><strong>' + feeText + "</strong></div>" +
      '<div class="summary-line total-line"><span>Total</span><strong>' + formatPrice(order.total) + "</strong></div>" +
    "</div>" +
    '<div class="confirm-section"><h3>Fulfilment</h3>' + methodHTML +
      "<p><strong>Contact number:</strong> " + escapeHTML(order.customerPhone) + "</p>" +
    "</div>" +
    '<p class="demo-note"><strong>Payment:</strong> No payment was taken online (this is a prototype). ' +
    "In a real shop you would pay on " + (order.fulfilment === "delivery" ? "delivery" : "pickup") + ".</p>" +
    '<div class="confirm-actions">' +
      '<a class="btn btn-primary" href="shop.html">Continue Shopping</a>' +
      '<a class="btn btn-ghost" href="index.html">Back to Home</a>' +
    "</div>";
}

function initConfirmationPage() {
  const ref = new URLSearchParams(window.location.search).get("ref");

  // No ref in the address? Fall back to the most recent order.
  let order = null;
  if (ref) {
    order = orders.find(function (o) {
      return o.ref === ref;
    });
  } else if (orders.length > 0) {
    order = orders[0];
  }

  if (order) {
    renderConfirmation(order);
  } else {
    $("confirmation-content").innerHTML =
      '<div class="empty-state"><p class="empty-icon" aria-hidden="true">🔎</p>' +
      "<p>We could not find that order on this browser.</p>" +
      '<a class="btn btn-primary" href="shop.html">Browse Foodstuffs</a></div>';
  }
}

/* ------------------------------------------------------------
   11. SHOP OWNER DASHBOARD (dashboard.html)
------------------------------------------------------------ */

// The summary cards at the top of the dashboard
function renderStats() {
  let inStock = 0;
  let low = 0;
  let out = 0;
  products.forEach(function (p) {
    if (p.stock <= 0) out += 1;
    else {
      inStock += 1;
      if (p.stock <= CONFIG.lowStockLevel) low += 1;
    }
  });

  let orderValue = 0;
  orders.forEach(function (order) {
    orderValue += order.total;
  });

  const cards = [
    { icon: "📦", label: "Products listed", value: products.length, cls: "" },
    { icon: "✅", label: "In stock", value: inStock, cls: "stat-good" },
    { icon: "⚠️", label: "Low stock", value: low, cls: "stat-warn" },
    { icon: "⛔", label: "Out of stock", value: out, cls: "stat-bad" },
    { icon: "🧾", label: "Orders placed", value: orders.length, cls: "" },
    { icon: "💰", label: "Value of orders (demo)", value: formatPrice(roundMoney(orderValue)), cls: "" }
  ];

  $("stats-grid").innerHTML = cards
    .map(function (card) {
      return (
        '<div class="stat-card ' + card.cls + '"><span class="stat-icon" aria-hidden="true">' + card.icon +
        '</span><span class="stat-value">' + card.value + '</span><span class="stat-label">' + card.label + "</span></div>"
      );
    })
    .join("");
}

function renderInventory() {
  $("inventory-body").innerHTML = products
    .map(function (p) {
      const isOut = p.stock <= 0;
      const statusClass = isOut ? "status-out" : p.stock <= CONFIG.lowStockLevel ? "status-low" : "status-in";
      const statusText = isOut ? "Out of stock" : p.stock <= CONFIG.lowStockLevel ? "Low stock" : "In stock";

      // Out-of-stock items get a Restore button; others get Mark out of stock
      const toggleButton = isOut
        ? '<button type="button" class="btn btn-ghost btn-sm" data-owner="restore" data-id="' + p.id + '">Restore</button>'
        : '<button type="button" class="btn btn-danger btn-sm" data-owner="out" data-id="' + p.id + '">Mark out of stock</button>';

      return (
        '<tr data-id="' + p.id + '">' +
          '<td data-label="Product"><div class="inv-product"><div class="thumb thumb-inv">' + pictureHTML(p, "thumb-img", "") + "</div><div>" +
            '<span class="inv-name">' + escapeHTML(p.name) + '</span><br><span class="small-note">' +
            escapeHTML(p.category) + " · per " + escapeHTML(p.unit) + "</span></div></div></td>" +
          '<td data-label="Price (GH₵)"><input type="number" class="price-input" min="0" step="0.01" value="' + p.price + '" aria-label="Price of ' + escapeHTML(p.name) + '"></td>' +
          '<td data-label="Stock"><input type="number" class="stock-input" min="0" step="1" value="' + p.stock + '" aria-label="Stock of ' + escapeHTML(p.name) + '"></td>' +
          '<td data-label="Status"><span class="stock-status ' + statusClass + '">' + statusText + "</span></td>" +
          '<td data-label="Actions"><div class="inv-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-owner="save" data-id="' + p.id + '">Save changes</button>' +
            toggleButton +
          "</div></td>" +
        "</tr>"
      );
    })
    .join("");
}

// Table of the most recent saved orders
function renderOrders() {
  const container = $("orders-list");

  if (orders.length === 0) {
    container.innerHTML = '<p class="empty-state">No orders yet. Orders placed on this browser will appear here.</p>';
    return;
  }

  const rows = orders
    .slice(0, 10)
    .map(function (order) {
      const method = order.fulfilment === "delivery" ? "Delivery" : "Pickup";
      let itemCount = 0;
      order.items.forEach(function (item) {
        itemCount += item.qty;
      });
      return (
        "<tr><td>" + escapeHTML(order.ref) + "</td><td>" + formatDateTime(order.createdAt) + "</td><td>" +
        escapeHTML(order.customerName) + "</td><td>" + itemCount + "</td><td>" + method + "</td><td>" +
        formatPrice(order.total) + "</td></tr>"
      );
    })
    .join("");

  container.innerHTML =
    '<div class="table-wrap"><table class="orders-table"><thead><tr>' +
    "<th>Reference</th><th>Placed</th><th>Customer</th><th>Items</th><th>Method</th><th>Total</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table></div>";
}

function renderDashboard() {
  renderStats();
  renderInventory();
  renderOrders();
}

// Whenever stock changes, make sure the cart still makes sense
function afterInventoryChange() {
  saveProducts();
  cleanCart();
  updateCartBadge();
  renderDashboard();
}

// Handles Save / Mark out of stock / Restore clicks in the inventory table
function handleInventoryClick(event) {
  const button = event.target.closest("button[data-owner]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const product = findProduct(id);
  const row = button.closest("tr");
  if (!product || !row) return;

  const action = button.dataset.owner;
  const priceInput = row.querySelector(".price-input");
  const stockInput = row.querySelector(".stock-input");

  if (action === "save") {
    const newPrice = parseFloat(priceInput.value);
    const newStock = parseInt(stockInput.value, 10);

    if (isNaN(newPrice) || newPrice <= 0) {
      showToast("Enter a price greater than 0.", "error");
      return;
    }
    if (isNaN(newStock) || newStock < 0 || String(stockInput.value).indexOf(".") !== -1) {
      showToast("Stock must be a whole number, 0 or more.", "error");
      return;
    }

    product.price = roundMoney(newPrice);
    product.stock = newStock;
    product.updatedAt = new Date().toISOString();
    afterInventoryChange();
    showToast(product.name + " updated.", "success");
  }

  if (action === "out") {
    product.stock = 0;
    product.updatedAt = new Date().toISOString();
    afterInventoryChange();
    showToast(product.name + " marked as out of stock.", "success");
  }

  if (action === "restore") {
    const restoredStock = parseInt(stockInput.value, 10);
    if (isNaN(restoredStock) || restoredStock < 1) {
      showToast("Type the new stock quantity (1 or more) first, then press Restore.", "error");
      stockInput.focus();
      return;
    }
    product.stock = restoredStock;
    product.updatedAt = new Date().toISOString();
    afterInventoryChange();
    showToast(product.name + " is available again.", "success");
  }
}

function addProduct(event) {
  event.preventDefault();

  const name = $("new-name").value.trim();
  const category = $("new-category").value;
  const price = parseFloat($("new-price").value);
  const unit = $("new-unit").value.trim();
  const stockText = $("new-stock").value.trim();
  const stock = parseInt(stockText, 10);
  const emoji = $("new-emoji").value.trim() || "🛒";
  const imageName = $("new-image").value.trim();

  let message = "";
  const nameExists = products.some(function (p) {
    return p.name.toLowerCase() === name.toLowerCase();
  });

  if (name.length < 2) message = "Please enter a product name.";
  else if (nameExists) message = "A product with this name already exists. Update it in the table below instead.";
  else if (isNaN(price) || price <= 0) message = "Please enter a price greater than 0.";
  else if (unit === "") message = "Please enter a unit, e.g. kg or bowl.";
  else if (stockText === "" || isNaN(stock) || stock < 0 || stockText.indexOf(".") !== -1) message = "Stock must be a whole number, 0 or more.";
  else if (imageName !== "" && !/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(imageName)) message = "Photo file name must look like sweet-potatoes.jpg (letters, numbers, - and _ only).";

  $("err-add-product").textContent = message;
  if (message !== "") return;

  // Give the new product the next free id
  let maxId = 0;
  products.forEach(function (p) {
    if (p.id > maxId) maxId = p.id;
  });

  products.push({
    id: maxId + 1,
    name: name,
    category: category,
    price: roundMoney(price),
    unit: unit,
    stock: stock,
    emoji: emoji,
    // A typed file name is looked up in the images folder; blank uses images/<product-name>.jpg
    image: imageName !== "" ? CONFIG.imageFolder + imageName : defaultImagePath(name),
    updatedAt: new Date().toISOString()
  });

  $("add-product-form").reset();
  afterInventoryChange();
  showToast(name + " added to the catalogue.", "success");
}

function resetDemoData() {
  const sure = window.confirm("Reset all demo data? This restores the sample products and clears the cart and saved orders.");
  if (!sure) return;

  products = buildSampleProducts();
  cart = [];
  orders = [];
  saveProducts();
  saveCart();
  saveToStorage(STORAGE_KEYS.orders, orders);

  updateCartBadge();
  renderDashboard();
  showToast("Demo data has been reset.", "success");
}

function initDashboardPage() {
  // Fill the category drop-down in the "Add product" form
  $("new-category").innerHTML = CATEGORIES.map(function (category) {
    return '<option value="' + escapeHTML(category) + '">' + escapeHTML(category) + "</option>";
  }).join("");

  $("inventory-body").addEventListener("click", handleInventoryClick);
  $("add-product-form").addEventListener("submit", addProduct);
  $("reset-demo").addEventListener("click", resetDemoData);

  renderDashboard();
}

/* ------------------------------------------------------------
   12. TOAST MESSAGES (small pop-ups for success / error)
------------------------------------------------------------ */
function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = "toast " + (type || "success");
  toast.textContent = message;
  $("toast-container").appendChild(toast);

  // Remove after 3 seconds
  setTimeout(function () {
    toast.remove();
  }, 3000);
}

/* ------------------------------------------------------------
   13. START-UP
   Runs on every page: first the parts every page shares (menu,
   cart badge, footer year), then the code for the open page.
------------------------------------------------------------ */
function init() {
  // If a product photo fails to load (file missing), show the product's emoji instead.
  // "error" events do not bubble, so the listener uses capture mode (the "true" at the end).
  document.addEventListener(
    "error",
    function (event) {
      const img = event.target;
      if (img.tagName === "IMG" && img.dataset.emoji !== undefined) {
        const fallback = document.createElement("span");
        fallback.className = "emoji";
        fallback.textContent = img.dataset.emoji;
        img.replaceWith(fallback);
      }
    },
    true
  );

  // Shared by all pages
  $("year").textContent = new Date().getFullYear();

  $("menu-toggle").addEventListener("click", function () {
    const isOpen = $("main-nav").classList.toggle("open");
    $("menu-toggle").setAttribute("aria-expanded", String(isOpen));
  });

  // Make sure the saved cart matches the saved stock
  cleanCart();
  updateCartBadge();

  // Page-specific code. The page name comes from <body data-page="...">
  const page = document.body.dataset.page;
  if (page === "home") initHomePage();
  if (page === "shop") initShopPage();
  if (page === "cart") initCartPage();
  if (page === "checkout") initCheckoutPage();
  if (page === "confirmation") initConfirmationPage();
  if (page === "dashboard") initDashboardPage();
}

init();
