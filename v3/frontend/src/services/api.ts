import axios from 'axios'
import type {
  KolConfig,
  WalletConfig,
  TelegramGroupConfig,
  SystemConfigItem,
  HealthResponse,
} from './types'

const api = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// ── KOL ──────────────────────────────────────────────

export async function getKols(is_active?: boolean): Promise<KolConfig[]> {
  const { data } = await api.get('/api/config/kols', { params: { is_active } })
  return data
}

export async function createKol(payload: Partial<KolConfig>): Promise<KolConfig> {
  const { data } = await api.post('/api/config/kols', payload)
  return data
}

export async function updateKol(id: number, payload: Partial<KolConfig>): Promise<KolConfig> {
  const { data } = await api.put(`/api/config/kols/${id}`, payload)
  return data
}

export async function deleteKol(id: number): Promise<void> {
  await api.delete(`/api/config/kols/${id}`)
}

// ── Wallets ──────────────────────────────────────────

export async function getWallets(is_active?: boolean): Promise<WalletConfig[]> {
  const { data } = await api.get('/api/config/wallets', { params: { is_active } })
  return data
}

export async function createWallet(payload: Partial<WalletConfig>): Promise<WalletConfig> {
  const { data } = await api.post('/api/config/wallets', payload)
  return data
}

export async function updateWallet(id: number, payload: Partial<WalletConfig>): Promise<WalletConfig> {
  const { data } = await api.put(`/api/config/wallets/${id}`, payload)
  return data
}

export async function deleteWallet(id: number): Promise<void> {
  await api.delete(`/api/config/wallets/${id}`)
}

// ── Telegram Groups ──────────────────────────────────

export async function getTelegramGroups(is_active?: boolean): Promise<TelegramGroupConfig[]> {
  const { data } = await api.get('/api/config/telegram-groups', { params: { is_active } })
  return data
}

export async function createTelegramGroup(payload: Partial<TelegramGroupConfig>): Promise<TelegramGroupConfig> {
  const { data } = await api.post('/api/config/telegram-groups', payload)
  return data
}

export async function updateTelegramGroup(id: number, payload: Partial<TelegramGroupConfig>): Promise<TelegramGroupConfig> {
  const { data } = await api.put(`/api/config/telegram-groups/${id}`, payload)
  return data
}

export async function deleteTelegramGroup(id: number): Promise<void> {
  await api.delete(`/api/config/telegram-groups/${id}`)
}

// ── System Config ────────────────────────────────────

export async function getSystemConfigs(): Promise<SystemConfigItem[]> {
  const { data } = await api.get('/api/config/system')
  return data
}

export async function getSystemConfig(key: string): Promise<SystemConfigItem> {
  const { data } = await api.get(`/api/config/system/${key}`)
  return data
}

export async function updateSystemConfig(key: string, value: any): Promise<SystemConfigItem> {
  const { data } = await api.put(`/api/config/system/${key}`, { value })
  return data
}

// ── Health ───────────────────────────────────────────

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get('/api/system/health')
  return data
}
