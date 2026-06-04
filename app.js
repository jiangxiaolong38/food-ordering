const SUPABASE_URL = 'https://script.google.com/macros/s/AKfycbwDN5zrgaCzGPPT1vFLo82KjJu8BM6lI8vmNMaBk9L-lvz8rM36c2jrk-nN22az0w8o/exec;
const SUPABASE_KEY = 'sb_publishable_aK-yvjqXxVe4DS5Gr6X8iA_IO_LZuKX';

const _realFetch = window.fetch;
const customFetch = function(url, options) {
    url = url.toString();
    options = options || {};
    var method = options.method;
    if ((method === 'PATCH' || method === 'DELETE') && url.includes('script.google.com')) {
        options.method = 'POST';
        var sep = url.includes('?') ? '&' : '?';
        url = url + sep + '_method=' + method;
    }
    return _realFetch(url, options);
};const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: customFetch } });

let currentUser = null;
let currentBatch = null;
let adminAuthed = false;

// ===== NAVIGATION =====
document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-' + btn.dataset.view).classList.remove('hidden');
        if (btn.dataset.view === 'order') loadOrderView();
        if (btn.dataset.view === 'history') loadHistoryView();
        if (btn.dataset.view === 'admin') loadAdminView();
    });
});

// ===== TOAST =====
function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== NAME MEMORY =====
function getSavedNames() { try { return JSON.parse(localStorage.getItem('breakfast_names') || '[]'); } catch(e) { return []; } }
function saveName(name) {
    let names = getSavedNames().filter(n => n !== name);
    names.unshift(name);
    if (names.length > 50) names = names.slice(0, 50);
    localStorage.setItem('breakfast_names', JSON.stringify(names));
}
function updateNameDatalists() {
    const names = getSavedNames();
    [document.getElementById('nameList'), document.getElementById('nameList2')].forEach(dl => {
        if (!dl) return;
        dl.innerHTML = names.map(n => '<option value="' + n + '">').join('');
    });
}

// ===== ORDER VIEW =====
async function loadOrderView() {
    updateNameDatalists();
    await loadCurrentBatch();
    if (currentBatch) await loadFoodGrid();
}

async function loadCurrentBatch() {
    const info = document.getElementById('batchInfo');
    try {
        const { data, error } = await supabase.from('purchase_batches').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
            currentBatch = data[0];
            const typeLabel = currentBatch.batch_type === 'wednesday' ? '闁告稏鍔嬬粭渚€骞嶇憴鍕靛仹' : '闁告稏鍔岄崣姘跺箥鐟欏嫷鍋?;
            document.getElementById('batchStatus').textContent = typeLabel + ' 鐠?濠靛鍋呮慨銈嗘交濞戞粠鏀藉☉?;
            document.getElementById('batchStatus').className = 'batch-status open';
            document.getElementById('batchLabel').textContent = typeLabel;
            document.getElementById('batchLimit').textContent = currentBatch.limit_amount.toFixed(0) + ' 闁?;
            document.getElementById('orderActions').style.display = 'flex';
            document.getElementById('statusBar').textContent = '';
        } else {
            currentBatch = null;
            document.getElementById('batchStatus').textContent = '鐟滅増鎸告晶鐘测柦閳╁啯绠掔€殿喒鍋撻柡鈧崜褎鐣遍梺鎻掓穿閸犳﹢骞嶇憴鍕靛仹';
            document.getElementById('batchStatus').className = 'batch-status closed';
            document.getElementById('batchLabel').textContent = '--';
            document.getElementById('batchLimit').textContent = '--';
            document.getElementById('batchUsed').textContent = '--';
            document.getElementById('orderActions').style.display = 'none';
            document.getElementById('foodGrid').innerHTML = '';
        }
    } catch(e) {
        console.error(e);
        document.getElementById('batchStatus').textContent = '闁告梻濮惧ù鍥ㄥ緞鏉堫偉袝: ' + e.message;
    }
}

async function loadFoodGrid() {
    const grid = document.getElementById('foodGrid');
    grid.innerHTML = '<div class="loading">闁告梻濮惧ù鍥槹閻旈攱鎯傞柛鎺擃殙閵?..</div>';
    const { data, error } = await supabase.from('food_items').select('*').order('sort_order');
    if (error) { grid.innerHTML = '<div class="loading">闁告梻濮惧ù鍥ㄥ緞鏉堫偉袝</div>'; return; }
    const foodItems = data || [];
    let html = '';
    const categories = [...new Set(foodItems.map(f => f.category))];
    categories.forEach(cat => {
        html += '<div style="grid-column:1/-1;font-size:13px;font-weight:600;color:var(--muted);padding:8px 0 0;text-transform:uppercase;letter-spacing:1px">' + cat + '</div>';
        foodItems.filter(f => f.category === cat).forEach(item => {
            const cls = item.active ? 'food-item' : 'food-item inactive';
            html += '<div class="' + cls + '" data-id="' + item.id + '"><div class="food-info"><div class="food-name">' + item.name + '</div><div class="food-price">' + Number(item.price).toFixed(2) + ' Rub</div></div><input type="number" class="food-qty" min="0" max="99" value="0" data-id="' + item.id + '" data-price="' + item.price + '"></div>';
        });
    });
    grid.innerHTML = html;
    grid.querySelectorAll('.food-qty').forEach(input => {
        input.addEventListener('input', () => recalcBudget());
    });
    await loadUserOrder();
}

async function loadUserOrder() {
    if (!currentBatch || !currentUser) return;
    const { data, error } = await supabase.from('orders').select('food_item_id, quantity').eq('batch_id', currentBatch.id).eq('user_id', currentUser.id);
    if (error || !data) return;
    data.forEach(row => {
        const input = document.querySelector('.food-qty[data-id="' + row.food_item_id + '"]');
        if (input) input.value = row.quantity;
    });
    recalcBudget();
}

function recalcBudget() {
    if (!currentBatch) return;
    let total = 0;
    document.querySelectorAll('.food-qty').forEach(input => {
        const qty = parseInt(input.value) || 0;
        total += qty * parseFloat(input.dataset.price);
    });
    document.getElementById('batchUsed').textContent = total.toFixed(2) + ' Rub';
    const remaining = currentBatch.limit_amount - total;
    const label = document.getElementById('budgetLabel');
    label.textContent = '闁告挴鏅欑紞鎴烇紣閸曨厾鏆? ' + remaining.toFixed(2) + ' Rub';
    label.className = remaining < 0 ? 'budget-label over' : 'budget-label';
    document.getElementById('submitBtn').disabled = !currentUser;
    if (remaining < 0) {
        document.getElementById('statusBar').textContent = '鐎规瓕灏粔鎾礄濞差亝顎欏Λ鐗堢箰缁辨繄鎷犲畡鏉挎閻忓繑鍨堕弳鐔兼煂?;
        document.getElementById('statusBar').style.color = 'var(--red)';
    } else {
        document.getElementById('statusBar').textContent = '';
    }
}

document.getElementById('orderName').addEventListener('input', async function() {
    const name = this.value.trim();
    if (!name) { currentUser = null; recalcBudget(); return; }
    const { data, error } = await supabase.from('users').select('id').eq('name', name).limit(1);
    if (data && data.length > 0) {
        currentUser = data[0];
    } else {
        const { data: inserted, error: insErr } = await supabase.from('users').insert({ name }).select('id').single();
        if (inserted) currentUser = inserted;
    }
    saveName(name);
    updateNameDatalists();
    await loadUserOrder();
    recalcBudget();
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    if (!currentBatch || !currentUser) return toast('閻犲洤鍢查崢娑㈡焻婢跺顏ュ┑顔芥尭閹?);
    let total = 0;
    const orders = [];
    document.querySelectorAll('.food-qty').forEach(input => {
        const qty = parseInt(input.value) || 0;
        total += qty * parseFloat(input.dataset.price);
        orders.push({ batch_id: currentBatch.id, user_id: currentUser.id, food_item_id: parseInt(input.dataset.id), quantity: qty });
    });
    if (total > currentBatch.limit_amount) return toast('閻℃帒鎳庨崵顓㈡⒔閹伴偊鏉洪柨娑樼焷椤曨剛鎷崘鈺傛闁轰椒鍗抽崳?);
    try {
        const upsertData = orders.map(o => ({ batch_id: o.batch_id, user_id: o.user_id, food_item_id: o.food_item_id, quantity: o.quantity }));
        const { error } = await supabase.from('orders').upsert(upsertData, { onConflict: 'batch_id, user_id, food_item_id' });
        if (error) throw error;
        toast('閻犱降鍨瑰畷鐔奉啅閸欏绲瑰ù?');
    } catch(e) { toast('闁圭粯鍔掑锔藉緞鏉堫偉袝: ' + e.message); }
});

// ===== HISTORY VIEW =====
function loadHistoryView() {
    updateNameDatalists();
    document.getElementById('historyContent').innerHTML = '閻犲洨鍏橀埀顒€顦扮€氥劍鎱ㄩ幘铏€抽柡灞诲劤濠€鍛村储閸℃钑夐悹浣靛灩瀹?;
}

document.getElementById('historyName').addEventListener('input', async function() {
    const name = this.value.trim();
    if (!name) { document.getElementById('historyContent').innerHTML = '閻犲洨鍏橀埀顒€顦扮€氥劍鎱ㄩ幘铏€抽柡灞诲劤濠€鍛村储閸℃钑夐悹浣靛灩瀹?; return; }
    const { data: userData } = await supabase.from('users').select('id').eq('name', name).limit(1);
    if (!userData || userData.length === 0) { document.getElementById('historyContent').innerHTML = '闁哄牜浜濇竟姗€宕氶幏宀婂殙闁活潿鍔嶉崺?; return; }
    const userId = userData[0].id;
    saveName(name); updateNameDatalists();
    const { data: batches } = await supabase.from('purchase_batches').select('*').order('order_date', { ascending: false });
    const { data: orders } = await supabase.from('orders').select('*, food_items(name, price)').eq('user_id', userId);
    const { data: foodItems } = await supabase.from('food_items').select('*');
    if (!batches || !orders) return;
    let html = '';
    batches.forEach(batch => {
        const batchOrders = orders.filter(o => o.batch_id === batch.id && o.quantity > 0);
        if (batchOrders.length === 0) return;
        const typeLabel = batch.batch_type === 'wednesday' ? '闁告稏鍔嬬粭? : '闁告稏鍔岄崣?;
        const statusLabel = batch.status === 'closed' ? '鐎圭寮堕崺鍛潰? : (batch.status === 'open' ? '閺夆晜绋栭、鎴炵▔? : '鐎垫澘鎳庣槐鎴﹀触?);
        let batchTotal = 0;
        html += '<div class="batch-section"><h3>' + batch.order_date + ' 鐠?' + typeLabel + '闁逛絻顫夐?鐠?' + statusLabel + '</h3><table class="history-table"><tr><th>濡炲鍠庨幖?/th><th>闁告娲戦悳?/th><th>闁轰椒鍗抽崳?/th><th>閻忓繐绻楅?/th></tr>';
        batchOrders.forEach(o => {
            const fi = o.food_items || {};
            const subtotal = (fi.price || 0) * o.quantity;
            batchTotal += subtotal;
            html += '<tr><td>' + (fi.name || '--') + '</td><td>' + Number(fi.price || 0).toFixed(2) + '</td><td>' + o.quantity + '</td><td>' + subtotal.toFixed(2) + '</td></tr>';
        });
        html += '<tr class="total-row"><td colspan="3">闁告艾鐗愰?/td><td>' + batchTotal.toFixed(2) + ' Rub</td></tr></table></div>';
    });
    document.getElementById('historyContent').innerHTML = html || '闁哄棗鍊瑰Λ銈囨媼閵忕姴绀嬮悹浣规緲缂?;
});

// ===== ADMIN VIEW =====
function loadAdminView() {
    if (adminAuthed) { showAdminPanel(); return; }
    document.getElementById('adminGate').style.display = '';
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminError').style.display = 'none';
}

document.getElementById('adminLoginBtn').addEventListener('click', async () => {
    const pw = document.getElementById('adminPassword').value;
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'admin_password').single();
    if (error || !data) { document.getElementById('adminError').textContent = '濡ょ姴鐭侀惁澶嬪緞鏉堫偉袝'; document.getElementById('adminError').style.display = ''; return; }
    if (data.value === pw) { adminAuthed = true; showAdminPanel(); }
    else { document.getElementById('adminError').textContent = '閻庨潧妫涢悥婊堟煥濞嗘帩鍤?; document.getElementById('adminError').style.display = ''; }
});

document.getElementById('adminPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('adminLoginBtn').click(); });

function showAdminPanel() {
    document.getElementById('adminGate').style.display = 'none';
    document.getElementById('adminPanel').classList.remove('hidden');
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelector('.admin-tab[data-admin="food"]').classList.add('active');
    document.getElementById('adminFood').classList.remove('hidden');
    document.getElementById('adminBatch').classList.add('hidden');
    document.getElementById('adminSummary').classList.add('hidden');
    loadAdminFood();
}

document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('adminFood').classList.add('hidden');
        document.getElementById('adminBatch').classList.add('hidden');
        document.getElementById('adminSummary').classList.add('hidden');
        document.getElementById('admin' + btn.dataset.admin.charAt(0).toUpperCase() + btn.dataset.admin.slice(1)).classList.remove('hidden');
        if (btn.dataset.admin === 'food') loadAdminFood();
        if (btn.dataset.admin === 'batch') loadAdminBatch();
        if (btn.dataset.admin === 'summary') loadAdminSummary();
    });
});

// === Admin: Food ===
async function loadAdminFood() {
    const section = document.getElementById('adminFood');
    const { data, error } = await supabase.from('food_items').select('*').order('sort_order');
    if (error) { section.innerHTML = '闁告梻濮惧ù鍥ㄥ緞鏉堫偉袝'; return; }
    let html = '<div class="inline-form"><input type="text" id="newFoodName" placeholder="濡炲鍠庨幖褔宕ュ鍥?><input type="number" id="newFoodPrice" placeholder="濞寸娀鏀遍悧? step="0.01" min="0"><input type="text" id="newFoodCat" placeholder="闁告帒妫涚悮?><button class="btn btn-sm" id="addFoodBtn">婵烇綀顕ф慨?/button></div>';
    html += '<table class="admin-table"><tr><th>闁告艾绉惰ⅷ</th><th>濞寸娀鏀遍悧?/th><th>闁告帒妫涚悮?/th><th>闁绘鍩栭埀?/th><th>闁瑰灝绉崇紞?/th></tr>';
    (data || []).forEach(item => {
        html += '<tr><td>' + item.name + '</td><td>' + Number(item.price).toFixed(2) + '</td><td>' + item.category + '</td><td>' + (item.active ? '濞戞挸锕ラ悘? : '鐎圭寮跺▓蹇涘磻?) + '</td><td><button class="btn btn-sm" onclick="toggleFood(' + item.id + ',' + item.active + ')">' + (item.active ? '闁哄棗鍊告禒? : '濞戞挸锕ラ悘?) + '</button> <button class="btn btn-sm btn-danger" onclick="deleteFood(' + item.id + ')">闁告帞濞€濞?/button></td></tr>';
    });
    html += '</table>';
    section.innerHTML = html;
    document.getElementById('addFoodBtn').addEventListener('click', async () => {
        const name = document.getElementById('newFoodName').value.trim();
        const price = parseFloat(document.getElementById('newFoodPrice').value);
        const cat = document.getElementById('newFoodCat').value.trim() || '闁稿繑婀圭划?;
        if (!name || isNaN(price)) return toast('閻犲洤鍢查敐鐐哄礃濞嗗繑鍊崇紒澶嬫緲閹风増绂掗柨瀣');
        const { data: all } = await supabase.from('food_items').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const nextOrder = (all && all.length > 0) ? all[0].sort_order + 1 : 1;
        await supabase.from('food_items').insert({ name, price, category: cat, sort_order: nextOrder });
        toast('鐎圭寮堕崸濠囧礉?); loadAdminFood();
    });
}

async function toggleFood(id, current) {
    await supabase.from('food_items').update({ active: !current }).eq('id', id);
    toast(current ? '鐎圭寮跺▓蹇涘磻? : '鐎规瓕寮撶粭鍌炲几?); loadAdminFood();
}

async function deleteFood(id) {
    if (!confirm('缁绢収鍠栭悾楣冨礆閻樼粯鐝熼柛姘殣缁?)) return;
    await supabase.from('food_items').delete().eq('id', id);
    toast('鐎瑰憡褰冮崹褰掓⒔?); loadAdminFood();
}

// === Admin: Batch ===
async function loadAdminBatch() {
    const section = document.getElementById('adminBatch');
    let html = '<div class="inline-form"><label>闁告帗绋戠紓鎾诲棘閻楀牆顥楁繛?</label><select id="batchType"><option value="wednesday">闁告稏鍔嬬粭?(450 Rub)</option><option value="saturday">闁告稏鍔岄崣?(600 Rub)</option></select><input type="date" id="batchDate"><button class="btn btn-sm" id="createBatchBtn">鐎殿喒鍋撻柛姘煎灡婢规帒鈻?/button></div>';
    html += '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">鐎殿喒鍋撻柛姘煎灠閹寰勮椤斿秹宕￠崘鎻掕濠靛鍋呮慨銈夋晬瀹€鍕珰閻犳劦鍘藉Λ鈺勩亹閹剧偨浜?0:00闁告挸绉磋ぐ鏌ュ箥鐎ｎ亜袟闁规惌浜濋?/p>';
    const { data } = await supabase.from('purchase_batches').select('*').order('created_at', { ascending: false }).limit(20);
    html += '<table class="admin-table"><tr><th>闁哄啨鍎插﹢?/th><th>缂侇偉顕ч悗?/th><th>闂傚嫭鍔欓·?/th><th>闁绘鍩栭埀?/th><th>闁瑰灝绉崇紞?/th></tr>';
    (data || []).forEach(b => {
        const typeLabel = b.batch_type === 'wednesday' ? '闁告稏鍔嬬粭? : '闁告稏鍔岄崣?;
        const statusLabel = b.status === 'open' ? '閺夆晜绋栭、鎴炵▔? : (b.status === 'closed' ? '鐎圭寮堕崺鍛潰? : '鐎垫澘鎳庣槐鎴﹀触?);
        html += '<tr><td>' + b.order_date + '</td><td>' + typeLabel + '</td><td>' + Number(b.limit_amount).toFixed(0) + '</td><td>' + statusLabel + '</td><td>' + (b.status === 'open' ? '<button class="btn btn-sm btn-warn" onclick="closeBatch(' + b.id + ')">闁规惌浜濋?/button>' : '--') + '</td></tr>';
    });
    html += '</table>';
    section.innerHTML = html;
    document.getElementById('createBatchBtn').addEventListener('click', async () => {
        const type = document.getElementById('batchType').value;
        const date = document.getElementById('batchDate').value;
        if (!date) return toast('閻犲洨鍏橀埀顒€顦扮€氥劑寮妷锔藉焸');
        const limit = type === 'wednesday' ? 450 : 600;
        await supabase.from('purchase_batches').insert({ batch_type: type, limit_amount: limit, status: 'open', order_date: date });
        toast('闁逛絻顫夐鐓庮啅閹绘帞纾婚柛?); loadAdminBatch();
    });
}

async function closeBatch(id) {
    if (!confirm('缁绢収鍠栭悾楣冨箣椤忓拋鍓鹃悹鍥ュ劜婢规帒鈻庨垾铏亱闁挎稓鍠愰崺鍛潰閵忕姵鍊靛鍫嗗喚鍟€闁哄啰濮电涵鍓佺磼瑜忛悽缁樼箙椤愶絽袚闁?)) return;
    await supabase.from('purchase_batches').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id);
    toast('鐎圭寮堕崺鍛潰?); loadAdminBatch();
}

// === Admin: Summary ===
async function loadAdminSummary() {
    const section = document.getElementById('adminSummary');
    section.innerHTML = '<div class="loading">闁告梻濮惧ù鍥ㄧ▔?..</div>';
    const { data: batches } = await supabase.from('purchase_batches').select('*').order('order_date', { ascending: false }).limit(20);
    const { data: orders } = await supabase.from('orders').select('*, users(name), food_items(name, price)');
    if (!batches) { section.innerHTML = '闁告梻濮惧ù鍥ㄥ緞鏉堫偉袝'; return; }
    let html = '';
    batches.forEach(batch => {
        const batchOrders = (orders || []).filter(o => o.batch_id === batch.id && o.quantity > 0);
        if (batchOrders.length === 0) return;
        const typeLabel = batch.batch_type === 'wednesday' ? '闁告稏鍔嬬粭? : '闁告稏鍔岄崣?;
        html += '<div class="batch-section"><h3>' + batch.order_date + ' 鐠?' + typeLabel + '闁逛絻顫夐?/h3>';
        const byUser = {};
        batchOrders.forEach(o => {
            const uname = (o.users || {}).name || '闁哄牜浜為悡?;
            if (!byUser[uname]) byUser[uname] = { items: [], total: 0 };
            byUser[uname].items.push(o);
            byUser[uname].total += (o.food_items || {}).price * o.quantity || 0;
        });
        html += '<table class="admin-table"><tr><th>濠殿喗鎸搁幃?/th><th>閻犱降鍨瑰畷鐔煎礃閸涱収鍟?/th><th>闁告艾鐗愰?/th></tr>';
        Object.entries(byUser).forEach(([name, info]) => {
            const orderText = info.items.map(o => (o.food_items || {}).name + ' x' + o.quantity).join('闁?);
            html += '<tr><td>' + name + '</td><td>' + orderText + '</td><td>' + info.total.toFixed(2) + '</td></tr>';
        });
        html += '</table></div>';
    });
    section.innerHTML = html || '闁哄棗鍊瑰Λ銈呅ч崶銊㈠亾缂佹ɑ娈堕柟?;
}

// ===== INIT =====
updateNameDatalists();
loadOrderView();

window.toggleFood = toggleFood;
window.deleteFood = deleteFood;
window.closeBatch = closeBatch;
