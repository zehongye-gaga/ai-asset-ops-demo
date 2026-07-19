import type { Asset, AssetType } from '../types';

export function summarizeAssets(assets: Asset[]) {
  const onlineAssets = assets.filter((asset) => asset.is_online);
  const digitalEmployees = onlineAssets.filter(
    (asset) => asset.asset_type === 'agent' || asset.asset_type === 'application',
  ).length;
  const calls = assets.reduce((sum, asset) => sum + Number(asset.calls), 0);
  const cost = assets.reduce((sum, asset) => sum + Number(asset.monthly_cost), 0);
  const successRate = assets.length
    ? assets.reduce((sum, asset) => sum + Number(asset.success_rate), 0) / assets.length
    : 0;
  return { digitalEmployees, calls, cost, successRate, online: onlineAssets.length };
}

export function countByType(assets: Asset[]) {
  const counts: Record<AssetType, number> = {
    agent: 0,
    application: 0,
    skill: 0,
    knowledge: 0,
    mcp: 0,
  };
  assets.forEach((asset) => {
    counts[asset.asset_type] += 1;
  });
  return counts;
}
