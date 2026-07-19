# AI 资产运营系统 Demo

依据《PRD_资产运营系统》和《PRD摘要_v1.0》实现的可交互 Demo。它在一个 Rainbond 应用中运行全新的四组件 InsForge 后端，并由独立 React 前端通过 `@insforge/sdk` 读写真实数据。

## Demo 能力

- 系统管理员、运营人员、团队管理员、个人四种演示身份，刷新后记忆角色
- 通用、当前团队、本人三层数据边界与集中式权限策略
- 智能体、应用、Skills、知识库、MCP 五类资产
- 运营概览、统一目录、治理审批、资产详情和独立运营大屏
- 新建资产、个人到团队、团队到通用的晋级申请
- 两级责任审批、24 小时 SLA、可管理/只读说明与关键动作留痕
- 全局、团队、个人三视角大屏和浏览器全屏显示

界面中的角色切换用于证明产品规则，不等同于生产鉴权。生产环境需要接入企业身份、组织目录和服务端/数据库权限策略。

## 页面入口

- `/manage/overview`：运营概览
- `/manage/assets`：统一资产目录
- `/manage/approvals`：治理审批
- `/cockpit`：独立运营大屏

管理系统使用白色侧栏和顶部工作区；运营大屏使用独立布局，不加载管理导航。四个入口均支持直接访问和刷新，根路径与未知路径会回到 `/manage/overview`。

## 本地运行

```bash
npm install
npm run dev
```

生产构建由 `server.mjs` 提供静态文件和 `/config.js` 运行时配置：

```bash
npm run build
INSFORGE_BASE_URL=http://your-insforge \
INSFORGE_ANON_KEY=anon_your-public-client-key \
PORT=8080 npm start
```

## 验证

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

数据库初始化脚本位于 `insforge/migrations/`。详细产品边界和技术方案见 `docs/`。
