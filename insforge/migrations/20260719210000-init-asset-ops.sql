CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('agent', 'application', 'skill', 'knowledge', 'mcp')),
  scope text NOT NULL CHECK (scope IN ('common', 'team', 'personal')),
  source text NOT NULL,
  status text NOT NULL,
  lifecycle text NOT NULL,
  owner_name text NOT NULL,
  team_name text NOT NULL,
  domain text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  success_rate numeric(5,2) NOT NULL DEFAULT 100,
  avg_latency numeric(10,2) NOT NULL DEFAULT 0,
  monthly_cost numeric(12,2) NOT NULL DEFAULT 0,
  version text NOT NULL DEFAULT 'v1.0.0',
  description text NOT NULL DEFAULT '',
  is_online boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  asset_name text NOT NULL,
  requester text NOT NULL,
  from_scope text NOT NULL CHECK (from_scope IN ('common', 'team', 'personal')),
  target_scope text NOT NULL CHECK (target_scope IN ('common', 'team', 'personal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_role text NOT NULL CHECK (approver_role IN ('team_admin', 'system_admin')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  note text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('agent', 'application', 'skill', 'knowledge', 'mcp')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_events TO anon, authenticated;

INSERT INTO public.assets
  (name, asset_type, scope, source, status, lifecycle, owner_name, team_name, domain, calls, success_rate, avg_latency, monthly_cost, version, description, is_online)
VALUES
  ('智能客服助手', 'agent', 'common', 'Dify', 'online', '正式运营', '平台运营组', '平台运营部', '客户服务', 284520, 99.42, 1.28, 8450, 'v3.2.1', '覆盖官网、企微与热线的统一智能客服', true),
  ('研发代码助手', 'agent', 'team', 'OpenCode', 'online', '正式运营', '陈曦', '研发中心', '技术研发', 186340, 98.81, 2.16, 6220, 'v2.8.0', '研发团队代码生成、审查与知识问答助手', true),
  ('营销内容官', 'agent', 'personal', '大头虾个人虾', 'online', '灰度运行', '林悦', '品牌市场部', '市场营销', 86, 97.95, 3.42, 380, 'v0.9.4', '面向活动策划与社媒内容的个人智能体', true),
  ('合同审查专员', 'agent', 'team', '大头虾领域虾', 'online', '正式运营', '法务数字化组', '法务部', '法务风控', 92450, 99.12, 4.81, 3980, 'v2.1.0', '合同风险条款识别与修改建议', true),
  ('经营分析助手', 'agent', 'common', 'Dify', 'online', '正式运营', '数据中台', '财务管理部', '经营管理', 156780, 99.58, 1.86, 5180, 'v4.0.2', '集团经营指标查询与归因分析', true),
  ('智能会议纪要', 'application', 'common', 'Ccoder', 'online', '成熟运行', '协同产品组', '数字化部', '协同办公', 238900, 99.76, 0.92, 2650, 'v5.1.0', '会议录音转写、摘要与任务分发', true),
  ('巡检工单 Copilot', 'application', 'team', '第三方纳管', 'online', '试点推广', '王工', '生产运营部', '生产运营', 780, 98.32, 2.76, 920, 'v1.3.0', '生产巡检工单识别与处置建议', true),
  ('文档结构化解析', 'skill', 'common', 'Skills 市集', 'published', '已发布', '知识工程组', '技术平台部', '知识工程', 412680, 99.71, 0.38, 760, 'v2.4.3', 'PDF、Word 与网页结构化解析能力', true),
  ('企业信息查询', 'skill', 'team', '自研', 'published', '已发布', '数据产品组', '市场风控部', '数据服务', 198420, 98.92, 0.64, 1280, 'v1.7.0', '企业工商与风险信息聚合查询', true),
  ('舆情情感分析', 'skill', 'personal', 'Skills 市集', 'draft', '草稿', '赵宁', '品牌市场部', '市场营销', 36, 96.80, 1.21, 45, 'v0.3.0', '社媒文本情感分类与风险提示', false),
  ('集团制度知识库', 'knowledge', 'common', '知识中台', 'online', '持续运营', '知识运营组', '人力资源部', '企业知识', 267530, 99.88, 0.31, 1860, '2026.07', '集团制度、流程与办事指南统一知识库', true),
  ('研发规范知识库', 'knowledge', 'team', '知识中台', 'online', '持续运营', '架构委员会', '研发中心', '技术研发', 143880, 99.62, 0.42, 980, '2026.06', '研发规范、架构决策与故障复盘', true),
  ('GitHub MCP', 'mcp', 'common', '官方', 'published', '已发布', '开发者平台', '技术平台部', '研发工具', 346700, 99.91, 0.51, 1460, 'v1.9.2', '仓库、Issue、PR 与 Actions 操作工具集', true),
  ('数据查询 MCP', 'mcp', 'team', '自建', 'published', '已发布', '数据中台', '数据智能部', '数据服务', 221630, 99.36, 0.83, 2380, 'v2.2.0', '受控 SQL 查询与指标语义层工具', true),
  ('客户洞察 MCP', 'mcp', 'personal', '社区', 'review', '审核中', '周衡', '客户成功部', '客户服务', 64, 97.24, 1.44, 80, 'v0.8.1', '客户旅程与健康度洞察工具', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.approval_requests
  (asset_id, asset_name, requester, from_scope, target_scope, status, approver_role, submitted_at, note)
SELECT id, name, owner_name, 'personal', 'team', 'pending', 'team_admin', now() - interval '18 minutes', '申请加入品牌市场团队资产库'
FROM public.assets WHERE name = '营销内容官'
ON CONFLICT DO NOTHING;

INSERT INTO public.approval_requests
  (asset_id, asset_name, requester, from_scope, target_scope, status, approver_role, submitted_at, note)
SELECT id, name, owner_name, 'personal', 'team', 'pending', 'team_admin', now() - interval '2 hours', '试点效果良好，申请团队共享'
FROM public.assets WHERE name = '客户洞察 MCP'
ON CONFLICT DO NOTHING;

INSERT INTO public.activity_events (event_type, title, detail, asset_type, severity, created_at) VALUES
  ('deploy', '智能客服助手发布新版本', 'v3.2.1 已完成灰度并全量上线', 'agent', 'success', now() - interval '4 minutes'),
  ('approval', '团队资产晋级申请', '营销内容官申请进入品牌市场部资产库', 'agent', 'warning', now() - interval '18 minutes'),
  ('alert', '响应时长波动', '合同审查专员平均响应升至 4.81 秒', 'agent', 'warning', now() - interval '42 minutes'),
  ('version', 'Skill 稳定版更新', '文档结构化解析 v2.4.3 标记为 stable', 'skill', 'success', now() - interval '1 hour'),
  ('publish', 'MCP 工具新增', 'GitHub MCP 新增 Actions 日志分析工具', 'mcp', 'info', now() - interval '3 hours'),
  ('sync', '知识库同步完成', '研发规范知识库新增 126 个条目', 'knowledge', 'success', now() - interval '5 hours');
