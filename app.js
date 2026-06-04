const SUPABASE_URL = 'https://script.google.com/macros/s/AKfycbzINGhDULglaaOaoZn4Vfzmlgr7buHprm0l6GKQbAE77SBrgzawRV4pYJCMbFXgaEt9/exec';
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
            const typeLabel = currentBatch.batch_type === 'wednesday' ? '閸涖劋绗侀幍瑙勵偧' : '閸涖劌鍙氶幍瑙勵偧';
            document.getElementById('batchStatus').textContent = typeLabel + ' 璺?婵夘偅濮ゆ潻娑滎攽娑?;
            document.getElementById('batchStatus').className = 'batch-status open';
            document.getElementById('batchLabel').textContent = typeLabel;
            document.getElementById('batchLimit').textContent = currentBatch.limit_amount.toFixed(0) + ' 閳?;
            document.getElementById('orderActions').style.display = 'flex';
            document.getElementById('statusBar').textContent = '';
        } else {
            currentBatch = null;
            document.getElementById('batchStatus').textContent = '瑜版挸澧犲▽鈩冩箒瀵偓閺€鍓ф畱闁插洩鍠橀幍瑙勵偧';
            document.getElementById('batchStatus').className = 'batch-status closed';
            document.getElementById('batchLabel').textContent = '--';
            document.getElementById('batchLimit').textContent = '--';
            document.getElementById('batchUsed').textContent = '--';
            document.getElementById('orderActions').style.display = 'none';
            document.getElementById('foodGrid').innerHTML = '';
        }
    } catch(e) {
        console.error(e);
        document.getElementById('batchStatus').textContent = '閸旂姾娴囨径杈Е: ' + e.message;
    }
}

async function loadFoodGrid() {
    const grid = document.getElementById('foodGrid');
    grid.innerHTML = '<div class="loading">閸旂姾娴囨鐔锋惂閸掓銆?..</div>';
    const { data, error } = await supabase.from('food_items').select('*').order('sort_order');
    if (error) { grid.innerHTML = '<div class="loading">閸旂姾娴囨径杈Е</div>'; return; }
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
    label.textContent = '閸撯晙缍戞０鍕暬: ' + remaining.toFixed(2) + ' Rub';
    label.className = remaining < 0 ? 'budget-label over' : 'budget-label';
    document.getElementById('submitBtn').disabled = !currentUser;
    if (remaining < 0) {
        document.getElementById('statusBar').textContent = '瀹歌尪绉撮崙娲妫版繐绱濈拠宄板櫤鐏忔垶鏆熼柌?;
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
    if (!currentBatch || !currentUser) return toast('鐠囧嘲鍘涢柅澶嬪婵挸鎮?);
    let total = 0;
    const orders = [];
    document.querySelectorAll('.food-qty').forEach(input => {
        const qty = parseInt(input.value) || 0;
        total += qty * parseFloat(input.dataset.price);
        orders.push({ batch_id: currentBatch.id, user_id: currentUser.id, food_item_id: parseInt(input.dataset.id), quantity: qty });
    });
    if (total > currentBatch.limit_amount) return toast('鐡掑懎鍤梽鎰邦杺閿涘矁顕拫鍐╂殻閺佷即鍣?);
    try {
        const upsertData = orders.map(o => ({ batch_id: o.batch_id, user_id: o.user_id, food_item_id: o.food_item_id, quantity: o.quantity }));
        const { error } = await supabase.from('orders').upsert(upsertData, { onConflict: 'batch_id, user_id, food_item_id' });
        if (error) throw error;
        toast('鐠併垹宕熷鍙夊絹娴?');
    } catch(e) { toast('閹绘劒姘︽径杈Е: ' + e.message); }
});

// ===== HISTORY VIEW =====
function loadHistoryView() {
    updateNameDatalists();
    document.getElementById('historyContent').innerHTML = '鐠囩兘鈧瀚ㄦ慨鎾虫倳閺屻儳婀呴崢鍡楀蕉鐠併垹宕?;
}

document.getElementById('historyName').addEventListener('input', async function() {
    const name = this.value.trim();
    if (!name) { document.getElementById('historyContent').innerHTML = '鐠囩兘鈧瀚ㄦ慨鎾虫倳閺屻儳婀呴崢鍡楀蕉鐠併垹宕?; return; }
    const { data: userData } = await supabase.from('users').select('id').eq('name', name).limit(1);
    if (!userData || userData.length === 0) { document.getElementById('historyContent').innerHTML = '閺堫亝澹橀崚鎷岊嚉閻劍鍩?; return; }
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
        const typeLabel = batch.batch_type === 'wednesday' ? '閸涖劋绗? : '閸涖劌鍙?;
        const statusLabel = batch.status === 'closed' ? '瀹稿弶鍩呭? : (batch.status === 'open' ? '鏉╂稖顢戞稉? : '瀵板懎绱戦崥?);
        let batchTotal = 0;
        html += '<div class="batch-section"><h3>' + batch.order_date + ' 璺?' + typeLabel + '閹佃顐?璺?' + statusLabel + '</h3><table class="history-table"><tr><th>妞嬬喎鎼?/th><th>閸楁洑鐜?/th><th>閺佷即鍣?/th><th>鐏忓繗顓?/th></tr>';
        batchOrders.forEach(o => {
            const fi = o.food_items || {};
            const subtotal = (fi.price || 0) * o.quantity;
            batchTotal += subtotal;
            html += '<tr><td>' + (fi.name || '--') + '</td><td>' + Number(fi.price || 0).toFixed(2) + '</td><td>' + o.quantity + '</td><td>' + subtotal.toFixed(2) + '</td></tr>';
        });
        html += '<tr class="total-row"><td colspan="3">閸氬牐顓?/td><td>' + batchTotal.toFixed(2) + ' Rub</td></tr></table></div>';
    });
    document.getElementById('historyContent').innerHTML = html || '閺嗗倹妫ょ拋銏犲礋鐠佹澘缍?;
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
    if (error || !data) { document.getElementById('adminError').textContent = '妤犲矁鐦夋径杈Е'; document.getElementById('adminError').style.display = ''; return; }
    if (data.value === pw) { adminAuthed = true; showAdminPanel(); }
    else { document.getElementById('adminError').textContent = '鐎靛棛鐖滈柨娆掝嚖'; document.getElementById('adminError').style.display = ''; }
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
    if (error) { section.innerHTML = '閸旂姾娴囨径杈Е'; return; }
    let html = '<div class="inline-form"><input type="text" id="newFoodName" placeholder="妞嬬喎鎼ч崥宥囆?><input type="number" id="newFoodPrice" placeholder="娴犻攱鐗? step="0.01" min="0"><input type="text" id="newFoodCat" placeholder="閸掑棛琚?><button class="btn btn-sm" id="addFoodBtn">濞ｈ濮?/button></div>';
    html += '<table class="admin-table"><tr><th>閸氬秶袨</th><th>娴犻攱鐗?/th><th>閸掑棛琚?/th><th>閻樿埖鈧?/th><th>閹垮秳缍?/th></tr>';
    (data || []).forEach(item => {
        html += '<tr><td>' + item.name + '</td><td>' + Number(item.price).toFixed(2) + '</td><td>' + item.category + '</td><td>' + (item.active ? '娑撳﹥鐏? : '瀹稿弶娈忛崑?) + '</td><td><button class="btn btn-sm" onclick="toggleFood(' + item.id + ',' + item.active + ')">' + (item.active ? '閺嗗倸浠? : '娑撳﹥鐏?) + '</button> <button class="btn btn-sm btn-danger" onclick="deleteFood(' + item.id + ')">閸掔娀娅?/button></td></tr>';
    });
    html += '</table>';
    section.innerHTML = html;
    document.getElementById('addFoodBtn').addEventListener('click', async () => {
        const name = document.getElementById('newFoodName').value.trim();
        const price = parseFloat(document.getElementById('newFoodPrice').value);
        const cat = document.getElementById('newFoodCat').value.trim() || '閸忔湹绮?;
        if (!name || isNaN(price)) return toast('鐠囧嘲锝為崘娆忔倳缁夋澘鎷版禒閿嬬壐');
        const { data: all } = await supabase.from('food_items').select('sort_order').order('sort_order', { ascending: false }).limit(1);
        const nextOrder = (all && all.length > 0) ? all[0].sort_order + 1 : 1;
        await supabase.from('food_items').insert({ name, price, category: cat, sort_order: nextOrder });
        toast('瀹稿弶鍧婇崝?); loadAdminFood();
    });
}

async function toggleFood(id, current) {
    await supabase.from('food_items').update({ active: !current }).eq('id', id);
    toast(current ? '瀹稿弶娈忛崑? : '瀹歌弓绗傞弸?); loadAdminFood();
}

async function deleteFood(id) {
    if (!confirm('绾喖鐣鹃崚鐘绘珟閸氭绱?)) return;
    await supabase.from('food_items').delete().eq('id', id);
    toast('瀹告彃鍨归梽?); loadAdminFood();
}

// === Admin: Batch ===
async function loadAdminBatch() {
    const section = document.getElementById('adminBatch');
    let html = '<div class="inline-form"><label>閸掓稑缂撻弬鐗堝濞?</label><select id="batchType"><option value="wednesday">閸涖劋绗?(450 Rub)</option><option value="saturday">閸涖劌鍙?(600 Rub)</option></select><input type="date" id="batchDate"><button class="btn btn-sm" id="createBatchBtn">瀵偓閸氼垱澹掑▎?/button></div>';
    html += '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">瀵偓閸氼垰鎮楁径褍顔嶉崡鍐插讲婵夘偅濮ら敍宀勫櫚鐠愵厽妫╄ぐ鎾炽亯10:00閸撳秴褰查幍瀣З閹搭亝顒?/p>';
    const { data } = await supabase.from('purchase_batches').select('*').order('created_at', { ascending: false }).limit(20);
    html += '<table class="admin-table"><tr><th>閺冦儲婀?/th><th>缁鐎?/th><th>闂勬劙顤?/th><th>閻樿埖鈧?/th><th>閹垮秳缍?/th></tr>';
    (data || []).forEach(b => {
        const typeLabel = b.batch_type === 'wednesday' ? '閸涖劋绗? : '閸涖劌鍙?;
        const statusLabel = b.status === 'open' ? '鏉╂稖顢戞稉? : (b.status === 'closed' ? '瀹稿弶鍩呭? : '瀵板懎绱戦崥?);
        html += '<tr><td>' + b.order_date + '</td><td>' + typeLabel + '</td><td>' + Number(b.limit_amount).toFixed(0) + '</td><td>' + statusLabel + '</td><td>' + (b.status === 'open' ? '<button class="btn btn-sm btn-warn" onclick="closeBatch(' + b.id + ')">閹搭亝顒?/button>' : '--') + '</td></tr>';
    });
    html += '</table>';
    section.innerHTML = html;
    document.getElementById('createBatchBtn').addEventListener('click', async () => {
        const type = document.getElementById('batchType').value;
        const date = document.getElementById('batchDate').value;
        if (!date) return toast('鐠囩兘鈧瀚ㄩ弮銉︽埂');
        const limit = type === 'wednesday' ? 450 : 600;
        await supabase.from('purchase_batches').insert({ batch_type: type, limit_amount: limit, status: 'open', order_date: date });
        toast('閹佃顐煎鎻掔磻閸?); loadAdminBatch();
    });
}

async function closeBatch(id) {
    if (!confirm('绾喖鐣鹃幋顏咁剾鐠囥儲澹掑▎鈥虫偋閿涚喐鍩呭銏犳倵婢堆冾啀閺冪姵纭剁紒褏鐢绘繅顐ｅГ閵?)) return;
    await supabase.from('purchase_batches').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id);
    toast('瀹稿弶鍩呭?); loadAdminBatch();
}

// === Admin: Summary ===
async function loadAdminSummary() {
    const section = document.getElementById('adminSummary');
    section.innerHTML = '<div class="loading">閸旂姾娴囨稉?..</div>';
    const { data: batches } = await supabase.from('purchase_batches').select('*').order('order_date', { ascending: false }).limit(20);
    const { data: orders } = await supabase.from('orders').select('*, users(name), food_items(name, price)');
    if (!batches) { section.innerHTML = '閸旂姾娴囨径杈Е'; return; }
    let html = '';
    batches.forEach(batch => {
        const batchOrders = (orders || []).filter(o => o.batch_id === batch.id && o.quantity > 0);
        if (batchOrders.length === 0) return;
        const typeLabel = batch.batch_type === 'wednesday' ? '閸涖劋绗? : '閸涖劌鍙?;
        html += '<div class="batch-section"><h3>' + batch.order_date + ' 璺?' + typeLabel + '閹佃顐?/h3>';
        const byUser = {};
        batchOrders.forEach(o => {
            const uname = (o.users || {}).name || '閺堫亞鐓?;
            if (!byUser[uname]) byUser[uname] = { items: [], total: 0 };
            byUser[uname].items.push(o);
            byUser[uname].total += (o.food_items || {}).price * o.quantity || 0;
        });
        html += '<table class="admin-table"><tr><th>婵挸鎮?/th><th>鐠併垹宕熼崘鍛啇</th><th>閸氬牐顓?/th></tr>';
        Object.entries(byUser).forEach(([name, info]) => {
            const orderText = info.items.map(o => (o.food_items || {}).name + ' x' + o.quantity).join('閵?);
            html += '<tr><td>' + name + '</td><td>' + orderText + '</td><td>' + info.total.toFixed(2) + '</td></tr>';
        });
        html += '</table></div>';
    });
    section.innerHTML = html || '閺嗗倹妫ゅЧ鍥ㄢ偓缁樻殶閹?;
}

// ===== INIT =====
updateNameDatalists();
loadOrderView();

window.toggleFood = toggleFood;
window.deleteFood = deleteFood;
window.closeBatch = closeBatch;
