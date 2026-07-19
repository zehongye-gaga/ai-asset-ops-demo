import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const { loadDashboardDataMock } = vi.hoisted(() => ({
  loadDashboardDataMock: vi.fn(),
}));

vi.mock('./api', () => ({
  createAsset: vi.fn(),
  handleApproval: vi.fn(),
  loadDashboardData: loadDashboardDataMock,
  submitPromotion: vi.fn(),
}));

describe('management and cockpit layout boundary', () => {
  beforeEach(() => {
    loadDashboardDataMock.mockResolvedValue({ assets: [], approvals: [], events: [] });
    window.localStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('normalizes the root path and renders the management portal shell', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);

    expect(await screen.findByRole('navigation', { name: '主导航' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByText('当前组织')).toBeInTheDocument();
    expect(screen.getAllByText('CATL')).toHaveLength(2);
    expect(document.title).toBe('运营概览 · CATL');
    expect(screen.getByRole('link', { name: /^运营大屏/ })).toHaveAttribute('href', '/cockpit');
    expect(screen.getByRole('link', { name: /^运营大屏/ })).toHaveAttribute('target', '_blank');
    expect(screen.queryByText('ENTERPRISE ASSET GOVERNANCE COCKPIT')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/manage/overview');
  });

  it('updates the stable URL when management navigation is used', async () => {
    window.history.replaceState(null, '', '/manage/overview');
    render(<App />);
    await screen.findByRole('navigation', { name: '主导航' });

    fireEvent.click(screen.getByRole('button', { name: /统一资产目录/ }));

    expect(await screen.findByRole('heading', { name: '统一资产目录' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/manage/assets');
  });

  it('uses the global search as an entry to the asset catalog', async () => {
    window.history.replaceState(null, '', '/manage/overview');
    render(<App />);
    const search = await screen.findByRole('search');

    fireEvent.change(screen.getByRole('textbox', { name: '全局资产搜索' }), {
      target: { value: '采购助手' },
    });
    fireEvent.submit(search);

    expect(await screen.findByRole('heading', { name: '统一资产目录' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索名称、负责人、团队或业务域')).toHaveValue('采购助手');
    expect(window.location.pathname).toBe('/manage/assets');
  });

  it('responds to browser history events without losing the management shell', async () => {
    window.history.replaceState(null, '', '/manage/assets');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '统一资产目录' })).toBeInTheDocument();

    window.history.pushState(null, '', '/manage/approvals');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '资产准入与晋级审批' })).toBeInTheDocument();
    });
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
  });

  it('renders the cockpit without management navigation or global search', async () => {
    window.history.replaceState(null, '', '/cockpit');
    render(<App />);

    expect(await screen.findByText('ENTERPRISE ASSET GOVERNANCE COCKPIT')).toBeInTheDocument();
    expect(screen.getByText('CATL · AI 资产运营中心')).toBeInTheDocument();
    expect(screen.getAllByText('CATL')).toHaveLength(2);
    expect(document.title).toBe('运营大屏 · CATL');
    expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/cockpit');
  });
});
