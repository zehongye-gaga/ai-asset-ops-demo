import { insforge } from './lib/insforge';
import type { ApprovalRequest, Asset, AssetScope, AssetType, DashboardData } from './types';

function throwIfError(error: Error | null, context: string) {
  if (error) throw new Error(`${context}：${error.message}`);
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [assetResult, approvalResult, eventResult] = await Promise.all([
    insforge.database.from('assets').select().order('calls', { ascending: false }),
    insforge.database
      .from('approval_requests')
      .select()
      .order('submitted_at', { ascending: false }),
    insforge.database.from('activity_events').select().order('created_at', { ascending: false }).limit(12),
  ]);

  throwIfError(assetResult.error, '读取资产失败');
  throwIfError(approvalResult.error, '读取审批失败');
  throwIfError(eventResult.error, '读取动态失败');

  return {
    assets: (assetResult.data || []) as Asset[],
    approvals: (approvalResult.data || []) as ApprovalRequest[],
    events: (eventResult.data || []) as DashboardData['events'],
  };
}

export async function createAsset(input: {
  name: string;
  assetType: AssetType;
  scope: AssetScope;
  description: string;
}) {
  const { data, error } = await insforge.database
    .from('assets')
    .insert({
      name: input.name,
      asset_type: input.assetType,
      scope: input.scope,
      source: 'AI 资产运营系统',
      status: 'online',
      lifecycle: '开发调试中',
      owner_name: '叶泽宏',
      team_name: 'AI 创新中心',
      domain: '技术研发',
      calls: 0,
      success_rate: 100,
      avg_latency: 0,
      monthly_cost: 0,
      version: 'v1.0.0',
      description: input.description,
      is_online: true,
    })
    .select();
  throwIfError(error, '创建资产失败');
  return data?.[0] as Asset;
}

export async function submitPromotion(asset: Asset) {
  const targetScope: AssetScope = asset.scope === 'personal' ? 'team' : 'common';
  const approverRole = asset.scope === 'personal' ? 'team_admin' : 'system_admin';
  const { error } = await insforge.database.from('approval_requests').insert({
    asset_id: asset.id,
    asset_name: asset.name,
    requester: asset.owner_name,
    from_scope: asset.scope,
    target_scope: targetScope,
    status: 'pending',
    approver_role: approverRole,
    note: `申请将「${asset.name}」晋级为${targetScope === 'team' ? '团队' : '通用'}资产`,
  });
  throwIfError(error, '提交晋级失败');
}

export async function handleApproval(request: ApprovalRequest, approve: boolean) {
  const handledAt = new Date().toISOString();
  const { data: assetRows, error: lookupError } = await insforge.database
    .from('assets')
    .select()
    .eq('id', request.asset_id);
  throwIfError(lookupError, '读取待审批资产失败');
  const asset = assetRows?.[0] as Asset | undefined;

  const { error: approvalError } = await insforge.database
    .from('approval_requests')
    .update({ status: approve ? 'approved' : 'rejected', handled_at: handledAt })
    .eq('id', request.id);
  throwIfError(approvalError, '更新审批失败');

  if (approve) {
    const { error: assetError } = await insforge.database
      .from('assets')
      .update({ scope: request.target_scope, updated_at: handledAt })
      .eq('id', request.asset_id);
    throwIfError(assetError, '更新资产范围失败');
  }

  const { error: eventError } = await insforge.database.from('activity_events').insert({
    event_type: 'approval',
    title: approve ? '资产晋级已通过' : '资产晋级已驳回',
    detail: `${request.asset_name} · ${request.from_scope} → ${request.target_scope}`,
    asset_type: asset?.asset_type || 'agent',
    severity: approve ? 'success' : 'warning',
  });
  throwIfError(eventError, '记录审批动态失败');
}
