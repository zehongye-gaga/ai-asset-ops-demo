import { createClient } from '@insforge/sdk';

const config = window.__APP_CONFIG__;

if (!config?.insforgeBaseUrl || !config.insforgeAnonKey) {
  throw new Error('缺少 INSFORGE_BASE_URL 或 INSFORGE_ANON_KEY，请检查组件运行环境变量。');
}

export const insforge = createClient({
  baseUrl: config.insforgeBaseUrl,
  anonKey: config.insforgeAnonKey,
});
