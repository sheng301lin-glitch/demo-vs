import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeneratorPage } from './Generator'
import { TasksPage } from './Tasks'
import { ContentListPage } from './ContentList'
import { estimateTask, fetchTaskDetail, fetchTaskEvents, fetchTasks } from '../api/endpoints'

vi.mock('../api/endpoints', async () => {
  const actual = await vi.importActual<typeof import('../api/endpoints')>('../api/endpoints')
  return {
    ...actual,
    fetchHealth: vi.fn().mockResolvedValue({ data: { status: 'ok', db: 'connected', redis: 'connected' } }),
    fetchTasks: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 20 } }),
    fetchTaskStatistics: vi.fn().mockResolvedValue({ data: { total: 0, queued: 0, running: 0, retrying: 0, failed: 0, completed: 0, average_wait_ms: null, queue_depth: 0, queue_health: 'healthy', trend: [] } }),
    fetchTaskDetail: vi.fn(),
    fetchTaskEvents: vi.fn().mockResolvedValue({ data: [] }),
    fetchContentGroups: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 20 } }),
    fetchContentStatistics: vi.fn().mockResolvedValue({ data: { total_groups: 0, today_new_groups: 0, average_current_score: null, optimized_groups: 0, archived_groups: 0, status_distribution: {}, score_distribution: {}, daily_trend: [] } }),
    fetchMaterials: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 20 } }),
    estimateTask: vi.fn().mockResolvedValue({ data: { estimated_tokens: null, estimated_duration_seconds: null, estimated_cost: null, confidence: 'LOW' } }),
  }
})

afterEach(() => cleanup())

function renderPage(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{element}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('core workspace pages', () => {
  it('renders the five-section task creation workflow and live summary', () => {
    renderPage(<GeneratorPage />)
    expect(screen.getByText('基础信息')).toBeInTheDocument()
    expect(screen.getByText('素材与文件')).toBeInTheDocument()
    expect(screen.getByText('任务摘要')).toBeInTheDocument()
  })

  it('renders queue KPIs and the task detail workspace', async () => {
    renderPage(<TasksPage />)
    expect(await screen.findByText('队列健康度')).toBeInTheDocument()
    expect(screen.getByText('全部任务')).toBeInTheDocument()
  })

  it('renders content KPIs and score distribution', async () => {
    renderPage(<ContentListPage />)
    expect(await screen.findByText('平均评分')).toBeInTheDocument()
    expect(screen.getByText('评分分布')).toBeInTheDocument()
  })

  it('validates required form fields and requests a server estimate', async () => {
    renderPage(<GeneratorPage />)
    await screen.findByText('运行服务正常')

    fireEvent.click(screen.getByRole('button', { name: '立即创建' }))

    expect(await screen.findByText('请输入任务名称')).toBeInTheDocument()
    expect(screen.getByText('请输入内容方向')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(estimateTask)).toHaveBeenCalledWith({ generate_count: 10, platform: 'XHS' }))
  })

  it('sends task filters to the server query', async () => {
    renderPage(<TasksPage />)
    await screen.findByText('队列健康度')

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'XHS' } })

    await waitFor(() => expect(vi.mocked(fetchTasks)).toHaveBeenLastCalledWith(expect.objectContaining({ platform: 'XHS' })))
  })

  it('opens task detail and enforces failed-task control permissions', async () => {
    const listItem = { task_id: 'task_failed', task_name: '失败任务', task_type: 'GENERATE', platform: 'XHS', priority: 'NORMAL', status: 'FAILED', current_node: 'generator', progress: 40, requested_count: 2, success_count: 1, failed_count: 1, retry_count: 0, created_at: '2026-08-09T10:00:00' }
    vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [listItem], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...listItem, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: {}, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
    vi.mocked(fetchTaskEvents).mockResolvedValueOnce({ data: [] } as never)
    renderPage(<TasksPage />)

    fireEvent.click(await screen.findByText('失败任务'))

    expect(await screen.findByText('任务详情')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重试' })).toBeEnabled()
  })
})
