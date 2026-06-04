const menuData = [
    { id: 1, name: '凉拌黄瓜', price: 18, desc: '爽脆可口，蒜香扑鼻，开胃首选', category: '凉菜', emoji: '🥒' },
    { id: 2, name: '口水鸡', price: 28, desc: '麻辣鲜香，红油浸润，回味无穷', category: '凉菜', emoji: '🐔' },
    { id: 3, name: '蒜泥白肉', price: 32, desc: '薄切五花，蒜香浓郁，经典川味', category: '凉菜', emoji: '🥩' },
    { id: 4, name: '皮蛋豆腐', price: 22, desc: '嫩滑豆腐配松花蛋，清爽宜人', category: '凉菜', emoji: '🥚' },
    { id: 5, name: '宫保鸡丁', price: 38, desc: '花生与鸡丁的经典碰撞，麻辣鲜甜', category: '热菜', emoji: '🌶️' },
    { id: 6, name: '麻婆豆腐', price: 28, desc: '麻辣鲜香嫩烫酥，川菜灵魂之作', category: '热菜', emoji: '🫘' },
    { id: 7, name: '红烧肉', price: 48, desc: '肥而不腻，入口即化，浓油赤酱', category: '热菜', emoji: '🍖' },
    { id: 8, name: '鱼香肉丝', price: 36, desc: '酸甜微辣，鱼香四溢，下饭神器', category: '热菜', emoji: '🥢' },
    { id: 9, name: '清蒸鲈鱼', price: 68, desc: '鲜活鲈鱼清蒸，保留原汁原味', category: '热菜', emoji: '🐟' },
    { id: 10, name: '糖醋里脊', price: 42, desc: '外酥里嫩，酸甜可口，老少皆宜', category: '热菜', emoji: '🍗' },
    { id: 11, name: '米饭', price: 3, desc: '东北珍珠米，粒粒饱满', category: '主食', emoji: '🍚' },
    { id: 12, name: '蛋炒饭', price: 18, desc: '金包银蛋炒饭，粒粒分明', category: '主食', emoji: '🍛' },
    { id: 13, name: '担担面', price: 22, desc: '芝麻酱香浓郁，麻辣鲜香', category: '主食', emoji: '🍜' },
    { id: 14, name: '水饺', price: 28, desc: '手工现包，皮薄馅大，鲜美多汁', category: '主食', emoji: '🥟' },
    { id: 15, name: '可乐', price: 8, desc: '冰镇可口可乐，畅爽怡神', category: '饮品', emoji: '🥤' },
    { id: 16, name: '雪碧', price: 8, desc: '清爽柠檬味，冰凉透心', category: '饮品', emoji: '🥤' },
    { id: 17, name: '酸梅汤', price: 12, desc: '古法熬制，酸甜解腻', category: '饮品', emoji: '🧉' },
    { id: 18, name: '青岛啤酒', price: 15, desc: '冰镇青岛纯生，麦香浓郁', category: '饮品', emoji: '🍺' },
    { id: 19, name: '西红柿蛋汤', price: 18, desc: '酸甜开胃，家常味道', category: '汤品', emoji: '🍅' },
    { id: 20, name: '紫菜蛋花汤', price: 15, desc: '清淡鲜美，暖胃舒心', category: '汤品', emoji: '🌊' },
    { id: 21, name: '酸辣汤', price: 20, desc: '酸辣浓郁，暖身驱寒', category: '汤品', emoji: '🥣' },
];

let cart = [];
let currentCategory = 'all';
function renderMenu() {
    const grid = document.getElementById('menuGrid');
    const filtered = currentCategory === 'all'
        ? menuData
        : menuData.filter(item => item.category === currentCategory);

    grid.innerHTML = filtered.map(item => `
        <div class="menu-item" data-id="${item.id}">
            <div class="menu-item-img">${item.emoji}</div>
            <div class="menu-item-body">
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-desc">${item.desc}</div>
                <div class="menu-item-footer">
                    <span class="menu-item-price">${item.price}</span>
                    <button class="add-btn" data-id="${item.id}" aria-label="添加${item.name}">+</button>
                </div>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(parseInt(btn.dataset.id));
        });
    });
}
function setupCategories() {
    const btns = document.querySelectorAll('.category-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            renderMenu();
        });
    });
}

function addToCart(id) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        const menuItem = menuData.find(item => item.id === id);
        cart.push({ ...menuItem, qty: 1 });
    }
    updateCartUI();
    showToast(`${menuData.find(i => i.id === id).name} 已添加到购物车`);
    animateBadge();
}

function removeFromCart(id) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.qty > 1) {
            existing.qty -= 1;
        } else {
            cart = cart.filter(item => item.id !== id);
        }
    }
    updateCartUI();
}

function deleteFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

function getTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getItemCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}
function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const count = getItemCount();
    badge.textContent = count;

    const items = document.getElementById('cartItems');
    if (cart.length === 0) {
        items.innerHTML = `
            <div class="cart-empty">
                <span class="cart-empty-icon">🛒</span>
                <p>购物车是空的</p>
                <span class="cart-empty-sub">快去添加美食吧</span>
            </div>
        `;
    } else {
        items.innerHTML = cart.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-emoji">${item.emoji}</div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">¥${(item.price * item.qty).toFixed(2)}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
                    <span class="cart-item-qty">${item.qty}</span>
                    <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
                </div>
            </div>
        `).join('');

        items.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (btn.dataset.action === 'inc') {
                    addToCart(id);
                } else {
                    removeFromCart(id);
                }
            });
        });
    }

    document.getElementById('totalPrice').textContent = '¥' + getTotal().toFixed(2);
    document.getElementById('checkoutBtn').disabled = cart.length === 0;
}

function animateBadge() {
    const badge = document.getElementById('cartBadge');
    badge.classList.add('pop');
    setTimeout(() => badge.classList.remove('pop'), 200);
}

function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._hide);
    toast._hide = setTimeout(() => toast.classList.remove('show'), 2000);
}
function setupCart() {
    const toggle = document.getElementById('cartToggle');
    const close = document.getElementById('cartClose');
    const overlay = document.getElementById('cartOverlay');
    const sidebar = document.getElementById('cartSidebar');

    function openCart() {
        overlay.classList.add('open');
        sidebar.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        overlay.classList.remove('open');
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
    }

    toggle.addEventListener('click', openCart);
    close.addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCart();
    });
}

function setupCheckout() {
    const btn = document.getElementById('checkoutBtn');
    const modal = document.getElementById('orderModal');
    const close = document.getElementById('modalClose');
    const orderId = document.getElementById('orderId');

    btn.addEventListener('click', () => {
        if (cart.length === 0) return;
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
        orderId.textContent = '#' + dateStr + '-' + seq;
        modal.classList.add('open');
    });

    function resetAfterOrder() {
        modal.classList.remove('open');
        cart = [];
        updateCartUI();
        document.getElementById('cartOverlay').classList.remove('open');
        document.getElementById('cartSidebar').classList.remove('open');
        document.body.style.overflow = '';
        showToast('🎉 下单成功，感谢您的光临!');
    }

    close.addEventListener('click', resetAfterOrder);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) resetAfterOrder();
    });
}

renderMenu();
setupCategories();
setupCart();
setupCheckout();
updateCartUI();
