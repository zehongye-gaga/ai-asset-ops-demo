import type { ApprovalRequest, Asset, CockpitView, DashboardData } from './types';

const RISK_LIFECYCLES = ['审核中', '草稿', '已下线', '废弃'];
const APPROVAL_SLA_HOURS = 24;

export function filterAssetsForCockpit(
  assets: Asset[],
  view: CockpitView,
  currentUsers: string | readonly string[] = 'Alex Chen',
  currentTeam = '研发中心',
) {
  if (view === 'global') return assets;
  if (view === 'personal') {
    const userNames = new Set(typeof currentUsers === 'string' ? [currentUsers] : currentUsers);
    return assets.filter((asset) => asset.scope === 'personal' && userNames.has(asset.owner_name));
  }
  return assets.filter((asset) => asset.scope === 'team' && asset.team_name === currentTeam);
}

export function isRiskAsset(asset: Asset) {
  return !asset.is_online
    || Number(asset.success_rate) < 98
    || RISK_LIFECYCLES.some((status) => asset.lifecycle.includes(status));
}

export function approvalAgeHours(request: ApprovalRequest, now = new Date()) {
  return Math.max(0, (now.getTime() - new Date(request.submitted_at).getTime()) / 3_600_000);
}

export function getApprovalSla(request: ApprovalRequest, now = new Date()) {
  if (request.status !== 'pending') {
    return { state: 'handled' as const, label: '已处理', hours: approvalAgeHours(request, now) };
  }
  const hours = approvalAgeHours(request, now);
  if (hours >= APPROVAL_SLA_HOURS) return { state: 'overdue' as const, label: '已超时', hours };
  if (hours >= APPROVAL_SLA_HOURS * 0.75) return { state: 'warning' as const, label: '临近超时', hours };
  return { state: 'healthy' as const, label: '时效正常', hours };
}

export function countByLifecycle(assets: Asset[]) {
  return assets.reduce<Record<string, number>>((counts, asset) => {
    counts[asset.lifecycle] = (counts[asset.lifecycle] || 0) + 1;
    return counts;
  }, {});
}

export function countByDomain(assets: Asset[]) {
  return assets.reduce<Record<string, { assets: number; calls: number; online: number; cost: number }>>(
    (counts, asset) => {
      const domain = asset.domain || '未分类';
      const current = counts[domain] || { assets: 0, calls: 0, online: 0, cost: 0 };
      current.assets += 1;
      current.calls += Number(asset.calls);
      current.online += asset.is_online ? 1 : 0;
      current.cost += Number(asset.monthly_cost);
      counts[domain] = current;
      return counts;
    },
    {},
  );
}

export function summarizeGovernance(data: DashboardData, assets = data.assets, now = new Date()) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  const relevantApprovals = data.approvals.filter((request) => assetIds.has(request.asset_id));
  const pending = relevantApprovals.filter((request) => request.status === 'pending');
  const overdue = pending.filter((request) => getApprovalSla(request, now).state === 'overdue');
  const warning = pending.filter((request) => getApprovalSla(request, now).state === 'warning');
  const riskAssets = assets.filter(isRiskAsset);
  const online = assets.filter((asset) => asset.is_online).length;
  const governed = assets.filter(
    (asset) => asset.owner_name && asset.team_name && asset.domain && asset.version && asset.lifecycle,
  ).length;
  const averageLatency = assets.length
    ? assets.reduce((sum, asset) => sum + Number(asset.avg_latency), 0) / assets.length
    : 0;

  return {
    pending: pending.length,
    overdue: overdue.length,
    warning: warning.length,
    riskAssets,
    onlineRate: assets.length ? (online / assets.length) * 100 : 0,
    governanceCoverage: assets.length ? (governed / assets.length) * 100 : 0,
    auditEvents: data.events.length,
    domainCount: Object.keys(countByDomain(assets)).length,
    averageLatency,
  };
}
