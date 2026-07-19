# Rainbond 交付记录

## 应用

- 应用名：`ai-asset-ops-demo`
- Rainbond 应用 ID：`140`
- 环境：`preview`
- 前端访问地址：`http://gre724d7-8080-hrt0ewj2.dev.lexmount.net`
- InsForge 地址：`http://gr61becf-7130-hrt0ewj2.dev.lexmount.net`

## 组件

| 组件 | 来源 | 端口 | 持久化 |
| --- | --- | --- | --- |
| postgres | `ghcr.io/insforge/postgres-all:latest` | 5432 | `/var/lib/postgresql/data` |
| postgrest | `docker.1ms.run/postgrest/postgrest:v12.2.12` | 3000 | 不需要 |
| deno | `ghcr.io/insforge/deno-runtime:latest` | 7133 | `/deno-dir` 缓存 |
| insforge | `ghcr.io/insforge/insforge-oss:latest` | 7130、7131 | `/insforge-storage`、`/insforge-logs` |
| asset-ops-web | GitHub `main` 分支，经 `ghfast.top` 拉取 | 8080 | 不需要 |

前端使用 CNB 的 `express` 服务模式构建，运行时由 `/config.js` 注入 InsForge 地址和匿名客户端 Key，因此修改环境配置后只需重启，不必重新打包前端。

## 已验证

- 五个组件均为 `running`，无容量阻塞。
- 前端根页面、健康接口、运行时配置、JS/CSS MIME、缓存头和 SPA 深链均可访问。
- InsForge 数据迁移版本 `20260719210000` 执行成功。
- SDK 可读取资产、审批和动态，并完成“新建个人资产 → 提交团队晋级 → 审批通过 → 范围更新”的持久化链路。
- 浏览器插件当前没有可用浏览器会话，尚需人工打开地址确认最终视觉和点击体验。

## 回滚

- 前端代码回滚：将 GitHub `main` 回退到上一稳定提交并在 Rainbond 重新构建前端组件。
- 前端配置回滚：恢复 Rainbond 组件内上一组运行时环境变量后重启前端。
- 数据层回滚：当前迁移只新增 Demo 表和种子数据；不要直接删除生产数据。需要清理时先备份，再按表级计划执行。

## 故障记录

- 2026-07-19：首次静态构建曾把 `/config.js` 的 SPA 回退 HTML 缓存在浏览器中，导致后续页面报 `Unexpected token '<'` 并缺少 InsForge 配置。入口现改用版本化配置地址，且入口 HTML 与运行时配置均设置为 `no-store`，防止旧构建响应继续被复用。
