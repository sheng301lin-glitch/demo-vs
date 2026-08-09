// ============================================================================
// API 类型定义 - 与 Python Agent Runtime 后端对齐
// ============================================================================

// --- 通用响应 ---
export interface APIResponse<T> {
  code: number
  message: string
  request_id: string
  data: T | null
  timestamp: string
}

// --- 需求描述 ---
export interface Requirement {
  content_direction: string
  target_audience: string
  tone_style: string
  keywords: string[]
  banned_words: string[]
  content_goal: string
  additional_instruction: string
}

// --- 参考资料 ---
export interface Resources {
  material_ids: string[]
  urls: string[]
  file_refs: string[]
}

// --- 质量控制 ---
export interface QualityConfig {
  route_strategy: string
  threshold: number
  enable_evaluation: boolean
  enable_auto_optimize: boolean
  max_iteration: number
}

// --- 图片生成配置 ---
export interface ImageGenerationConfig {
  enabled: boolean
  count_per_content: number
  aspect_ratio: string
  style_prompt: string | null
  route_strategy: string
  failure_policy: string
}

// --- 执行配置 ---
export interface ExecutionConfig {
  mode: string
  scheduled_at: string | null
}

// --- 生成任务请求 ---
export interface GenerateTaskRequest {
  request_id: string
  idempotency_key?: string | null
  task_name: string
  platform: string
  generate_count: number
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  requirement: Requirement
  resources?: Resources
  quality?: QualityConfig
  image_generation?: ImageGenerationConfig
  execution?: ExecutionConfig
}

// --- 任务创建响应 ---
export interface TaskCreated {
  task_id: string
  status: string
  accepted: boolean
}

// --- 任务详情 ---
export interface TaskDetail {
  task_id: string
  request_id: string
  task_name: string
  task_type: string
  platform: string
  priority: string
  status: string
  current_node: string | null
  progress: number
  requested_count: number
  success_count: number
  failed_count: number
  current_iteration: number
  max_iteration: number
  retry_count: number
  error_code: string | null
  error_message: string | null
  input_params: Record<string, unknown> | null
  image_requested_count: number
  image_success_count: number
  image_failed_count: number
  created_at: string | null
  queued_at: string | null
  started_at: string | null
  completed_at: string | null
  queue_wait_ms: number | null
  estimated_completion_at: string | null
  model_summary: string[]
  usage_summary: {
    total_cost?: number
    total_input_tokens?: number
    total_output_tokens?: number
    total_calls?: number
  }
}

// --- 模型配置 ---
export interface ModelConfig {
  model_id: string
  provider: string
  model_name: string
  display_name: string
  base_url: string | null
  credential_ref: string | null
  max_tokens: number | null
  timeout_seconds: number
  rpm_limit: number | null
  tpm_limit: number | null
  input_price: number | null
  output_price: number | null
  extra_config: Record<string, unknown> | null
  status: string
  model_type: string
  pricing_config: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

// --- 能力路由 ---
export interface CapabilityRoute {
  route_id: string
  capability: string
  model_id: string
  priority: number
  weight: number
  fallback_order: number
  config_override: Record<string, unknown> | null
  status: string
}

// --- 健康状态 ---
export interface HealthStatus {
  status: 'ok' | 'degraded'
  db: 'connected' | 'error'
  redis: 'connected' | 'error'
}

// --- 平台列表 ---
export const PLATFORMS = [
  { value: 'XHS', label: '小红书', icon: '🔥' },
  { value: 'DOUYIN', label: '抖音', icon: '🎵' },
  { value: 'WECHAT', label: '微信公众号', icon: '💬' },
  { value: 'BILIBILI', label: 'B站', icon: '📺' },
  { value: 'WEIBO', label: '微博', icon: '📢' },
] as const

// --- 任务状态映射 ---
export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: '#6b7280' },
  QUEUED: { label: '已入队', color: '#3b82f6' },
  RUNNING: { label: '执行中', color: '#f59e0b' },
  SUCCESS: { label: '已完成', color: '#10b981' },
  PARTIAL_SUCCESS: { label: '部分成功', color: '#8b5cf6' },
  FAILED: { label: '失败', color: '#ef4444' },
  CANCELLED: { label: '已取消', color: '#9ca3af' },
}

// --- 内容结果 ---
export interface ContentResultItem {
  content_id: string
  task_id: string
  content_group_id: string
  title: string | null
  body: string
  platform: string
  version_no: number
  score: number | null
  model_name: string | null
  provider: string | null
  evaluation_detail: Record<string, unknown> | null
  media_json: Record<string, unknown> | null
  status: string
  created_at: string | null
  updated_at: string | null
}

// --- 内容组详情 ---
export interface ContentGroupDetail {
  content_group_id: string
  root_task_id: string
  latest_task_id: string
  generation_index: number
  platform: string
  current_version_no: number
  version_count: number
  status: string
  current_content: ContentResultItem | null
  created_at: string | null
  updated_at: string | null
}

// --- 内容组列表响应 ---
export interface ContentGroupListResponse {
  items: ContentGroupDetail[]
  total: number
  page: number
  size: number
}

// --- 任务事件 ---
export interface TaskEventItem {
  event_id: string
  task_id: string
  event_seq: number
  event_type: string // NODE_START | NODE_END | PROGRESS | ERROR | CONTENT_STORED
  node: string | null
  level: string
  progress: number | null
  iteration: number | null
  message: string | null
  duration_ms: number | null
  payload_json: Record<string, unknown> | null
  created_at: string | null
}

// --- 优化任务请求 ---
export interface OptimizeTaskRequest {
  request_id: string
  source_content_ids: string[]
  instruction: string
  quality: QualityConfig
  image_generation: Record<string, unknown>
}

// --- 任务列表项（精简字段，用于列表页） ---
export interface TaskListItem {
  task_id: string
  task_name: string
  task_type: string
  platform: string
  priority: string
  status: string
  progress: number
  requested_count: number
  success_count: number
  failed_count: number
  current_node: string | null
  error_message: string | null
  created_at: string | null
  queued_at: string | null
  started_at: string | null
  completed_at: string | null
}

export interface TaskTrendPoint {
  hour: string
  queued: number
  running: number
  failed: number
  completed: number
}

export interface TaskStatistics {
  total: number
  queued: number
  running: number
  retrying: number
  failed: number
  completed: number
  average_wait_ms: number | null
  queue_depth: number
  queue_health: 'healthy' | 'degraded' | 'unavailable'
  trend: TaskTrendPoint[]
}

export interface ContentStatistics {
  total_groups: number
  today_new_groups: number
  average_current_score: number | null
  optimized_groups: number
  archived_groups: number
  status_distribution: Record<string, number>
  score_distribution: Record<string, number>
  daily_trend: Array<{ date: string; count: number }>
}

export interface TaskEstimate {
  estimated_tokens: { min: number; max: number } | null
  estimated_duration_seconds: { min: number; max: number } | null
  estimated_cost: { min: number; max: number } | null
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface MaterialItem {
  material_id: string
  title: string | null
  filename: string | null
  file_ref: string | null
  parse_status: string | null
  summary: string | null
}
