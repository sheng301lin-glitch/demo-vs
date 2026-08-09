export type TaskAction = 'cancel' | 'retry' | 'priority'

const NODE_LABELS: Record<string, string> = {
  context: '需求解析',
  material: '素材检索',
  prompt_builder: '提示构建',
  generator: '内容生成',
  quality: '质量评估',
  feedback: '优化迭代',
  image_plan: '配图规划',
  image_generator: '图片生成',
  storage: '结果入库',
}

export function getTaskStage(node: string | null, status: string): string {
  if (status === 'SUCCESS' || status === 'PARTIAL_SUCCESS') return '已完成'
  if (status === 'FAILED') return '执行失败'
  if (status === 'CANCELLED') return '已取消'
  if (!node) return status === 'QUEUED' ? '排队中' : '等待处理'
  return NODE_LABELS[node] ?? node
}

export function isTaskControllable(status: string, action: TaskAction): boolean {
  if (action === 'priority') return status === 'PENDING' || status === 'QUEUED'
  if (action === 'cancel') return ['PENDING', 'QUEUED', 'RUNNING'].includes(status)
  return status === 'FAILED' || status === 'PARTIAL_SUCCESS'
}

export function formatDuration(milliseconds: number | null | undefined): string {
  if (milliseconds == null) return '暂无数据'
  const seconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}分${rest}秒` : `${rest}秒`
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) return '暂无数据'
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
