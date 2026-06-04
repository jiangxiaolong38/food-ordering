-- 用户表
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_users" ON users FOR ALL USING (true);

-- 食品表
CREATE TABLE food_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_food_items" ON food_items FOR ALL USING (true);

-- 采购批次表
CREATE TABLE purchase_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_type TEXT NOT NULL,
  limit_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  order_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
ALTER TABLE purchase_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_batches" ON purchase_batches FOR ALL USING (true);

-- 订单表
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT REFERENCES purchase_batches(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  food_item_id BIGINT REFERENCES food_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, user_id, food_item_id)
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_orders" ON orders FOR ALL USING (true);

-- 设置表（管理密码）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_settings" ON settings FOR ALL USING (true);
INSERT INTO settings (key, value) VALUES ('admin_password', 'admin2024');
