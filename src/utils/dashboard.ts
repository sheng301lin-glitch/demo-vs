export type TaskAction = 'cancel' | 'retry' | 'priority'

export const NODE_LABELS: Record<string, string> = {
  context: '需求解析',
  material: '素材检索',
  prompt_builder: '提示构建',
  generator: '内容生成',
  quality: '质量评估',
  feedback: '优化迭代',
  image_plan: '配图规划',
  image_generator: '图片生成',
  storage: '结果入库',
  graph_start: '任务启动',
  graph_end: '任务收尾',
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

export function formatEventLabel(event_type: string, node: string | null, message: string | null): string {
  if (message) {
    // 兼容旧版本英文消息
    const oldContent = message.match(/^Content (\d+) stored$/)
    if (oldContent) return `第 ${oldContent[1]} 条内容生成完成`
    return message
  }
  const nodeLabel = node ? (NODE_LABELS[node] || node) : null
  if (event_type === 'NODE_START') return nodeLabel ? `${nodeLabel} 开始` : '节点开始'
  if (event_type === 'NODE_END') return nodeLabel ? `${nodeLabel} 完成` : '节点完成'
  if (event_type === 'PROGRESS') return '进度更新'
  if (event_type === 'ERROR') return '错误'
  if (event_type === 'CONTENT_STORED') return '内容存储'
  return event_type
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

/**
 * 将以人民币计价的费用格式化为 ¥ 显示。模型定价已统一为人民币，无需汇率转换。
 */
export function formatCNY(rmbAmount: number | null | undefined): string {
  if (rmbAmount == null || rmbAmount === 0) return '¥0.00'
  if (rmbAmount < 0.01) return `¥${rmbAmount.toFixed(6)}`
  return `¥${rmbAmount.toFixed(2)}`
}

/**
 * 将 token 数量格式化为可读的简写形式（如 12.5K、1.2M）。
 */
export function formatTokens(count: number | null | undefined): string {
  if (count == null || count === 0) return '0'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

/**
 * 将后端返回的 UTC 时间字符串格式化为北京时间显示。
 * 后端 MySQL TimestampMixin 使用 func.now()（UTC），Pydantic 序列化时不含时区标记。
 * 追加 "Z" 强制 JavaScript 按 UTC 解析后再转换为本地时间。
 */
export function formatBeijingTime(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  const date = new Date(isoString + 'Z')
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}
