// ============================================================================
// React Query Hooks - 服务端状态管理
// ============================================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchHealth,
  createGenerateTask,
  fetchTaskDetail,
  cancelTask,
  retryTask,
  fetchModels,
  fetchRoutes,
} from '../api/endpoints'

// ── 健康检查 ──
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000, // 30 秒刷新一次
  })
}

// ── 创建生成任务 ──
export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createGenerateTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task'] })
    },
  })
}

// ── 获取任务详情 ──
export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTaskDetail(taskId!),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data?.data) return false
      const status = data.data.status
      // 任务未完成时每 2 秒轮询
      return ['PENDING', 'QUEUED', 'RUNNING'].includes(status) ? 2000 : false
    },
  })
}

// ── 取消任务 ──
export function useCancelTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task'] })
    },
  })
}

// ── 重试任务 ──
export function useRetryTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: retryTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task'] })
    },
  })
}

// ── 模型列表 ──
export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: fetchModels,
  })
}

// ── 路由列表 ──
export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
  })
}
