export type AssetType = 'agent' | 'application' | 'skill' | 'knowledge' | 'mcp';
export type AssetScope = 'common' | 'team' | 'personal';
export type Role = 'personal' | 'team_admin' | 'operator' | 'system_admin';
export type ScopeFilter = AssetScope | 'all';
export type CockpitView = 'global' | 'team' | 'personal';

export interface ActionContext {
  actorName: string;
  actorRole: Role;
}

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  scope: AssetScope;
  source: string;
  status: string;
  lifecycle: string;
  owner_name: string;
  team_name: string;
  domain: string;
  calls: number;
  success_rate: number;
  avg_latency: number;
  monthly_cost: number;
  version: string;
  description: string;
  is_online: boolean;
  updated_at: string;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  asset_id: string;
  asset_name: string;
  requester: string;
  from_scope: AssetScope;
  target_scope: AssetScope;
  status: 'pending' | 'approved' | 'rejected';
  approver_role: 'team_admin' | 'system_admin';
  submitted_at: string;
  handled_at: string | null;
  note: string;
}

export interface ActivityEvent {
  id: string;
  event_type: string;
  title: string;
  detail: string;
  asset_type: AssetType;
  severity: 'info' | 'success' | 'warning';
  created_at: string;
}

export interface DashboardData {
  assets: Asset[];
  approvals: ApprovalRequest[];
  events: ActivityEvent[];
}
