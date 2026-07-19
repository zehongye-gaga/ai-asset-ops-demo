# AI 资产运营系统 Demo

依据《PRD_资产运营系统》和《PRD摘要_v1.0》实现的可交互 Demo。它在一个 Rainbond 应用中运行全新的四组件 InsForge 后端，并由独立 React 前端通过 `@insforge/sdk` 读写真实数据。

## Demo 能力

- 通用、团队、个人三种资产视角
- 智能体、应用、Skills、知识库、MCP 五类资产
- 运营概览、统一目录、资产详情和运营大屏
- 新建资产、个人到团队、团队到通用的晋级申请
- 团队管理员和系统管理员审批

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
