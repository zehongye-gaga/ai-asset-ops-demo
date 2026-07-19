import type { ApprovalRequest, Asset, AssetScope, AssetType, CockpitView, Role, ScopeFilter } from './types';

export const CURRENT_USER = 'Alex Chen';
export const LEGACY_CURRENT_USER_NAMES = ['叶泽宏'] as const;
export const CURRENT_USER_NAMES = [CURRENT_USER, ...LEGACY_CURRENT_USER_NAMES] as const;
export const CURRENT_TEAM = '研发中心';

export function isCurrentUserName(name: string, currentUser = CURRENT_USER) {
  if (name === currentUser) return true;
  return currentUser === CURRENT_USER && LEGACY_CURRENT_USER_NAMES.some((legacyName) => legacyName === name);
}

export function displayUserName(name: string) {
  return LEGACY_CURRENT_USER_NAMES.some((legacyName) => legacyName === name) ? CURRENT_USER : name;
}

export function displayUserReferences(value: string) {
  return LEGACY_CURRENT_USER_NAMES.reduce(
    (displayValue, legacyName) => displayValue.replaceAll(legacyName, CURRENT_USER),
    value,
  );
}

export const roleMeta: Record<Role, {
  label: string;
  shortLabel: string;
  boundary: string;
  responsibility: string;
}> = {
  system_admin: {
    label: '系统管理员',
    shortLabel: '系统管理',
    boundary: '全组织资产可管理，并承担审批兜底与风险处置责任',
    responsibility: '平台安全、全局配置、例外处置与全部审批兜底',
  },
  operator: {
    label: '运营人员',
    shortLabel: '平台运营',
    boundary: '管理通用资产；团队资产只读；本人个人资产可管理',
    responsibility: '通用资产运营、团队资产晋级通用与运营质量治理',
  },
  team_admin: {
    label: '团队管理员',
    shortLabel: '团队管理',
    boundary: '管理当前团队资产；通用资产只读；本人个人资产可管理',
    responsibility: '团队资产管理、个人资产晋级团队与团队风险处置',
  },
  personal: {
    label: '个人用户',
    shortLabel: '个人',
    boundary: '仅管理本人个人资产；团队和通用资产保持只读',
    responsibility: '维护个人资产，并对资产质量和晋级材料负责',
  },
};

export const scopeLabels: Record<AssetScope, string> = {
  common: '通用资产',
  team: '团队资产',
  personal: '个人资产',
};

export function getDefaultScope(role: Role): ScopeFilter {
  if (role === 'personal') return 'personal';
  if (role === 'team_admin') return 'team';
  return 'common';
}

export function getCreateScopes(role: Role): AssetScope[] {
  if (role === 'system_admin') return ['common', 'team', 'personal'];
  if (role === 'operator') return ['common', 'personal'];
  if (role === 'team_admin') return ['team', 'personal'];
  return ['personal'];
}

export function getCockpitViews(role: Role): CockpitView[] {
  if (role === 'system_admin') return ['global', 'team', 'personal'];
  if (role === 'operator') return ['global', 'team'];
  if (role === 'team_admin') return ['team', 'personal'];
  return ['personal'];
}

export function canCreateInScope(role: Role, scope: AssetScope) {
  return getCreateScopes(role).includes(scope);
}

export function getCreateAssetTypes(role: Role, scope: AssetScope): AssetType[] {
  const allTypes: AssetType[] = ['agent', 'application', 'skill', 'knowledge', 'mcp'];
  if (role === 'operator' && scope === 'common') return ['skill', 'knowledge', 'mcp'];
  return allTypes;
}

export function canCreateAsset(role: Role, scope: AssetScope, type: AssetType) {
  return canCreateInScope(role, scope) && getCreateAssetTypes(role, scope).includes(type);
}

function isOwnedByCurrentUser(asset: Asset, currentUser: string) {
  return isCurrentUserName(asset.owner_name, currentUser);
}

export function canViewAsset(
  role: Role,
  asset: Asset,
  currentUser = CURRENT_USER,
  currentTeam = CURRENT_TEAM,
) {
  if (role === 'system_admin') return true;
  if (role === 'operator') {
    return asset.scope !== 'personal' || isOwnedByCurrentUser(asset, currentUser);
  }
  if (asset.scope === 'common') return true;
  if (asset.scope === 'team') return asset.team_name === currentTeam;
  if (role === 'team_admin') {
    return asset.team_name === currentTeam || isOwnedByCurrentUser(asset, currentUser);
  }
  return isOwnedByCurrentUser(asset, currentUser);
}

export function canManageAsset(role: Role, asset: Asset, currentUser = CURRENT_USER) {
  if (role === 'system_admin') return true;
  if (role === 'operator') {
    return asset.scope === 'common' || (asset.scope === 'personal' && isOwnedByCurrentUser(asset, currentUser));
  }
  if (role === 'team_admin') {
    return (asset.scope === 'team' && asset.team_name === CURRENT_TEAM)
      || (asset.scope === 'personal' && isOwnedByCurrentUser(asset, currentUser));
  }
  return asset.scope === 'personal' && isOwnedByCurrentUser(asset, currentUser);
}

export function canPromoteAsset(role: Role, asset: Asset, currentUser = CURRENT_USER) {
  if (role === 'personal') {
    return asset.scope === 'personal' && isOwnedByCurrentUser(asset, currentUser);
  }
  return role === 'team_admin' && asset.scope === 'team' && asset.team_name === CURRENT_TEAM;
}

export function canHandleApproval(role: Role, request: ApprovalRequest, asset?: Asset) {
  if (request.status !== 'pending') return false;
  if (role === 'system_admin') return true;
  if (role === 'operator') return request.approver_role === 'system_admin';
  return role === 'team_admin'
    && request.approver_role === 'team_admin'
    && asset?.team_name === CURRENT_TEAM;
}

export function isApprovalVisible(
  role: Role,
  request: ApprovalRequest,
  asset?: Asset,
  currentUser = CURRENT_USER,
) {
  if (role === 'system_admin') return true;
  if (isCurrentUserName(request.requester, currentUser)) return true;
  if (role === 'operator') return request.approver_role === 'system_admin';
  if (role === 'team_admin') {
    return request.approver_role === 'team_admin' && asset?.team_name === CURRENT_TEAM;
  }
  return false;
}

export function getAssetAccess(role: Role, asset: Asset, currentUser = CURRENT_USER) {
  if (canManageAsset(role, asset, currentUser)) {
    return {
      level: 'manage' as const,
      label: '可管理',
      reason: `${roleMeta[role].label}在当前范围内拥有管理权限`,
    };
  }
  const teamMismatch = role === 'team_admin' && asset.scope === 'team' && asset.team_name !== CURRENT_TEAM;
  return {
    level: 'read' as const,
    label: '只读',
    reason: teamMismatch
      ? `资产归属${asset.team_name}，不在当前团队${CURRENT_TEAM}`
      : `${scopeLabels[asset.scope]}超出${roleMeta[role].label}的管理边界`,
  };
}

export function getPromotionTarget(asset: Asset) {
  if (asset.scope === 'personal') {
    return { scope: 'team' as const, label: '团队资产', approver: '团队管理员' };
  }
  return { scope: 'common' as const, label: '通用资产', approver: '运营人员 / 系统管理员' };
}

export function getApprovalResponsibility(request: ApprovalRequest) {
  return request.approver_role === 'team_admin'
    ? '团队管理员 · 个人资产准入'
    : '运营人员 / 系统管理员 · 通用资产准入';
}
