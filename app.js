var PROXY = 'https://script.google.com/macros/s/AKfycbwDN5zrgaCzGPPT1vFLo82KjJu8BM6lI8vmNMaBk9L-lvz8rM36c2jrk-nN22az0w8o/exec';
var API = PROXY + 'rest/v1/';

function api(method, path, body) {
    var url = API + path;
    if ((method === 'PATCH' || method === 'DELETE') && url.indexOf('_method') === -1) {
        var sep = url.indexOf('?') >= 0 ? '&' : '?';
        url += sep + '_method=' + method;
        method = 'POST';
    }
    var opts = { method: method, headers: {} };
    if (body) opts.headers['Content-Type'] = 'text/plain';
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function(r) { return r.json(); });
}

var _from = function(table) {
    return {
        table: table,
        _filters: [],
        _order: null,
        _limit: null,
        _single: false,
        select: function(cols) { var q = this; q._select = cols; q._method = 'GET'; return q; },
        insert: function(rows) { var q = this; q._insert = rows; q._method = 'POST'; return q; },
        update: function(obj) { var q = this; q._update = obj; q._method = 'PATCH'; return q; },
        delete: function() { var q = this; q._method = 'DELETE'; return q; },
        upsert: function(rows, opts) { var q = this; q._upsert = rows; q._upsert_opts = opts; q._method = 'POST'; return q; },
        eq: function(col, val) { this._filters.push(col + '=eq.' + encodeURIComponent(val)); return this; },
        neq: function(col, val) { this._filters.push(col + '=neq.' + encodeURIComponent(val)); return this; },
        order: function(col, opts) { var asc = !opts || opts.ascending !== false; this._order = col + (asc ? '.asc' : '.desc'); return this; },
        limit: function(n) { this._limit = n; return this; },
        single: function() { this._single = true; return this; },
        then: function(resolve, reject) {
            var q = this;
            var parts = [];
            if (q._select) parts.push('select=' + q._select);
            q._filters.forEach(function(f) { parts.push(f); });
            if (q._order) parts.push('order=' + q._order);
            if (q._limit) parts.push('limit=' + q._limit);
            var qs = parts.join('&');
            var path = q.table + (qs ? '?' + qs : '');
            var method = q._method;
            var body = null;
            if (q._insert) body = q._insert;
            if (q._update) body = q._update;
            if (q._upsert) {
                body = q._upsert;
                var oc = q._upsert_opts && q._upsert_opts.onConflict;
                if (oc) {
                    var h = qs ? '&' : '?';
                    path += h + 'on_conflict=' + oc;
                }
            }
            return api(method, path, body).then(function(result) {
                if (result.error) return reject(result);
                if (q._single && Array.isArray(result)) result = result[0] || null;
                resolve({ data: result, error: null });
            }).catch(function(e) {
                resolve({ data: null, error: e });
            });
        }
    };
};

var supabase = { from: function(t) { return _from(t); }, rpc: function() {} };

var currentUser = null;
var currentBatch = null;
var adminAuthed = false;

function $(id) { return document.getElementById(id); }

function toast(msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function getSavedNames() {
    try { return JSON.parse(localStorage.getItem('bf_names') || '[]'); } catch(e) { return []; }
}
function saveName(name) {
    var names = getSavedNames().filter(function(n) { return n !== name; });
    names.unshift(name);
    if (names.length > 50) names = names.slice(0, 50);
    localStorage.setItem('bf_names', JSON.stringify(names));
}
function updateNameDatalists() {
    var names = getSavedNames();
    var dl1 = $('nameList'), dl2 = $('nameList2');
    var html = names.map(function(n) { return '<option value="' + n + '">'; }).join('');
    if (dl1) dl1.innerHTML = html;
    if (dl2) dl2.innerHTML = html;
}

// Navigation
document.querySelectorAll('.nav-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.nav-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(function(v) { v.classList.add('hidden'); });
        $('view-' + btn.dataset.view).classList.remove('hidden');
        if (btn.dataset.view === 'order') loadOrderView();
        if (btn.dataset.view === 'history') loadHistoryView();
        if (btn.dataset.view === 'admin') loadAdminView();
    });
});

// Order View
async function loadOrderView() {
    updateNameDatalists();
    await loadCurrentBatch();
    if (currentBatch) await loadFoodGrid();
}

async function loadCurrentBatch() {
    try {
        await supabase.from('purchase_batches').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(1).then(function(r) {
            if (r.error) throw r.error;
            var data = r.data;
            if (data && data.length > 0) {
                currentBatch = data[0];
                var label = currentBatch.batch_type === 'wednesday' ? '\u5468\u4e09\u6279\u6b21' : '\u5468\u516d\u6279\u6b21';
                $('batchStatus').textContent = label + ' \u00b7 \u586b\u62a5\u8fdb\u884c\u4e2d';
                $('batchStatus').className = 'batch-status open';
                $('batchLabel').textContent = label;
                $('batchLimit').textContent = currentBatch.limit_amount.toFixed(0) + ' \u20bd';
                $('orderActions').style.display = 'flex';
                $('statusBar').textContent = '';
            } else {
                currentBatch = null;
                $('batchStatus').textContent = '\u5f53\u524d\u6ca1\u6709\u5f00\u653e\u7684\u91c7\u8d2d\u6279\u6b21';
                $('batchStatus').className = 'batch-status closed';
                $('batchLabel').textContent = '--';
                $('batchLimit').textContent = '--';
                $('batchUsed').textContent = '--';
                $('orderActions').style.display = 'none';
                $('foodGrid').innerHTML = '';
            }
        });
    } catch(e) {
        $('batchStatus').textContent = '\u52a0\u8f7d\u5931\u8d25: ' + e.message;
    }
}

async function loadFoodGrid() {
    var grid = $('foodGrid');
    grid.innerHTML = '<div class="loading">' + '\u52a0\u8f7d\u98df\u54c1\u5217\u8868...' + '</div>';
    await supabase.from('food_items').select('*').order('sort_order').then(function(r) {
        if (r.error) { grid.innerHTML = '<div class="loading">\u52a0\u8f7d\u5931\u8d25</div>'; return; }
        var items = r.data || [];
        var html = '';
        var cats = [];
        items.forEach(function(i) { if (cats.indexOf(i.category) === -1) cats.push(i.category); });
        cats.forEach(function(cat) {
            html += '<div style="grid-column:1/-1;font-size:13px;font-weight:600;color:var(--muted);padding:8px 0 0 4px">' + cat + '</div>';
            items.filter(function(i) { return i.category === cat; }).forEach(function(item) {
                var cls = item.active ? 'food-item' : 'food-item inactive';
                html += '<div class="' + cls + '"><div class="food-info"><div class="food-name">' + item.name + '</div><div class="food-price">' + Number(item.price).toFixed(2) + ' Rub</div></div><input type="number" class="food-qty" min="0" max="99" value="0" data-id="' + item.id + '" data-price="' + item.price + '"></div>';
            });
        });
        grid.innerHTML = html;
        grid.querySelectorAll('.food-qty').forEach(function(input) {
            input.addEventListener('input', function() { recalcBudget(); });
        });
        loadUserOrder();
    });
}

async function loadUserOrder() {
    if (!currentBatch || !currentUser) return;
    await supabase.from('orders').select('food_item_id,quantity').eq('batch_id', currentBatch.id).eq('user_id', currentUser.id).then(function(r) {
        if (r.error || !r.data) return;
        r.data.forEach(function(row) {
            var input = document.querySelector('.food-qty[data-id="' + row.food_item_id + '"]');
            if (input) input.value = row.quantity;
        });
        recalcBudget();
    });
}

function recalcBudget() {
    if (!currentBatch) return;
    var total = 0;
    document.querySelectorAll('.food-qty').forEach(function(input) {
        var qty = parseInt(input.value) || 0;
        total += qty * parseFloat(input.dataset.price);
    });
    $('batchUsed').textContent = total.toFixed(2) + ' Rub';
    var remaining = currentBatch.limit_amount - total;
    $('budgetLabel').textContent = '\u5269\u4f59\u9884\u7b97: ' + remaining.toFixed(2) + ' Rub';
    $('budgetLabel').className = remaining < 0 ? 'budget-label over' : 'budget-label';
    $('submitBtn').disabled = !currentUser;
    if (remaining < 0) { $('statusBar').textContent = '\u5df2\u8d85\u51fa\u9650\u989d\uff0c\u8bf7\u51cf\u5c11\u6570\u91cf'; $('statusBar').style.color = 'var(--red)'; }
    else { $('statusBar').textContent = ''; }
}

$('orderName').addEventListener('input', async function() {
    var name = this.value.trim();
    if (!name) { currentUser = null; recalcBudget(); return; }
    // Silently upsert user
    var userRec = await api('POST', 'users?on_conflict=name', [{ name: name }]);
    if (userRec && userRec.length > 0) {
        currentUser = { id: userRec[0].id, name: name };
    }
    saveName(name);
    updateNameDatalists();
    await loadUserOrder();
    recalcBudget();
});

$('submitBtn').addEventListener('click', async function() {
    if (!currentBatch || !currentUser) return toast('\u8bf7\u5148\u9009\u62e9\u59d3\u540d');
    var total = 0;
    var orders = [];
    document.querySelectorAll('.food-qty').forEach(function(input) {
        var qty = parseInt(input.value) || 0;
        total += qty * parseFloat(input.dataset.price);
        orders.push({ batch_id: currentBatch.id, user_id: currentUser.id, food_item_id: parseInt(input.dataset.id), quantity: qty });
    });
    if (total > currentBatch.limit_amount) return toast('\u8d85\u51fa\u9650\u989d\uff0c\u8bf7\u8c03\u6574\u6570\u91cf');
    try {
        await api('POST', 'orders?on_conflict=batch_id,user_id,food_item_id', orders);
        toast('\u8ba2\u5355\u5df2\u63d0\u4ea4!');
    } catch(e) { toast('\u63d0\u4ea4\u5931\u8d25: ' + e.message); }
});

// History
function loadHistoryView() {
    updateNameDatalists();
    $('historyContent').innerHTML = '\u8bf7\u9009\u62e9\u59d3\u540d\u67e5\u770b\u5386\u53f2\u8ba2\u5355';
}

$('historyName').addEventListener('input', async function() {
    var name = this.value.trim();
    if (!name) { $('historyContent').innerHTML = '\u8bf7\u9009\u62e9\u59d3\u540d\u67e5\u770b\u5386\u53f2\u8ba2\u5355'; return; }
    var userResp = await api('GET', 'users?select=id&name=eq.' + encodeURIComponent(name) + '&limit=1');
    if (!userResp || userResp.length === 0) { $('historyContent').innerHTML = '\u672a\u627e\u5230\u8be5\u7528\u6237'; return; }
    var userId = userResp[0].id;
    saveName(name); updateNameDatalists();
    var batchResp = await api('GET', 'purchase_batches?select=*&order=order_date.desc');
    var orderResp = await api('GET', 'orders?select=*,food_items(name,price)&user_id=eq.' + userId);
    var batches = batchResp || [];
    var orders = orderResp || [];
    var html = '';
    batches.forEach(function(batch) {
        var batchOrders = orders.filter(function(o) { return o.batch_id === batch.id && o.quantity > 0; });
        if (batchOrders.length === 0) return;
        var typeLabel = batch.batch_type === 'wednesday' ? '\u5468\u4e09' : '\u5468\u516d';
        var statusLabel = batch.status === 'closed' ? '\u5df2\u622a\u6b62' : (batch.status === 'open' ? '\u8fdb\u884c\u4e2d' : '\u5f85\u5f00\u542f');
        var batchTotal = 0;
        html += '<div class="batch-section"><h3>' + batch.order_date + ' \u00b7 ' + typeLabel + '\u6279\u6b21 \u00b7 ' + statusLabel + '</h3><table class="history-table"><tr><th>\u98df\u54c1</th><th>\u5355\u4ef7</th><th>\u6570\u91cf</th><th>\u5c0f\u8ba1</th></tr>';
        batchOrders.forEach(function(o) {
            var fi = o.food_items || {};
            var subtotal = (fi.price || 0) * o.quantity;
            batchTotal += subtotal;
            html += '<tr><td>' + (fi.name || '--') + '</td><td>' + Number(fi.price || 0).toFixed(2) + '</td><td>' + o.quantity + '</td><td>' + subtotal.toFixed(2) + '</td></tr>';
        });
        html += '<tr class="total-row"><td colspan="3">\u5408\u8ba1</td><td>' + batchTotal.toFixed(2) + ' Rub</td></tr></table></div>';
    });
    $('historyContent').innerHTML = html || '\u6682\u65e0\u8ba2\u5355\u8bb0\u5f55';
});

// Admin
function loadAdminView() {
    if (adminAuthed) { showAdminPanel(); return; }
    $('adminGate').style.display = '';
    $('adminPanel').classList.add('hidden');
    $('adminPassword').value = '';
    $('adminError').style.display = 'none';
}

$('adminLoginBtn').addEventListener('click', async function() {
    var pw = $('adminPassword').value;
    await api('GET', 'settings?select=value&key=eq.admin_password&limit=1').then(function(r) {
        if (r && r.length > 0 && r[0].value === pw) { adminAuthed = true; showAdminPanel(); }
        else { $('adminError').textContent = '\u5bc6\u7801\u9519\u8bef'; $('adminError').style.display = ''; }
    });
});

$('adminPassword').addEventListener('keydown', function(e) { if (e.key === 'Enter') $('adminLoginBtn').click(); });

function showAdminPanel() {
    $('adminGate').style.display = 'none';
    $('adminPanel').classList.remove('hidden');
    document.querySelectorAll('.admin-tab').forEach(function(b) { b.classList.remove('active'); });
    document.querySelector('.admin-tab[data-admin="food"]').classList.add('active');
    $('adminFood').classList.remove('hidden');
    $('adminBatch').classList.add('hidden');
    $('adminSummary').classList.add('hidden');
    loadAdminFood();
}

document.querySelectorAll('.admin-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.admin-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var name = 'admin' + btn.dataset.admin.charAt(0).toUpperCase() + btn.dataset.admin.slice(1);
        ['adminFood','adminBatch','adminSummary'].forEach(function(s) { $(s).classList.add('hidden'); });
        $(name).classList.remove('hidden');
        if (btn.dataset.admin === 'food') loadAdminFood();
        if (btn.dataset.admin === 'batch') loadAdminBatch();
        if (btn.dataset.admin === 'summary') loadAdminSummary();
    });
});

async function loadAdminFood() {
    var section = $('adminFood');
    await api('GET', 'food_items?select=*&order=sort_order.asc').then(function(r) {
        var data = r || [];
        var html = '<div class="inline-form"><input type="text" id="newFoodName" placeholder="\u98df\u54c1\u540d\u79f0"><input type="number" id="newFoodPrice" placeholder="\u4ef7\u683c" step="0.01" min="0"><input type="text" id="newFoodCat" placeholder="\u5206\u7c7b"><button class="btn btn-sm" id="addFoodBtn">\u6dfb\u52a0</button></div>';
        html += '<table class="admin-table"><tr><th>\u540d\u79f0</th><th>\u4ef7\u683c</th><th>\u5206\u7c7b</th><th>\u72b6\u6001</th><th>\u64cd\u4f5c</th></tr>';
        data.forEach(function(item) {
            html += '<tr><td>' + item.name + '</td><td>' + Number(item.price).toFixed(2) + '</td><td>' + item.category + '</td><td>' + (item.active ? '\u4e0a\u67b6' : '\u5df2\u6682\u505c') + '</td><td><button class="btn btn-sm" onclick="toggleFood(' + item.id + ',' + item.active + ')">' + (item.active ? '\u6682\u505c' : '\u4e0a\u67b6') + '</button> <button class="btn btn-sm btn-danger" onclick="deleteFood(' + item.id + ')">\u5220\u9664</button></td></tr>';
        });
        html += '</table>';
        section.innerHTML = html;
        $('addFoodBtn').addEventListener('click', async function() {
            var name = $('newFoodName').value.trim();
            var price = parseFloat($('newFoodPrice').value);
            var cat = $('newFoodCat').value.trim() || '\u5176\u4ed6';
            if (!name || isNaN(price)) return toast('\u8bf7\u586b\u5199\u540d\u79f0\u548c\u4ef7\u683c');
            var sr = await api('GET', 'food_items?select=sort_order&order=sort_order.desc&limit=1');
            var next = (sr && sr.length > 0) ? sr[0].sort_order + 1 : 1;
            await api('POST', 'food_items', [{ name: name, price: price, category: cat, sort_order: next }]);
            toast('\u5df2\u6dfb\u52a0'); loadAdminFood();
        });
    });
}

async function toggleFood(id, current) {
    await api('PATCH', 'food_items?id=eq.' + id, { active: !current });
    toast(current ? '\u5df2\u6682\u505c' : '\u5df2\u4e0a\u67b6'); loadAdminFood();
}

async function deleteFood(id) {
    if (!confirm('\u786e\u5b9a\u5220\u9664\u5417\uff1f')) return;
    await api('DELETE', 'food_items?id=eq.' + id);
    toast('\u5df2\u5220\u9664'); loadAdminFood();
}

async function loadAdminBatch() {
    var section = $('adminBatch');
    var html = '<div class="inline-form"><label>\u521b\u5efa\u65b0\u6279\u6b21:</label><select id="batchType"><option value="wednesday">\u5468\u4e09 (450 \u20bd)</option><option value="saturday">\u5468\u516d (600 \u20bd)</option></select><input type="date" id="batchDate"><button class="btn btn-sm" id="createBatchBtn">\u5f00\u542f\u6279\u6b21</button></div>';
    html += '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">\u5f00\u542f\u540e\u5927\u5bb6\u5373\u53ef\u586b\u62a5\uff0c\u91c7\u8d2d\u65e5\u5f53\u592910:00\u524d\u53ef\u624b\u52a8\u622a\u6b62</p>';
    await api('GET', 'purchase_batches?select=*&order=created_at.desc&limit=20').then(function(data) {
        var batches = data || [];
        html += '<table class="admin-table"><tr><th>\u65e5\u671f</th><th>\u7c7b\u578b</th><th>\u9650\u989d</th><th>\u72b6\u6001</th><th>\u64cd\u4f5c</th></tr>';
        batches.forEach(function(b) {
            var typeLabel = b.batch_type === 'wednesday' ? '\u5468\u4e09' : '\u5468\u516d';
            var statusLabel = b.status === 'open' ? '\u8fdb\u884c\u4e2d' : (b.status === 'closed' ? '\u5df2\u622a\u6b62' : '\u5f85\u5f00\u542f');
            html += '<tr><td>' + b.order_date + '</td><td>' + typeLabel + '</td><td>' + Number(b.limit_amount).toFixed(0) + '</td><td>' + statusLabel + '</td><td>' + (b.status === 'open' ? '<button class="btn btn-sm btn-warn" onclick="closeBatch(' + b.id + ')">\u622a\u6b62</button>' : '--') + '</td></tr>';
        });
        html += '</table>';
        section.innerHTML = html;
        $('createBatchBtn').addEventListener('click', async function() {
            var type = $('batchType').value;
            var date = $('batchDate').value;
            if (!date) return toast('\u8bf7\u9009\u62e9\u65e5\u671f');
            var limit = type === 'wednesday' ? 450 : 600;
            await api('POST', 'purchase_batches', [{ batch_type: type, limit_amount: limit, status: 'open', order_date: date }]);
            toast('\u6279\u6b21\u5df2\u5f00\u542f'); loadAdminBatch();
        });
    });
}

async function closeBatch(id) {
    if (!confirm('\u786e\u5b9a\u622a\u6b62\u8be5\u6279\u6b21\u5417\uff1f\u622a\u6b62\u540e\u5927\u5bb6\u65e0\u6cd5\u7ee7\u7eed\u586b\u62a5\u3002')) return;
    await api('PATCH', 'purchase_batches?id=eq.' + id, { status: 'closed', closed_at: new Date().toISOString() });
    toast('\u5df2\u622a\u6b62'); loadAdminBatch();
}

async function loadAdminSummary() {
    var section = $('adminSummary');
    section.innerHTML = '<div class="loading">\u52a0\u8f7d\u4e2d...</div>';
    var batches = await api('GET', 'purchase_batches?select=*&order=order_date.desc&limit=20') || [];
    var orders = await api('GET', 'orders?select=*,users(name),food_items(name,price)') || [];
    var html = '';
    batches.forEach(function(batch) {
        var batchOrders = orders.filter(function(o) { return o.batch_id === batch.id && o.quantity > 0; });
        if (batchOrders.length === 0) return;
        var typeLabel = batch.batch_type === 'wednesday' ? '\u5468\u4e09' : '\u5468\u516d';
        html += '<div class="batch-section"><h3>' + batch.order_date + ' \u00b7 ' + typeLabel + '\u6279\u6b21</h3>';
        var byUser = {};
        batchOrders.forEach(function(o) {
            var uname = (o.users || {}).name || '\u672a\u77e5';
            if (!byUser[uname]) byUser[uname] = { items: [], total: 0 };
            byUser[uname].items.push(o);
            byUser[uname].total += (o.food_items || {}).price * o.quantity || 0;
        });
        html += '<table class="admin-table"><tr><th>\u59d3\u540d</th><th>\u8ba2\u5355\u5185\u5bb9</th><th>\u5408\u8ba1</th></tr>';
        Object.keys(byUser).forEach(function(name) {
            var info = byUser[name];
            var orderText = info.items.map(function(o) { return (o.food_items || {}).name + ' x' + o.quantity; }).join('\u3001');
            html += '<tr><td>' + name + '</td><td>' + orderText + '</td><td>' + info.total.toFixed(2) + '</td></tr>';
        });
        html += '</table></div>';
    });
    section.innerHTML = html || '\u6682\u65e0\u6c47\u603b\u6570\u636e';
}

// Init
updateNameDatalists();
loadOrderView();
window.toggleFood = toggleFood;
window.deleteFood = deleteFood;
window.closeBatch = closeBatch;
