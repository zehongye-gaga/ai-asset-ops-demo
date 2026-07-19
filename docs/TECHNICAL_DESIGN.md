# 技术方案

## 总体结构

用户浏览器访问 React 前端。前端通过运行时注入的 `INSFORGE_BASE_URL` 和 `INSFORGE_ANON_KEY` 创建 InsForge SDK 客户端，直接读写 InsForge 的 PostgreSQL 数据。Rainbond 应用内包含 PostgreSQL、PostgREST、Deno、InsForge 和前端五个组件。

## 数据流

1. 前端启动时请求 `/config.js`，拿到当前环境的 InsForge 地址和匿名客户端 Key。
2. 前端使用 `@insforge/sdk` 读取 `assets`、`approval_requests` 和 `activity_events`。
3. 新建资产写入 `assets`；提交晋级写入 `approval_requests`。
4. 审批通过后更新审批状态和资产范围，再写入一条动态事件。
5. 页面重新读取三张表并刷新 KPI、列表和待办。

## 关键决策

- 使用运行时 `/config.js`，而不是把后端地址和 Key 烧进 Vite 构建产物。这样 Rainbond 修改配置后只需重启组件，不必重新构建代码。
- Demo 不增加自研 API 服务，避免与 InsForge 的数据库与 REST 能力重复。
- 权限切换用于产品演示，不冒充生产鉴权；生产版本需接入 InsForge Auth 和数据库行级权限。
- PostgreSQL 与 InsForge 文件目录使用 Rainbond 共享存储，确保组件重启后数据保留。

## 失败处理

- 配置缺失时前端明确提示缺少哪个环境变量。
- InsForge 查询或写入失败时保留当前页面并显示错误，不切换到本地假数据。
- 审批由三个顺序写操作组成；任一步失败都会显示错误。生产版本应改为数据库函数或事务。
