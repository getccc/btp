export interface KolConfig {
  id: number
  platform: string
  username: string
  user_id: string | null
  display_name: string | null
  label: string | null
  reliability: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WalletConfig {
  id: number
  address: string
  chain: string
  label: string | null
  wallet_type: string
  reliability: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TelegramGroupConfig {
  id: number
  group_id: number | null
  group_link: string
  group_name: string | null
  group_type: string
  label: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SystemConfigItem {
  key: string
  value: any
  description: string | null
  updated_at: string
}

export interface ListResponse<T> {
  items: T[]
  total: number
}

export interface HealthResponse {
  status: string
  db: string
  redis: string
  timestamp: string
}

export interface CollectorStatus {
  name: string
  status: string
  error: string
  last_run: string
}

export interface KolTweet {
  id: number
  tweet_id: string
  username: string
  content: string
  tweet_time: string
  is_analyzed: boolean
}

export interface OnchainEvent {
  id: number
  chain: string
  event_type: string
  wallet_address: string
  from_token: string
  to_token: string
  from_amount: number
  to_amount: number
  event_time: string
}
