// ---- Firebase (modular v11) ----
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, deleteUser, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// ВАЖНО: добавь github-домен в Firebase → Auth → Settings → Authorized domains
const firebaseConfig = {
  apiKey: "AIzaSyBXZ1tN-J6vGZxVJL4BLND1XeiwT2T3OWQ",
  authDomain: "primedevices-5cdda.firebaseapp.com",
  projectId: "primedevices-5cdda",
  // Обычно тут appspot.com; но оставляю как у тебя в консоли:
  storageBucket: "primedevices-5cdda.firebasestorage.app",
  messagingSenderId: "563215884111",
  appId: "1:563215884111:web:e534e41afa4d4adad5ef3a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

// ---- Константы / состояние ----
const TELEGRAM_TOKEN = "8060002374:AAGZ1B6fQutNTMMS22wOkgCH_defGVS8KVE";
const TELEGRAM_CHAT_ID = "-4885330608";

let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let orderHistory = JSON.parse(localStorage.getItem("orderHistory") || "[]");
let reviews = JSON.parse(localStorage.getItem("reviews") || "[]");

let tempReviewPhoto = null;      // base64 превью фото отзыва
let tempAvatarFile = null;       // файл для аватара (ждём "Сохранить")

let currentPage = 1;
const perPage = 6;
let sortMode = "default";
let query = "";
let activeCategory = "all";

const fmt = n => n.toLocaleString("ru-RU");
const $ = id => document.getElementById(id);

// ---- Товары (пример) ----
const products = [
  {
    name: "AirPods Pro 2 (LUX)",
    category: "airpods",
    price: 600,
    img: "img/airpods-pro2-lux.png.png",
    specs: ["Активное шумоподавление (ANC)","Прозрачный режим","Bluetooth 5.3","До 6 часов автономной работы","Беспроводной кейс"],
    memory: [{ size: "Базовая комплектация", price: 600 }],
    colors: [{ name: "Белый", color: "#ffffff", img: "img/airpods-pro2-lux.png.png" }]
  },
  {
    name: "AirPods Pro 2 (Premium)",
    category: "airpods",
    price: 700,
    img: "img/airpods-pro2-lux.png.png",
    specs: ["Активное шумоподавление (ANC)","Динамический звук","Кейс с динамиком и креплением","Поддержка Find My","До 6 часов прослушивания"],
    memory: [{ size: "Базовая комплектация", price: 700 }],
    colors: [{ name: "Белый", color: "#ffffff", img: "img/airpods-pro2-lux.png.png" }]
  },
  {
    name: "AirPods 3",
    category: "airpods",
    price: 650,
    img: "img/airpods-3.png (2).png",
    specs: ["Динамический драйвер Apple","Поддержка пространственного звука","До 6 часов прослушивания","Влагозащита IPX4","Беспроводной кейс MagSafe"],
    memory: [{ size: "Базовая комплектация", price: 650 }],
    colors: [{ name: "Белый", color: "#ffffff", img: "img/airpods-3.png (2).png" }]
  }
];

// ---- UI helpers ----
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toastOut 0.4s ease forwards";
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function saveState() {
  localStorage.setItem("cart", JSON.stringify(cart));
  localStorage.setItem("favorites", JSON.stringify(favorites));
  localStorage.setItem("orderHistory", JSON.stringify(orderHistory));
}

// ---- Каталог/фильтрация/рендер ----
function getFiltered() {
  let list = products.slice();
  if (activeCategory !== "all") list = list.filter(p => p.category === activeCategory);
  if (query) list = list.filter(p => p.name.toLowerCase().includes(query));
  if (sortMode === "priceAsc") list.sort((a,b) => a.price - b.price);
  if (sortMode === "priceDesc") list.sort((a,b) => b.price - a.price);
  if (sortMode === "name") list.sort((a,b) => a.name.localeCompare(b.name, "ru"));
  return list;
}

function render() {
  const list = $("productList");
  list.classList.add("page-exit");
  setTimeout(() => {
    list.classList.remove("page-exit");
    list.innerHTML = "";
    const items = getFiltered();
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * perPage;
    const pageItems = items.slice(start, start + perPage);

    pageItems.forEach(p => {
      const idx = products.indexOf(p);
      const card = document.createElement("div");
      const favActive = favorites.find(f => f.name === p.name) ? "active" : "";
      card.className = "card";
      card.innerHTML = `
        <img src="${p.img}" alt="${p.name}" onclick="openProduct(${idx})">
        <h3>${p.name}</h3>
        <p class="price">${fmt(p.price)} MDL</p>
        <div style="display:flex;justify-content:center;gap:10px;">
          <button class="btn btn-primary" onclick="addToCart(${idx})">🧺 В корзину</button>
          <button class="btn-fav ${favActive}" onclick="addToFavorites(${idx})">⭐</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.classList.add("page-enter");
    requestAnimationFrame(() => {
      list.classList.add("page-enter-active");
      list.classList.remove("page-enter");
      setTimeout(() => list.classList.remove("page-enter-active"), 500);
    });

    renderPagination(totalPages);
  }, 200);
}

function renderPagination(total) {
  const box = $("pagination");
  box.innerHTML = "";
  for (let i=1; i<=total; i++) {
    const b = document.createElement("button");
    b.className = "page-btn" + (i === currentPage ? " active" : "");
    b.textContent = i;
    b.onclick = () => { currentPage = i; render(); };
    box.appendChild(b);
  }
}

// ---- Поиск/сортировка/категории ----
window.filterProducts = function() {
  query = $("searchInput").value.trim().toLowerCase();
  currentPage = 1;
  render();
};

(function initSort(){
  const dd = $("sortDropdown");
  const btn = $("sortBtn");
  const menu = $("sortMenu");
  btn.addEventListener("click", e => { e.stopPropagation(); dd.classList.toggle("open"); });
  menu.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      sortMode = b.dataset.sort;
      btn.textContent =
        sortMode === "priceAsc" ? "Цена ↑" :
        sortMode === "priceDesc" ? "Цена ↓" :
        sortMode === "name" ? "По названию" : "Сортировка ▾";
      dd.classList.remove("open");
      render();
    });
  });
  document.addEventListener("click", () => dd.classList.remove("open"));
})();

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.cat;
    currentPage = 1;
    render();
  });
});

// ---- Корзина / Избранное ----
window.toggleCart = function() {
  const o = $("cartOverlay");
  o.style.display = o.style.display === "flex" ? "none" : "flex";
  renderCart();
};
window.addToCart = function(i) {
  cart.push({ ...products[i] });
  $("cartCount").textContent = cart.length;
  renderCart();
  document.getElementById("cartBtn").classList.add("pulse");
  setTimeout(() => document.getElementById("cartBtn").classList.remove("pulse"), 400);
  saveState();
};
window.removeFromCart = function(i) {
  cart.splice(i,1);
  $("cartCount").textContent = cart.length;
  renderCart();
  saveState();
};
window.clearCart = function() {
  cart = [];
  $("cartCount").textContent = 0;
  renderCart();
  saveState();
};
function renderCart() {
  const box = $("cartItems");
  box.innerHTML = "";
  let total = 0;
  cart.forEach((p,i) => {
    total += p.price;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${p.img}" alt="">
      <div style="flex:1">
        <div style="font-weight:600">${p.displayName || p.name}</div>
        <div>${fmt(p.price)} MDL</div>
      </div>
      <button class="btn btn-danger" onclick="removeFromCart(${i})">✖</button>
    `;
    box.appendChild(row);
  });
  $("totalPrice").textContent = fmt(total);
}

window.toggleFavorites = function() {
  const overlay = $("favOverlay");
  overlay.style.display = overlay.style.display === "flex" ? "none" : "flex";
  renderFavorites();
};
window.addToFavorites = function(i) {
  const p = products[i];
  const existing = favorites.find(f => f.name === p.name);
  if (!existing) {
    favorites.push(p);
    showToast("💚 Товар добавлен в избранное!", "success");
  } else {
    favorites = favorites.filter(f => f.name !== p.name);
    showToast("💔 Удалён из избранного", "info");
  }
  $("favCount").textContent = favorites.length;
  render();
  saveState();
};
function renderFavorites() {
  const box = $("favItems");
  box.innerHTML = "";
  if (!favorites.length) {
    box.innerHTML = "<p>⭐ Пока нет избранных товаров.</p>";
    return;
  }
  favorites.forEach((p,i) => {
    const productIndex = products.findIndex(item => item.name === p.name);
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${p.img}" alt="${p.name}" onclick="openProduct(${productIndex})" style="cursor:pointer">
      <div style="flex:1;cursor:pointer" onclick="openProduct(${productIndex})">
        <div style="font-weight:600">${p.name}</div>
        <div>${fmt(p.price)} MDL</div>
      </div>
      <button class="btn btn-danger" onclick="removeFavorite(${i})">✖</button>
    `;
    box.appendChild(row);
  });
}
window.removeFavorite = function(i){
  favorites.splice(i,1);
  $("favCount").textContent = favorites.length;
  renderFavorites();
  render();
  saveState();
};

// ---- Карточка товара ----
let modalState = { index:null, colorIdx:0, memIdx:0 };

window.openProduct = function(i){
  modalState = { index:i, colorIdx:0, memIdx:0 };
  const p = products[i];
  $("modalTitle").textContent = p.name;
  $("modalSpecs").innerHTML = p.specs.map(s => `<li>• ${s}</li>`).join("");
  $("modalPrice").textContent = fmt(p.price) + " MDL";
  $("modalImg").src = p.img;

  const colorBox = $("colorOptions");
  colorBox.innerHTML = "";
  if (p.colors?.length) {
    p.colors.forEach((c,ci)=>{
      const chip = document.createElement("div");
      chip.className = "color-chip" + (ci===0 ? " active" : "");
      chip.style.backgroundColor = c.color;
      chip.title = c.name;
      chip.onclick = () => {
        colorBox.querySelectorAll(".color-chip").forEach(x => x.classList.remove("active"));
        chip.classList.add("active");
        modalState.colorIdx = ci;
        $("modalImg").src = c.img || p.img;
      };
      colorBox.appendChild(chip);
    });
  }

  const memBox = $("memoryOptions");
  memBox.innerHTML = "";
  const memory = p.memory?.length ? p.memory : [{ size:"Базовый", price:p.price }];
  memory.forEach((m,mi)=>{
    const b = document.createElement("button");
    b.className = "mem-btn" + (mi===0 ? " active" : "");
    b.textContent = m.size;
    b.onclick = () => {
      memBox.querySelectorAll(".mem-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      modalState.memIdx = mi;
      $("modalPrice").textContent = fmt(memory[mi].price) + " MDL";
    };
    memBox.appendChild(b);
  });

  $("modalAddToCart").onclick = () => {
    const c = p.colors?.[modalState.colorIdx];
    const m = memory[modalState.memIdx];
    const price = m.price ?? p.price;
    const name = `${p.name}${c ? ` (${c.name}` : ""}${m ? `${c ? ", " : " ("}${m.size}` : ""}${(c||m) ? ")" : ""}`;
    cart.push({ ...p, price, displayName:name, img:c?.img || p.img });
    $("cartCount").textContent = cart.length;
    renderCart();
    closeModal();
    showToast("✅ Товар добавлен в корзину!", "success");
    saveState();
  };

  const favBtn = $("modalAddToFav");
  const isFav = favorites.find(f => f.name === p.name);
  if (isFav) { favBtn.classList.add("active"); favBtn.textContent = "⭐ В избранном"; }
  else       { favBtn.classList.remove("active"); favBtn.textContent = "⭐ В избранное"; }

  $("productModal").style.display = "flex";
};
window.toggleModalFavorite = function(){
  const i = modalState.index;
  const p = products[i];
  const favBtn = $("modalAddToFav");
  const existing = favorites.find(f => f.name === p.name);
  if (!existing) {
    favorites.push(p);
    favBtn.classList.add("active");
    favBtn.textContent = "⭐ В избранном";
    showToast("💚 Добавлено в избранное!", "success");
  } else {
    favorites = favorites.filter(f => f.name !== p.name);
    favBtn.classList.remove("active");
    favBtn.textContent = "⭐ В избранное";
    showToast("💔 Удалено из избранного", "info");
  }
  $("favCount").textContent = favorites.length;
  render();
  saveState();
};
window.closeModal = function(){ $("productModal").style.display = "none"; };
window.placeOrder = function(){ if (!cart.length) return showToast("🛒 Корзина пуста!", "info"); $("orderOverlay").style.display = "flex"; };
window.closeOrder = function(){ $("orderOverlay").style.display = "none"; };
window.overlayClick = function(e){ if (e.target.classList.contains("overlay")) e.target.style.display = "none"; };

// ---- Домой / страницы / меню ----
window.goHome = function(){
  document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none');
  query = ""; sortMode = "default"; activeCategory = "all";
  $("searchInput").value = ""; currentPage = 1;
  render(); window.scrollTo({top:0, behavior:"smooth"});
  showToast("🏠 Возврат на главную страницу","info");
};
window.showPage = function(page){
  const main = document.querySelector("main");
  const catalog = document.querySelector(".catalog");
  const headerBottom = document.querySelector(".header-bottom");
  const searchWrap = document.querySelector(".search-wrap");

  document.querySelectorAll(".page").forEach(p => p.style.display = "none");

  if (page === "shop") {
    if (main) main.style.display = "block";
    if (catalog) catalog.style.display = "flex";
    if (headerBottom) headerBottom.style.display = "flex";
    if (searchWrap) searchWrap.style.display = "flex";
  } else {
    if (main) main.style.display = "none";
    if (catalog) catalog.style.display = "none";
    if (headerBottom) headerBottom.style.display = "none";
    if (searchWrap) searchWrap.style.display = "none";
  }

  const target = document.getElementById(`page-${page}`);
  if (target) target.style.display = "block";

  if (page === "orders") renderOrders();
  if (page === "reviews") renderReviews();

  window.scrollTo({ top: 0, behavior: "smooth" });
};
window.toggleMenu = function(){
  document.querySelector('.top-nav').classList.toggle('active');
};

// ---- Тема ----
document.addEventListener("DOMContentLoaded", () => {
  const themeBtn = $("themeToggle");
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") { root.classList.add("light-theme"); themeBtn.textContent = "🌞"; }
  else themeBtn.textContent = "🌙";

  themeBtn.addEventListener("click", () => {
    root.classList.toggle("light-theme");
    const isLight = root.classList.contains("light-theme");
    themeBtn.textContent = isLight ? "🌞" : "🌙";
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
});

// ---- История заказов ----
function saveOrderHistory(){ localStorage.setItem("orderHistory", JSON.stringify(orderHistory)); }
function renderOrders(){
  const box = $("ordersList");
  box.innerHTML = "";
  if (!orderHistory.length) { box.innerHTML = "<p>Пока нет оформленных заказов 🛍</p>"; return; }
  orderHistory.slice().reverse().forEach((order,i)=>{
    const div = document.createElement("div");
    div.className = "order-card";
    const items = order.items.map(x => `• ${x}`).join("<br>");
    div.innerHTML = `
      <h3>Заказ №${i + 1}</h3>
      <p><b>Дата:</b> ${order.date}</p>
      <p><b>Имя:</b> ${order.name}</p>
      <p><b>Телефон:</b> ${order.phone}</p>
      <p><b>Товары:</b><br>${items}</p>
      <p><b>Сумма:</b> ${order.total} MDL</p>
    `;
    box.appendChild(div);
  });
}

// ---- Оформление заказа (Telegram) ----
window.sendOrder = async function() {
  const user = auth.currentUser;
  const name = $("orderName").value.trim();
  const phone = $("orderPhone").value.trim();
  const comment = $("orderComment").value.trim();

  if (!user) {
    $("cartOverlay").style.display = "none";
    $("orderOverlay").style.display = "none";
    showToast("🔒 Войдите в аккаунт, чтобы оформить заказ!", "error");
    showPage("account");
    return;
  }
  if (!name || !phone) return showToast("⚠️ Введите имя и телефон!", "error");
 // ✅ Проверка корректного телефона Молдовы (+373 и 8 цифр)
const phoneRegex = /^\+373(6|7|8)\d{7}$/;
if (!phoneRegex.test(phone)) {
  return showToast("📞 Введите корректный номер Молдовы в формате +373XXXXXXXX", "error");
}


  if (!cart.length) return showToast("🛒 Корзина пуста!", "info");

  const itemsText = cart.map((p,i)=>`${i+1}. ${p.displayName || p.name} — ${fmt(p.price)} MDL`).join("\n");
  const text = `
🧾 <b>Новый заказ PrimeDevices.pmr</b>
👤 Имя: ${name}
📞 Телефон: ${phone}
💬 Комментарий: ${comment || "—"}
━━━━━━━━━━━━━━━
${itemsText}
━━━━━━━━━━━━━━━
💰 Итого: ${$("totalPrice").textContent} MDL
`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode:"HTML" })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const orderData = {
        date: new Date().toLocaleString(),
        name, phone, comment,
        items: cart.map(p => p.displayName || p.name),
        total: $("totalPrice").textContent
      };
      orderHistory.push(orderData);
      saveOrderHistory();

      showToast("✅ Заказ успешно отправлен!", "success");
      $("orderOverlay").style.display = "none";
      cart = []; $("cartCount").textContent = 0;
      renderCart(); saveState();
    } else {
      console.error("Ошибка Telegram:", data);
      showToast("⚠️ Ошибка при отправке заказа!", "error");
    }
  } catch (err) {
    console.error("Ошибка сети:", err);
    showToast("⚠️ Ошибка сети при отправке!", "error");
  }
};

// ---- Отзывы ----
window.previewReviewPhoto = function(e){
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    tempReviewPhoto = ev.target.result;
    $("reviewPreview").innerHTML = `
      <img src="${tempReviewPhoto}" alt="Фото отзыва"
           style="max-width:150px; border-radius:10px; margin-top:8px; border:2px solid var(--accent);">
    `;
  };
  reader.readAsDataURL(file);
};

window.addReview = function(){
  const user = auth.currentUser;
  const name = $("reviewName").value.trim();
  const text = $("reviewText").value.trim();

  if (!name || !text) return showToast("⚠️ Заполните имя и текст!", "error");
  if (!user) {
    showToast("🔒 Войдите в аккаунт, чтобы оставить отзыв!", "error");
    showPage("account");
    return;
  }

  const newReview = {
    name,
    text,
    email: user.email,
    date: new Date().toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }),
    photo: tempReviewPhoto || null
  };

  reviews.push(newReview);
  localStorage.setItem("reviews", JSON.stringify(reviews));

  $("reviewName").value = "";
  $("reviewText").value = "";
  $("reviewPhoto").value = "";
  $("reviewPreview").innerHTML = "";
  tempReviewPhoto = null;

  showToast("✅ Спасибо за отзыв!", "success");
  renderReviews();
};

function renderReviews(){
  const box = $("reviewsList");
  box.innerHTML = "";
  if (!reviews.length) { box.innerHTML = "<p>Пока нет отзывов. Будьте первым, кто поделится впечатлением! 🌟</p>"; return; }
  const user = auth.currentUser;
  reviews.forEach((r,i) => {
    const card = document.createElement("div");
    card.className = "review-card";
    const canDelete = user && user.email === r.email;
    const del = canDelete ? `<button class="btn btn-danger" style="margin-top:10px;" onclick="deleteReview(${i})">🗑 Удалить</button>` : "";
    card.innerHTML = `
      <p><b>${r.name}</b> <span style="opacity:0.7;">(${r.date})</span></p>
      <p>${r.text}</p>
      ${r.photo ? `<img src="${r.photo}" alt="Фото отзыва"
         style="max-width:150px; border-radius:10px; margin-top:8px; border:2px solid var(--accent);">` : ""}
      ${del}
    `;
    box.prepend(card);
  });
}
window.deleteReview = function(index){
  const user = auth.currentUser;
  if (!user) return showToast("⚠️ Вы не вошли в аккаунт!", "error");
  const review = reviews[index];
  if (review.email !== user.email) return showToast("🚫 Можно удалить только свой отзыв!", "error");
  if (!confirm("Удалить этот отзыв?")) return;
  reviews.splice(index,1);
  localStorage.setItem("reviews", JSON.stringify(reviews));
  showToast("🗑 Отзыв удалён!", "success");
  renderReviews();
};

// ---- Аккаунт (Firebase Auth) ----
window.toggleAuth = function(mode){
  $("loginBox").style.display = mode === "register" ? "none" : "block";
  $("registerBox").style.display = mode === "register" ? "block" : "none";
};

window.registerUser = async function(){
  const email = $("regEmail").value.trim();
  const pass = $("regPass").value.trim();
  const name = $("regName").value.trim();
  if (!email || !pass) return showToast("⚠️ Укажите email и пароль", "error");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    showToast("✅ Аккаунт создан! Теперь вы вошли.", "success");
  } catch (err) {
    alert("Ошибка: " + err.message);
  }
};

window.loginUser = async function(){
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value.trim();
  if (!email || !pass) return showToast("⚠️ Укажите email и пароль", "error");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("✅ Вход выполнен!", "success");
  } catch (err) {
    alert("Ошибка: " + err.message);
  }
};

window.logoutUser = async function(){
  await signOut(auth);
  showToast("🚪 Вы вышли из аккаунта", "info");
};

window.deleteAccount = async function(){
  if (!confirm("Удалить аккаунт навсегда?")) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteUser(user);
    showToast("Аккаунт удалён", "success");
  } catch (e) {
    alert("Ошибка удаления: " + e.message);
  }
};

// Редактирование профиля
window.toggleEdit = function(){
  const box = $("editProfileBox");
  box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
};
window.cancelEdit = function(){
  $("editProfileBox").style.display = "none";
  tempAvatarFile = null;
};
window.changeAvatar = function(e){
  const file = e.target.files[0];
  if (!file) return;
  tempAvatarFile = file; // только сохраняем во временную переменную
  const reader = new FileReader();
  reader.onload = ev => { $("userAvatar").src = ev.target.result; };
  reader.readAsDataURL(file);
  showToast("📷 Фото выбрано. Нажмите «Сохранить».", "info");
};

window.saveProfile = async function(){
  const user = auth.currentUser;
  if (!user) return showToast("⚠️ Вы не вошли!", "error");

  const newName = $("editName").value.trim();
  let changed = false;

  try {
    // 1) Если выбран новый аватар, грузим в Firebase Storage
    if (tempAvatarFile) {
      const ext = (tempAvatarFile.name.split(".").pop() || "jpg").toLowerCase();
      const ref = storageRef(storage, `avatars/${user.uid}.${ext}`);
      await uploadBytes(ref, tempAvatarFile);
      const url = await getDownloadURL(ref);
      await updateProfile(user, { photoURL: url });
      tempAvatarFile = null;
      changed = true;
    }

    // 2) Если указано новое имя — сохраняем
    if (newName) {
      await updateProfile(user, { displayName: newName });
      changed = true;
    }

    if (changed) {
      showToast("✅ Изменения сохранены!");
      $("editProfileBox").style.display = "none";
      refreshUserPanel(); // обновить UI
    } else {
      showToast("⚠️ Нечего сохранять", "error");
    }
  } catch (e) {
    alert("Ошибка сохранения профиля: " + e.message);
  }
};

// Обновление UI панели пользователя
function refreshUserPanel(){
  const user = auth.currentUser;
  if (!user) return;

  const name = user.displayName || (user.email ? user.email.split("@")[0] : "Пользователь");
  $("userName").textContent = name;

  if (user.photoURL) {
    $("userAvatar").src = user.photoURL;
  } else {
    const letter = name.charAt(0).toUpperCase();
    $("userAvatar").src = `https://dummyimage.com/200x200/1c79ff/ffffff&text=${letter}`;
  }
}

// Отслеживание состояния входа
onAuthStateChanged(auth, (user) => {
  const loginBox = $("loginBox");
  const registerBox = $("registerBox");
  const userPanel = $("userPanel");

  if (user) {
    loginBox.style.display = "none";
    registerBox.style.display = "none";
    userPanel.style.display = "block";
    refreshUserPanel();
  } else {
    loginBox.style.display = "block";
    registerBox.style.display = "none";
    userPanel.style.display = "none";
  }
  // при входе/выходе обновим список отзывов, чтобы права удаления были корректные
  if (document.getElementById("page-reviews").style.display === "block") {
    renderReviews();
  }
});

// ---- DOM ready ----
document.addEventListener("DOMContentLoaded", () => {
  $("cartCount").textContent = cart.length;
  $("favCount").textContent = favorites.length;

  render();
  showPage("shop");

  // закрытие бургера по клику вне
  const nav = document.querySelector('.top-nav');
  const burger = document.querySelector('.burger');
  document.querySelectorAll('.top-nav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => nav.classList.remove('active'));
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !burger.contains(e.target)) {
      nav.classList.remove('active');
    }
  });

  // сразу отрисуем отзывы, если страница открыта
  renderReviews();
});

// === Анимированный фон с цветными каплями ===
const canvas = document.getElementById("bubbles");
const ctx = canvas.getContext("2d");
let drops = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// создаём капли
for (let i = 0; i < 25; i++) {
  drops.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 200 + 80,
    dx: (Math.random() - 0.5) * 0.4,
    dy: (Math.random() - 0.5) * 0.4,
    color: `hsl(${Math.random() * 360}, 80%, 60%)`
  });
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drops.forEach(d => {
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(d.x, d.y, d.r * 0.2, d.x, d.y, d.r);
    gradient.addColorStop(0, d.color);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fill();

    d.x += d.dx;
    d.y += d.dy;

    // отражение от краёв
    if (d.x - d.r < 0 || d.x + d.r > canvas.width) d.dx *= -1;
    if (d.y - d.r < 0 || d.y + d.r > canvas.height) d.dy *= -1;
  });

  requestAnimationFrame(animate);
}
animate();

