# 早餐采购系统

项目部早餐集中采购系统，支持多人填报、限额管理、采购汇总。

## 功能

- **在线填报**: 选择姓名后填写采购数量，实时显示预算
- **批次管理**: 管理员开启/截止周三(450₽)和周六(600₽)批次
- **食品管理**: 管理员可添加、暂停、删除食品
- **历史查询**: 按姓名查询历史采购记录
- **采购汇总**: 管理员查看各批次汇总清单

## 技术栈

- HTML5 + CSS3 + JavaScript
- [Supabase](https://supabase.com) 云端数据库
- 部署于 GitHub Pages

## 设置步骤

1. 注册 Supabase 账号，创建项目
2. 在 SQL Editor 中运行 `schema.sql` 建表
3. 在 `app.js` 中填入 Supabase URL 和 anon key
4. 将项目部署到 GitHub Pages

## 默认管理员密码

admin2024（可在 settings 表中修改）
