// ============================================================================
// API 函数 - 封装所有后端接口调用
// ============================================================================
import { apiClient } from './client'
import type {
  APIResponse,
  GenerateTaskRequest,
  OptimizeTaskRequest,
  TaskCreated,
  TaskDetail,
  TaskEventItem,
  TaskListItem,
  HealthStatus,
  ModelConfig,
  CapabilityRoute,
  ContentGroupDetail,
  ContentGroupListResponse,
  ContentTaskListResponse,
  ContentResultItem,
  TaskStatistics,
  ContentStatistics,
  TaskEstimate,
  MaterialItem,
} from '../types'

// ── 健康检查 ──
export async function fetchHealth(): Promise<APIResponse<HealthStatus>> {
  return apiClient.get('/health')
}

// ── 内容生成 ──
export async function createGenerateTask(
  req: GenerateTaskRequest
): Promise<APIResponse<TaskCreated>> {
  return apiClient.post('/content/generate', req)
}

// ── 任务管理 ──
export async function fetchTasks(params?: {
  status?: string
  platform?: string
  priority?: string
  current_node?: string
  task_type?: string
  model?: string
  keyword?: string
  created_from?: string
  created_to?: string
  sort?: 'created_asc' | 'created_desc'
  page?: number
  size?: number
}): Promise<APIResponse<{ items: TaskListItem[]; total: number; page: number; size: number }>> {
  return apiClient.get('/tasks', { params })
}

export async function fetchTaskStatistics(): Promise<APIResponse<TaskStatistics>> {
  return apiClient.get('/tasks/statistics')
}

export async function updateTaskPriority(taskId: string, priority: 'LOW' | 'NORMAL' | 'HIGH') {
  return apiClient.patch(`/tasks/${taskId}/priority`, { priority })
}

export async function estimateTask(params: {
  generate_count: number
  platform?: string
  model_id?: string
}): Promise<APIResponse<TaskEstimate>> {
  return apiClient.post('/tasks/estimate', params)
}

export async function fetchTaskDetail(
  taskId: string
): Promise<APIResponse<TaskDetail>> {
  return apiClient.get(`/tasks/${taskId}`)
}

export async function cancelTask(
  taskId: string
): Promise<APIResponse<{ task_id: string; status: string; message: string }>> {
  return apiClient.post(`/tasks/${taskId}/cancel`)
}

export async function retryTask(
  taskId: string
): Promise<APIResponse<{ task_id: string; new_status: string; retry_count: number }>> {
  return apiClient.post(`/tasks/${taskId}/retry`)
}

// ── 模型管理 ──
export async function fetchModels(): Promise<APIResponse<ModelConfig[]>> {
  return apiClient.get('/admin/models')
}

export async function fetchRoutes(): Promise<APIResponse<CapabilityRoute[]>> {
  return apiClient.get('/admin/model-routes')
}

// ── 内容管理 ──
export async function fetchContentGroups(params?: {
  task_id?: string
  task_name?: string
  platform?: string
  status?: string
  keyword?: string
  score_min?: number
  score_max?: number
  created_from?: string
  created_to?: string
  page?: number
  size?: number
}): Promise<APIResponse<ContentGroupListResponse>> {
  return apiClient.get('/content/groups', { params })
}

export async function fetchContentTasks(params?: {
  platform?: string
  keyword?: string
  task_status?: string
  page?: number
  size?: number
}): Promise<APIResponse<ContentTaskListResponse>> {
  return apiClient.get('/content/tasks', { params })
}

export async function fetchContentStatistics(): Promise<APIResponse<ContentStatistics>> {
  return apiClient.get('/content/groups/statistics')
}

export async function fetchMaterials(params?: { keyword?: string; page?: number; size?: number }): Promise<APIResponse<{ items: MaterialItem[]; total: number; page: number; size: number }>> {
  return apiClient.get('/materials', { params })
}

export async function uploadMaterial(file: File, platform?: string): Promise<APIResponse<MaterialItem>> {
  const form = new FormData()
  form.append('file', file)
  if (platform) form.append('platform', platform)
  return apiClient.post('/materials/files', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export async function fetchTaskContent(
  taskId: string
): Promise<APIResponse<ContentGroupDetail[]>> {
  return apiClient.get(`/tasks/${taskId}/content`)
}

export async function fetchContentGroupDetail(
  groupId: string
): Promise<APIResponse<ContentGroupDetail>> {
  return apiClient.get(`/content/groups/${groupId}`)
}

export async function fetchContentVersions(
  groupId: string
): Promise<APIResponse<ContentResultItem[]>> {
  return apiClient.get(`/content/groups/${groupId}/versions`)
}

export async function archiveContentGroup(
  groupId: string
): Promise<APIResponse<{ group_id: string; status: string }>> {
  return apiClient.post(`/content/groups/${groupId}/archive`)
}

// ── 任务事件 ──
export async function fetchTaskEvents(
  taskId: string,
  params?: { page?: number; size?: number }
): Promise<APIResponse<TaskEventItem[]>> {
  return apiClient.get(`/tasks/${taskId}/events`, { params })
}

// ── 内容优化 ──
export async function createOptimizeTask(
  req: OptimizeTaskRequest
): Promise<APIResponse<TaskCreated>> {
  return apiClient.post('/content/optimize', req)
}
