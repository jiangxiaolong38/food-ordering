# 御膳坊 · 在线点餐系统

一个优雅的餐厅在线点餐网页应用，支持菜单浏览、分类筛选、购物车管理和在线下单功能。基于纯前端技术构建，可直接部署到 GitHub Pages。

## 功能

- **菜单浏览**：展示菜品列表，包含名称、价格、描述和 Emoji 图标
- **分类筛选**：按凉菜、热菜、主食、饮品、汤品快速筛选
- **购物车管理**：添加、增减数量、实时计算总价
- **下单流程**：生成订单编号，确认下单，清空购物车
- **响应式设计**：完美适配桌面端和移动端

## 技术栈

- HTML5 + CSS3 + JavaScript（原生，无框架依赖）
- CSS 自定义属性（主题色变量）
- CSS Grid / Flexbox 布局
- 语义化标签与无障碍支持

## 快速开始

直接打开 `index.html` 即可预览，或使用任意静态服务器：

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

## 部署到 GitHub Pages

1. 推送代码到 GitHub 仓库
2. 进入仓库 Settings → Pages
3. 选择部署源为 `main` 分支，根目录
4. 访问 `https://<用户名>.github.io/<仓库名>/`

## 项目结构

```
food-ordering/
├── index.html      # 主页面
├── styles.css      # 样式文件
├── script.js       # 交互逻辑
└── README.md       # 项目说明
```

## 许可证

MIT License
