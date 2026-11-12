/**
 * شُرَاك | SHURAK - المنطق الرئيسي (متعدد الصفحات)
 */

// ========== البيانات التجريبية (تُستبدل بـ Firestore لاحقاً) ==========
const DEMO_PRODUCTS = [];

const CATEGORIES = [
  { id: "إلكترونيات", name: "إلكترونيات", icon: "" },
  { id: "أزياء", name: "أزياء", icon: "" },
  { id: "كتب", name: "كتب", icon: "" },
  { id: "ألعاب", name: "ألعاب", icon: "" },
  { id: "أخرى", name: "أخرى", icon: "" }
];

// ========== الحالة ==========
let cart = JSON.parse(localStorage.getItem("shurak_cart") || "[]");
let currentUser = JSON.parse(localStorage.getItem("shurak_user") || "null");
let products = JSON.parse(localStorage.getItem("shurak_products") || "[]");

// لا توجد منتجات افتراضية - المنتجات يضيفها التجار فقط

// ========== تهيئة حسب الصفحة ==========
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  updateAuthUI();
  bindGlobalEvents();

  const page = document.body.dataset.page || getPageName();

  // إجبار تسجيل الدخول لعرض المنتجات
  if ((page === "home" || page === "products") && !currentUser) {
    showLoginRequired(page);
    return;
  }

  if (page === "home" || !page) {
    renderCategories("categoriesGrid");
    loadAndRenderProducts("productsGrid", 6);
  }
  if (page === "products") {
    renderCategories("categoriesGrid");
    setupFilters();
    loadAndRenderProducts("productsGrid");
    setupSearch();
  }
  if (page === "cart") {
    if (!currentUser) {
      showLoginRequired("cart");
      return;
    }
    renderCartPage();
  }
  if (page === "account") {
    renderAccountPage();
  }
  if (page === "seller") {
    renderSellerPage();
  }
});

function showLoginRequired(page) {
  const containers = ["productsGrid", "categoriesGrid", "cartContent", "cartItemsList"];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  // إخفاء المحتوى العادي
  document.querySelectorAll(".products, .categories, .cart-layout, #cartContent").forEach(el => {
    if (el) el.style.display = "none";
  });

  const target = document.querySelector(".products .container") || 
                 document.querySelector(".page-header")?.nextElementSibling ||
                 document.querySelector("main") ||
                 document.body;

  const box = document.createElement("div");
  box.className = "form-card";
  box.style.margin = "40px auto";
  box.style.maxWidth = "420px";
  box.style.textAlign = "center";
  box.innerHTML = `
    <h2>يجب تسجيل الدخول</h2>
    <p class="subtitle">عشان تشوف المنتجات وتتسوق لازم تسجل دخولك أولاً بحساب Google</p>
    <button class="btn btn-primary btn-block" onclick="loginWithGoogle()">دخول بواسطة Google</button>
  `;
  
  // حاول نلق مكان مناسب
  const productsSection = document.querySelector(".products");
  if (productsSection) {
    productsSection.style.display = "block";
    const container = productsSection.querySelector(".container") || productsSection;
    container.innerHTML = "";
    container.appendChild(box);
  } else {
    document.body.appendChild(box);
  }
}

async function loadAndRenderProducts(containerId, limit) {
  // حاول تجيب من Firestore أولاً
  if (window.SHURAK && window.SHURAK.db) {
    try {
      const snap = await window.SHURAK.db.collection("products")
        .where("status", "==", "available")
        .get();
      if (!snap.empty) {
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem("shurak_products", JSON.stringify(products));
      }
    } catch (e) {
      console.warn("ما قدرنا نجيب من Firestore، نستخدم المحلي:", e.message);
    }
  }
  const list = limit ? products.slice(0, limit) : products;
  renderProducts(containerId, list);
}

function getPageName() {
  const path = window.location.pathname;
  if (path.includes("products")) return "products";
  if (path.includes("cart")) return "cart";
  if (path.includes("account")) return "account";
  if (path.includes("seller")) return "seller";
  if (path.includes("terms")) return "terms";
  return "home";
}

// ========== المصادقة (Google الحقيقي + وضع تجريبي) ==========
function updateAuthUI() {
  const loginBtn = document.getElementById("loginBtn");
  const accountBtn = document.getElementById("accountBtn");
  const adminLink = document.getElementById("adminLink");
  if (!loginBtn) return;

  if (currentUser) {
    loginBtn.classList.add("hidden");
    if (accountBtn) {
      accountBtn.classList.remove("hidden");
      const nameEl = document.getElementById("userName");
      const avatarEl = document.getElementById("userAvatar");
      if (nameEl) nameEl.textContent = (currentUser.name || currentUser.displayName || "حسابي").split(" ")[0];
      if (avatarEl && (currentUser.photoURL || currentUser.photo)) {
        avatarEl.src = currentUser.photoURL || currentUser.photo;
      }
    }
    // إظهار رابط الإدارة إذا كان أدمن
    if (adminLink) {
      if (currentUser.role === "admin") {
        adminLink.classList.remove("hidden");
      } else {
        adminLink.classList.add("hidden");
      }
    }
  } else {
    loginBtn.classList.remove("hidden");
    if (accountBtn) accountBtn.classList.add("hidden");
    if (adminLink) adminLink.classList.add("hidden");
  }
}

async function loginWithGoogle() {
  if (window.SHURAK && window.SHURAK.isFirebaseConfigured && window.SHURAK.auth) {
    try {
      const result = await window.SHURAK.auth.signInWithPopup(window.SHURAK.googleProvider);
      const user = result.user;
      currentUser = {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        phone: "",
        city: "",
        address: "",
        role: "user",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      localStorage.setItem("shurak_user", JSON.stringify(currentUser));

      // حفظ في Firestore إن أمكن
      if (window.SHURAK.db) {
        await window.SHURAK.db.collection("customers").doc(user.uid).set(currentUser, { merge: true });
      }
      updateAuthUI();
      alert("تم تسجيل الدخول بنجاح عبر Google");
      if (window.location.pathname.includes("account")) location.reload();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ في تسجيل الدخول: " + err.message);
    }
  } else {
    alert("Firebase غير جاهز. تأكد من تفعيل Authentication → Google في لوحة التحكم.");
  }
}

function logout() {
  if (window.SHURAK && window.SHURAK.auth) {
    window.SHURAK.auth.signOut().catch(() => {});
  }
  currentUser = null;
  localStorage.removeItem("shurak_user");
  updateAuthUI();
  if (window.location.pathname.includes("account") || window.location.pathname.includes("seller")) {
    window.location.href = "index.html";
  } else {
    location.reload();
  }
}

// مراقبة حالة المصادقة الحقيقية
if (window.SHURAK && window.SHURAK.auth) {
  window.SHURAK.auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        phone: currentUser?.phone || "",
        city: currentUser?.city || "",
        address: currentUser?.address || "",
        role: currentUser?.role || "user"
      };
      localStorage.setItem("shurak_user", JSON.stringify(currentUser));
    }
    updateAuthUI();
  });
}

// ========== المنتجات ==========
function renderCategories(containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(cat => `
    <div class="category-card" data-category="${cat.id}">
      <h3>${cat.name}</h3>
    </div>
  `).join("");

  grid.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      const cat = card.dataset.category;
      if (window.location.pathname.includes("products")) {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        const btn = document.querySelector(`.filter-btn[data-category="${cat}"]`);
        if (btn) btn.classList.add("active");
        filterProducts(cat);
      } else {
        window.location.href = `products.html?cat=${encodeURIComponent(cat)}`;
      }
    });
  });
}

function renderProducts(containerId, list) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  if (!list || list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>لا توجد منتجات حالياً</p></div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const imgHtml = p.imageUrl 
      ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" />`
      : `<div style="opacity:0.5;font-size:0.9rem">لا توجد صورة</div>`;
    return `
    <article class="product-card">
      <div class="product-image">${imgHtml}</div>
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description}</p>
        <div class="product-seller">البائع: ${p.sellerName || "تاجر"}</div>
        <div class="product-footer">
          <div class="product-price">${p.price} <span>ريال</span></div>
          <button class="btn-add" data-id="${p.id}">أضف للسلة</button>
        </div>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".btn-add").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id));
  });
}

function setupFilters() {
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get("cat");
  if (catParam) {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    const btn = document.querySelector(`.filter-btn[data-category="${catParam}"]`);
    if (btn) btn.classList.add("active");
    filterProducts(catParam);
  }

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterProducts(btn.dataset.category);
    });
  });
}

function filterProducts(category) {
  let list = products;
  if (category && category !== "all") {
    list = products.filter(p => p.category === category);
  }
  const search = document.getElementById("searchInput")?.value?.trim().toLowerCase() || "";
  if (search) {
    list = list.filter(p => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search));
  }
  renderProducts("productsGrid", list);
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("searchBtn");
  if (!input) return;
  const doSearch = () => {
    const active = document.querySelector(".filter-btn.active");
    filterProducts(active ? active.dataset.category : "all");
  };
  input.addEventListener("input", doSearch);
  if (btn) btn.addEventListener("click", doSearch);
}

// ========== السلة ==========
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  saveCart();
  updateCartBadge();
  // إشعار بسيط
  const btn = document.querySelector(`.btn-add[data-id="${productId}"]`);
  if (btn) {
    const old = btn.textContent;
    btn.textContent = "تمت الإضافة ";
    setTimeout(() => btn.textContent = old, 1200);
  }
}

function saveCart() {
  localStorage.setItem("shurak_cart", JSON.stringify(cart));
}

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function getCartTotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function renderCartPage() {
  const listEl = document.getElementById("cartItemsList");
  const totalEl = document.getElementById("cartTotal");
  const emptyEl = document.getElementById("emptyCart");
  const contentEl = document.getElementById("cartContent");

  if (!listEl) return;

  if (cart.length === 0) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (contentEl) contentEl.classList.add("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  if (contentEl) contentEl.classList.remove("hidden");

  listEl.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      <div class="cart-item-emoji">${item.emoji || ""}</div>
      <div class="cart-item-details">
        <h4>${item.name}</h4>
        <div class="price">${item.price} ريال × ${item.qty}</div>
        <div class="qty-controls">
          <button class="qty-btn" data-id="${item.id}" data-action="dec">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-id="${item.id}" data-action="inc">+</button>
          <button class="btn btn-ghost" style="color:var(--danger);font-size:0.85rem" data-id="${item.id}" data-action="remove">حذف</button>
        </div>
      </div>
    </div>
  `).join("");

  if (totalEl) totalEl.textContent = getCartTotal() + " ريال";

  listEl.querySelectorAll(".qty-btn, [data-action='remove']").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "remove") {
        cart = cart.filter(i => i.id !== id);
      } else {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        item.qty += action === "inc" ? 1 : -1;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
      }
      saveCart();
      updateCartBadge();
      renderCartPage();
    });
  });
}

function placeOrder() {
  if (cart.length === 0) return alert("السلة فارغة");
  if (!currentUser) {
    alert("يجب تسجيل الدخول أولاً");
    loginWithGoogle();
    return;
  }

  const payment = document.querySelector('input[name="payment"]:checked')?.value || "cod";
  const paymentLabels = {
    cod: "الدفع عند الاستلام",
    transfer: "تحويل بنكي",
    applepay: "Apple Pay"
  };

  const order = {
    id: "ORD-" + Date.now(),
    userId: currentUser.uid,
    userName: currentUser.name,
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    total: getCartTotal(),
    paymentMethod: payment,
    paymentLabel: paymentLabels[payment],
    status: "جديد",
    createdAt: new Date().toISOString()
  };

  // حفظ محلي + Firestore
  const orders = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
  orders.push(order);
  localStorage.setItem("shurak_orders", JSON.stringify(orders));

  if (window.SHURAK && window.SHURAK.db) {
    window.SHURAK.db.collection("orders").doc(order.id).set(order)
      .then(() => console.log("تم حفظ الطلب في Firestore"))
      .catch(err => console.error("خطأ حفظ الطلب:", err));
  }

  cart = [];
  saveCart();
  updateCartBadge();

  alert(`تم إنشاء الطلب بنجاح!\nرقم الطلب: ${order.id}\nطريقة الدفع: ${order.paymentLabel}\nالإجمالي: ${order.total} ريال`);
  window.location.href = "account.html";
}

// ========== حسابي ==========
function renderAccountPage() {
  if (!currentUser) {
    document.getElementById("accountGuest")?.classList.remove("hidden");
    document.getElementById("accountContent")?.classList.add("hidden");
    return;
  }
  document.getElementById("accountGuest")?.classList.add("hidden");
  document.getElementById("accountContent")?.classList.remove("hidden");

  const avatar = document.getElementById("accountAvatar");
  const name = document.getElementById("accountName");
  const email = document.getElementById("accountEmail");
  if (avatar) avatar.src = currentUser.photoURL || "";
  if (name) name.textContent = currentUser.name || "—";
  if (email) email.textContent = currentUser.email || "—";

  document.getElementById("userPhone").value = currentUser.phone || "";
  document.getElementById("userCity").value = currentUser.city || "";
  document.getElementById("userAddress").value = currentUser.address || "";

  // الطلبات
  const orders = JSON.parse(localStorage.getItem("shurak_orders") || "[]")
    .filter(o => o.userId === currentUser.uid)
    .reverse();
  const ordersEl = document.getElementById("userOrders");
  if (ordersEl) {
    if (orders.length === 0) {
      ordersEl.innerHTML = `<p class="empty-state">لا توجد طلبات بعد</p>`;
    } else {
      ordersEl.innerHTML = orders.map(o => `
        <div class="seller-product-item">
          <div>
            <strong>${o.id}</strong><br>
            <small>${o.paymentLabel} • ${new Date(o.createdAt).toLocaleDateString("ar-SA")}</small>
          </div>
          <div style="text-align:left">
            <strong>${o.total} ريال</strong><br>
            <span style="color:var(--primary-light)">${o.status}</span>
          </div>
        </div>
      `).join("");
    }
  }
}

function saveProfile() {
  if (!currentUser) return;
  currentUser.phone = document.getElementById("userPhone").value.trim();
  currentUser.city = document.getElementById("userCity").value.trim();
  currentUser.address = document.getElementById("userAddress").value.trim();
  localStorage.setItem("shurak_user", JSON.stringify(currentUser));
  alert("تم حفظ البيانات");
}

// ========== البائع (رفع المنتجات + الشروط) ==========
function renderSellerPage() {
  if (!currentUser) {
    document.getElementById("sellerGuest")?.classList.remove("hidden");
    document.getElementById("sellerContent")?.classList.add("hidden");
    return;
  }
  document.getElementById("sellerGuest")?.classList.add("hidden");
  document.getElementById("sellerContent")?.classList.remove("hidden");

  // منتجات هذا البائع
  const myProducts = products.filter(p => p.sellerId === currentUser.uid);
  const listEl = document.getElementById("myProductsList");
  if (listEl) {
    if (myProducts.length === 0) {
      listEl.innerHTML = `<p class="empty-state">لم تضف أي منتج بعد</p>`;
    } else {
      listEl.innerHTML = myProducts.map(p => `
        <div class="seller-product-item">
          <div>${p.emoji} <strong>${p.name}</strong> — ${p.price} ريال</div>
          <button class="btn btn-ghost" style="color:var(--danger)" data-id="${p.id}" onclick="deleteMyProduct('${p.id}')">حذف</button>
        </div>
      `).join("");
    }
  }
}

async function addProduct(e) {
  e.preventDefault();
  if (!currentUser) return alert("يجب تسجيل الدخول أولاً");

  const termsChecked = document.getElementById("acceptTerms")?.checked;
  if (!termsChecked) {
    alert("يجب الموافقة على الشروط والأحكام قبل إضافة المنتج");
    return;
  }

  const name = document.getElementById("prodName").value.trim();
  const description = document.getElementById("prodDesc").value.trim();
  const price = parseFloat(document.getElementById("prodPrice").value);
  const category = document.getElementById("prodCategory").value;
  const imageFile = document.getElementById("prodImage")?.files[0];

  if (!name || !description || !price || price <= 0) {
    alert("يرجى تعبئة جميع الحقول بشكل صحيح");
    return;
  }
  if (!imageFile) {
    alert("يجب رفع صورة للمنتج");
    return;
  }

  // تحقق من نوع وحجم الصورة
  if (!imageFile.type.startsWith("image/")) {
    alert("الملف يجب أن يكون صورة");
    return;
  }
  if (imageFile.size > 5 * 1024 * 1024) {
    alert("حجم الصورة يجب أن يكون أقل من 5 ميجا");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري الرفع...";
  }

  try {
    let imageUrl = "";

    // رفع الصورة إلى Firebase Storage
    if (window.SHURAK && window.SHURAK.storage) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `products/${currentUser.uid}/${Date.now()}.${ext}`;
      const ref = window.SHURAK.storage.ref().child(path);
      const snapshot = await ref.put(imageFile);
      imageUrl = await snapshot.ref.getDownloadURL();
    } else {
      // fallback: local preview (base64) - مؤقت فقط
      imageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(imageFile);
      });
    }

    const newProduct = {
      id: "p_" + Date.now(),
      name,
      description,
      price,
      category,
      imageUrl,
      sellerId: currentUser.uid,
      sellerName: currentUser.name || currentUser.displayName || "بائع",
      status: "available",
      createdAt: new Date().toISOString().slice(0, 10)
    };

    products.unshift(newProduct);
    localStorage.setItem("shurak_products", JSON.stringify(products));

    // حفظ في Firestore
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("products").doc(newProduct.id).set(newProduct);
    }

    document.getElementById("addProductForm").reset();
    const preview = document.getElementById("imagePreview");
    if (preview) preview.innerHTML = "";
    alert("تم إضافة المنتج بنجاح مع الصورة");
    renderSellerPage();
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء رفع المنتج: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "نشر المنتج";
    }
  }
}

function deleteMyProduct(id) {
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;
  products = products.filter(p => p.id !== id);
  localStorage.setItem("shurak_products", JSON.stringify(products));
  renderSellerPage();
}

// ========== أحداث عامة ==========
function bindGlobalEvents() {
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", loginWithGoogle);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const saveBtn = document.getElementById("saveProfileBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveProfile);

  const orderBtn = document.getElementById("placeOrderBtn");
  if (orderBtn) orderBtn.addEventListener("click", placeOrder);

  const form = document.getElementById("addProductForm");
  if (form) form.addEventListener("submit", addProduct);

  // اختيار طريقة الدفع
  document.querySelectorAll(".payment-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      opt.querySelector("input").checked = true;
    });
  });

  // معاينة صورة المنتج
  const imgInput = document.getElementById("prodImage");
  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const file = imgInput.files[0];
      const preview = document.getElementById("imagePreview");
      if (!preview) return;
      if (file) {
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${url}" style="max-width:180px;border-radius:10px;margin-top:8px" />`;
      } else {
        preview.innerHTML = "";
      }
    });
  }
}
