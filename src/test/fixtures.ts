import type { ActivityEvent, ApprovalRequest, Asset } from '../types';

export function assetFixture(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    name: '测试资产',
    asset_type: 'agent',
    scope: 'team',
    source: '自研',
    status: 'online',
    lifecycle: '正式运营',
    owner_name: '叶泽宏',
    team_name: 'AI 创新中心',
    domain: '技术研发',
    calls: 100,
    success_rate: 99,
    avg_latency: 1.2,
    monthly_cost: 20,
    version: 'v1.0.0',
    description: '测试资产说明',
    is_online: true,
    updated_at: '2026-07-19T00:00:00Z',
    created_at: '2026-07-19T00:00:00Z',
    ...overrides,
  };
}

export function approvalFixture(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'approval-1',
    asset_id: 'asset-1',
    asset_name: '测试资产',
    requester: '叶泽宏',
    from_scope: 'personal',
    target_scope: 'team',
    status: 'pending',
    approver_role: 'team_admin',
    submitted_at: '2026-07-18T12:00:00Z',
    handled_at: null,
    note: '申请晋级',
    ...overrides,
  };
}

export function eventFixture(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'event-1',
    event_type: 'approval',
    title: '资产晋级已通过',
    detail: '测试资产 · personal → team',
    asset_type: 'agent',
    severity: 'success',
    created_at: '2026-07-19T00:00:00Z',
    ...overrides,
  };
}
