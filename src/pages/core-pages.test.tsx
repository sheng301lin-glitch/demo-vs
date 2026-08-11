import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GeneratorPage } from './Generator'
import { TasksPage } from './Tasks'
import { ContentListPage } from './ContentList'
import { App } from '../App'
import { createGenerateTask, createOptimizeTask, estimateTask, fetchContentGroupDetail, fetchContentGroups, fetchContentTasks, fetchContentVersions, fetchTaskDetail, fetchTaskEvents, fetchTasks } from '../api/endpoints'

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
    fetchContentTasks: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 50 } }),
    fetchContentGroupDetail: vi.fn(),
    fetchContentVersions: vi.fn(),
    createOptimizeTask: vi.fn(),
    fetchContentStatistics: vi.fn().mockResolvedValue({ data: { total_groups: 0, today_new_groups: 0, average_current_score: null, optimized_groups: 0, archived_groups: 0, status_distribution: {}, score_distribution: {}, daily_trend: [] } }),
    fetchMaterials: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 20 } }),
    estimateTask: vi.fn().mockResolvedValue({ data: { estimated_tokens: null, estimated_duration_seconds: null, estimated_cost: null, confidence: 'LOW' } }),
    createGenerateTask: vi.fn(),
  }
})

afterEach(() => cleanup())

beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function HistoryBackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>返回</button>
}

function renderPage(element: React.ReactNode, initialEntries: string[] = ['/']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>{element}</QueryClientProvider>
    </MemoryRouter>,
  )
}

const failedTask = { task_id: 'task_failed', task_name: '失败任务', task_type: 'GENERATE', platform: 'XHS', priority: 'NORMAL', status: 'FAILED', current_node: 'generator', progress: 40, requested_count: 2, success_count: 1, failed_count: 1, retry_count: 0, created_at: '2026-08-09T10:00:00' }

describe('core workspace pages', () => {
  it('redirects a legacy task detail URL to the queue modal URL', async () => {
    renderPage(<><App /><LocationProbe /></>, ['/tasks/task_legacy'])
    expect(await screen.findByTestId('location')).toHaveTextContent('/tasks?task=task_legacy')
  })

  it('redirects a legacy content detail URL to the content modal URL', async () => {
    renderPage(<><App /><LocationProbe /></>, ['/content/group_legacy'])
    expect(await screen.findByTestId('location')).toHaveTextContent('/content?group=group_legacy')
  })

  it('encodes and decodes special characters in a legacy task detail URL', async () => {
    const taskId = '任务 空格/%'
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, task_id: taskId } } as never)
    renderPage(<><App /><LocationProbe /></>, [`/tasks/${encodeURIComponent(taskId)}`])
    await waitFor(() => expect(vi.mocked(fetchTaskDetail)).toHaveBeenCalledWith(taskId))
    expect(screen.getByTestId('location')).toHaveTextContent(`/tasks?task=${encodeURIComponent(taskId)}`)
  })

  it('encodes and decodes special characters in a legacy content detail URL', async () => {
    const groupId = '分组 空格/%'
    vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: { content_group_id: groupId, current_version_no: 1, platform: 'XHS', status: 'ACTIVE' } } as never)
    vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [] } as never)
    renderPage(<><App /><LocationProbe /></>, [`/content/${encodeURIComponent(groupId)}`])
    await waitFor(() => expect(vi.mocked(fetchContentGroupDetail)).toHaveBeenCalledWith(groupId))
    expect(screen.getByTestId('location')).toHaveTextContent(`/content?group=${encodeURIComponent(groupId)}`)
  })

  it('replaces the legacy task detail history entry', async () => {
    renderPage(<><App /><LocationProbe /><HistoryBackButton /></>, ['/tasks?source=create', '/tasks/task_legacy'])
    expect(await screen.findByTestId('location')).toHaveTextContent('/tasks?task=task_legacy')
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/tasks?source=create')
  })

  it('replaces the legacy content detail history entry', async () => {
    renderPage(<><App /><LocationProbe /><HistoryBackButton /></>, ['/content?source=create', '/content/group_legacy'])
    expect(await screen.findByTestId('location')).toHaveTextContent('/content?group=group_legacy')
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/content?source=create')
  })

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

  it('keeps task pagination controls usable with a selectable page size', async () => {
    vi.mocked(fetchTasks).mockResolvedValue({ data: { items: [], total: 21, page: 1, size: 5 } } as never)
    renderPage(<TasksPage />)
    await waitFor(() => expect(vi.mocked(fetchTasks)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 5 })))
    const pageSizeSelect = screen.getByLabelText('每页条数')
    expect(pageSizeSelect).toHaveDisplayValue('5')
    fireEvent.change(pageSizeSelect, { target: { value: '20' } })
    await waitFor(() => expect(vi.mocked(fetchTasks)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20 })))
  })

  it('renders content KPIs and score distribution', async () => {
    renderPage(<ContentListPage />)
    expect(await screen.findByText('平均评分')).toBeInTheDocument()
    expect(screen.getByText('评分分布')).toBeInTheDocument()
  })

  it('validates required fields and requests a server estimate', async () => {
    renderPage(<GeneratorPage />)
    await screen.findByText('运行服务正常')
    fireEvent.click(screen.getByRole('button', { name: '立即创建' }))
    expect(await screen.findByText('请输入任务名称')).toBeInTheDocument()
    expect(screen.getByText('请输入内容方向')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(estimateTask)).toHaveBeenCalledWith({ generate_count: 10, platform: 'XHS' }))
  })

  it('navigates to the queue modal after task creation', async () => {
    vi.mocked(createGenerateTask).mockResolvedValueOnce({ data: { task_id: 'task_new', status: 'QUEUED', accepted: true } } as never)
    renderPage(<><GeneratorPage /><LocationProbe /></>)
    await screen.findByText('运行服务正常')
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称，最多 160 字'), { target: { value: '新任务' } })
    fireEvent.change(screen.getByPlaceholderText('如：夏季护肤'), { target: { value: '护肤' } })
    fireEvent.click(screen.getByRole('button', { name: '立即创建' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tasks?task=task_new'))
  })

  it('sends task filters to the server query', async () => {
    renderPage(<TasksPage />)
    await screen.findByText('队列健康度')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'XHS' } })
    await waitFor(() => expect(vi.mocked(fetchTasks)).toHaveBeenLastCalledWith(expect.objectContaining({ platform: 'XHS' })))
  })

  it('opens task detail and enforces failed-task control permissions', async () => {
    vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [failedTask], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: {}, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
    vi.mocked(fetchTaskEvents).mockResolvedValueOnce({ data: [] } as never)
    renderPage(<TasksPage />)
    fireEvent.click(await screen.findByText('失败任务'))
    expect(await screen.findByRole('dialog', { name: '任务详情' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '取消' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重试' })).toBeEnabled()
  })

  it('toggles task request parameters in the detail dialog', async () => {
    vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [failedTask], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: { request_id: 'req_param_toggle', platform: 'XHS' }, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
    vi.mocked(fetchTaskEvents).mockResolvedValueOnce({ data: [] } as never)
    renderPage(<TasksPage />)

    fireEvent.click(await screen.findByText('失败任务'))
    expect(await screen.findByText((text) => text.includes('req_param_toggle'))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '请求参数' }))
    expect(screen.queryByText((text) => text.includes('req_param_toggle'))).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '请求参数' }))
    expect(await screen.findByText((text) => text.includes('req_param_toggle'))).toBeInTheDocument()
  })

  it('opens task details when a focused task row receives Enter', async () => {
    vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [failedTask], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: {}, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
    vi.mocked(fetchTaskEvents).mockResolvedValueOnce({ data: [] } as never)
    renderPage(<TasksPage />)

    const row = (await screen.findByText('失败任务')).closest('tr')!
    row.focus()
    expect(row).toHaveFocus()
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(await screen.findByRole('dialog', { name: '任务详情' })).toBeInTheDocument()
  })

  it('opens task details as a dialog and removes only task on close', async () => {
    vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [failedTask], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: {}, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
    renderPage(<><TasksPage /><LocationProbe /></>, ['/tasks?source=create'])
    fireEvent.click(await screen.findByText('失败任务'))
    expect(await screen.findByRole('dialog', { name: '任务详情' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭任务详情' }))
    expect(screen.queryByRole('dialog', { name: '任务详情' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/tasks?source=create')
  })

  it('opens content details as a readable dialog and removes only group on close', async () => {
    const content = { content_id: 'content_1', task_id: 'task_1', content_group_id: 'group_1', title: '闃叉檼鏍囬', body: '{"body":"姝ｆ枃鍐呭","hashtags":["闃叉檼","鎶よ偆"],"summary":"鍐呭鎽樿"}', platform: 'XHS', version_no: 1, score: 80, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const group = { content_group_id: 'group_1', root_task_id: 'task_1', latest_task_id: 'task_1', generation_index: 1, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: content, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: group } as never)
    vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [content] } as never)
    renderPage(<><ContentListPage /><LocationProbe /></>, ['/content?source=create'])
    fireEvent.click(await screen.findByText('闃叉檼鏍囬'))
    expect(await screen.findByRole('dialog', { name: '内容详情' })).toBeInTheDocument()
    expect(await screen.findByText('姝ｆ枃鍐呭')).toBeInTheDocument()
    expect(screen.getByText('#闃叉檼')).toBeInTheDocument()
    expect(screen.getByText('鍐呭鎽樿')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭内容详情' }))
    expect(screen.queryByRole('dialog', { name: '内容详情' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/content?source=create')
  })

  it('filters content by source task from the first toolbar control', async () => {
    const task = { task_id: 'task_source', task_name: '来源任务 A', task_type: 'GENERATE', task_status: 'SUCCESS', platform: 'XHS', content_count: 2, latest_updated_at: '2026-08-10T02:40:36' }
    const firstContent = { content_id: 'content_a', task_id: 'task_source', content_group_id: 'group_a', title: '内容 A', body: '{"body":"正文 A"}', platform: 'XHS', version_no: 1, score: 82, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const secondContent = { ...firstContent, content_id: 'content_b', content_group_id: 'group_b', title: '内容 B', body: '{"body":"正文 B"}' }
    const groups = [
      { content_group_id: 'group_a', root_task_id: 'task_source', root_task_name: '来源任务 A', latest_task_id: 'task_source', generation_index: 1, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: firstContent, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' },
      { content_group_id: 'group_b', root_task_id: 'task_source', root_task_name: '来源任务 A', latest_task_id: 'task_source', generation_index: 2, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: secondContent, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' },
    ]
    vi.mocked(fetchContentTasks).mockResolvedValueOnce({ data: { items: [task], total: 1, page: 1, size: 50 } } as never)
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: groups, total: 2, page: 1, size: 20 } } as never)
    renderPage(<ContentListPage />, ['/content?task=task_source'])

    const filters = screen.getAllByRole('combobox')
    expect(filters[0]).toHaveAccessibleName('来源任务')
    expect(filters[1]).toHaveDisplayValue('全部平台')
    await waitFor(() => expect(vi.mocked(fetchContentGroups)).toHaveBeenLastCalledWith(expect.objectContaining({ task_id: 'task_source' })))
    expect(await screen.findByText('内容 A')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '按任务分组' })).not.toBeInTheDocument()
  })

  it('opens generated content from the task detail dialog', async () => {
    vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [failedTask], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, success_count: 1, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: {}, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
    renderPage(<><TasksPage /><LocationProbe /></>)

    fireEvent.click(await screen.findByText('失败任务'))
    fireEvent.click(await screen.findByRole('button', { name: '查看生成内容' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/content?task=task_failed')
  })

  it('opens content details when a focused content row receives Space', async () => {
    const content = { content_id: 'content_1', task_id: 'task_1', content_group_id: 'group_1', title: '防晒标题', body: '{"body":"正文内容","hashtags":[],"summary":"内容摘要"}', platform: 'XHS', version_no: 1, score: 80, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const group = { content_group_id: 'group_1', root_task_id: 'task_1', latest_task_id: 'task_1', generation_index: 1, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: content, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: group } as never)
    vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [content] } as never)
    renderPage(<ContentListPage />)

    const row = (await screen.findByText('防晒标题')).closest('tr')!
    row.focus()
    expect(row).toHaveFocus()
    fireEvent.keyDown(row, { key: ' ' })

    expect(await screen.findByRole('dialog', { name: '内容详情' })).toBeInTheDocument()
  })

  it('submits one manual optimization version from the content dialog', async () => {
    const content = { content_id: 'content_2', task_id: 'task_1', content_group_id: 'group_2', title: '防晒标题', body: '{"body":"当前正文","hashtags":[],"summary":"当前摘要"}', platform: 'XHS', version_no: 2, score: 86, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const group = { content_group_id: 'group_2', root_task_id: 'task_1', latest_task_id: 'task_1', generation_index: 1, platform: 'XHS', current_version_no: 2, version_count: 2, status: 'ACTIVE', current_content: content, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: group } as never)
    vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [content] } as never)
    vi.mocked(createOptimizeTask).mockResolvedValueOnce({ data: { task_id: 'task_opt', status: 'QUEUED', accepted: true } } as never)
    renderPage(<ContentListPage />)

    fireEvent.click(await screen.findByText('防晒标题'))
    fireEvent.click(await screen.findByRole('button', { name: '优化当前版本' }))

    await waitFor(() => expect(vi.mocked(createOptimizeTask)).toHaveBeenCalled())
    const optimizeCalls = vi.mocked(createOptimizeTask).mock.calls
    expect(optimizeCalls[optimizeCalls.length - 1][0]).toEqual(expect.objectContaining({
      source_content_ids: ['content_2'],
      quality: expect.objectContaining({ enable_auto_optimize: false, max_iteration: 0 }),
    }))
  })

  it('copies a content row title and body without opening details', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const content = { content_id: 'content_copy', task_id: 'task_1', content_group_id: 'group_copy', title: 'Copy title', body: '{"title":"Copy title","body":"Copy body","hashtags":["tag","publish"],"summary":"summary"}', platform: 'XHS', version_no: 1, score: 80, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const group = { content_group_id: 'group_copy', root_task_id: 'task_1', latest_task_id: 'task_1', generation_index: 1, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: content, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 5 } } as never)
    renderPage(<ContentListPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Copy title/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('# Copy title\n\nCopy body\n\n#tag #publish'))
    expect(await screen.findByRole('alert')).toHaveTextContent('复制成功')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows content score dimensions in Chinese and hides internal evaluation fields', async () => {
    const content = { content_id: 'content_score', task_id: 'task_1', content_group_id: 'group_score', title: '评分内容', body: '{"body":"正文内容","hashtags":[],"summary":"内容摘要"}', platform: 'XHS', version_no: 1, score: null, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: { passed: false, dimensions: { appeal: 82, relevance: 85, originality: 75, readability: 80, engagement: 79 }, dimension_details: [{ dimension: 'appeal', score: 82, weight: 0.3 }, { dimension: 'relevance', score: 85, weight: 0.25 }, { dimension: 'originality', score: 75, weight: 0.2 }, { dimension: 'readability', score: 80, weight: 0.15 }, { dimension: 'engagement', score: 79, weight: 0.1 }], content_index: 0, overall_score: 88 }, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const group = { content_group_id: 'group_score', root_task_id: 'task_1', latest_task_id: 'task_1', generation_index: 1, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: content, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: group } as never)
    vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [content] } as never)
    renderPage(<ContentListPage />)

    fireEvent.click(await screen.findByText('评分内容'))

    expect((await screen.findAllByText('88')).length).toBeGreaterThan(0)
    expect(screen.getByText('吸引力')).toBeInTheDocument()
    expect(screen.getByText('相关性')).toBeInTheDocument()
    expect(screen.getByText('原创性')).toBeInTheDocument()
    expect(screen.getByText('可读性')).toBeInTheDocument()
    expect(screen.getByText('互动性')).toBeInTheDocument()
    expect(screen.getByText('权重 30%')).toBeInTheDocument()
    expect(screen.getByText('权重 10%')).toBeInTheDocument()
    expect(screen.queryByText('engagement')).not.toBeInTheDocument()
    expect(screen.queryByText('content_index')).not.toBeInTheDocument()
    expect(screen.queryByText('overall_score')).not.toBeInTheDocument()
  })

  it('compares any two selected content versions and defaults to the latest two', async () => {
    const current = { content_id: 'content_v3', task_id: 'task_2', content_group_id: 'group_3', title: '新版标题', body: '{"body":"新版正文","hashtags":["新版"],"summary":"新版摘要"}', platform: 'XHS', version_no: 3, score: 90, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:50:36', updated_at: '2026-08-10T02:50:36' }
    const middle = { ...current, content_id: 'content_v2', title: '中间版标题', body: '{"body":"中间版正文","hashtags":["中间版"],"summary":"中间版摘要"}', version_no: 2, score: 85, created_at: '2026-08-10T02:45:36', updated_at: '2026-08-10T02:45:36' }
    const old = { ...current, content_id: 'content_v1', title: '旧版标题', body: '{"body":"旧版正文","hashtags":["旧版"],"summary":"旧版摘要"}', version_no: 1, score: 80, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
    const group = { content_group_id: 'group_3', root_task_id: 'task_2', latest_task_id: 'task_2', generation_index: 1, platform: 'XHS', current_version_no: 3, version_count: 3, status: 'ACTIVE', current_content: current, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:50:36' }
    vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 20 } } as never)
    vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: group } as never)
    vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [current, middle, old] } as never)
    renderPage(<ContentListPage />)

    fireEvent.click(await screen.findByText('新版标题'))

    expect(await screen.findByText('v3 对比 v2')).toBeInTheDocument()
    expect(screen.getAllByText('新版正文').length).toBeGreaterThan(0)
    expect(screen.getByText('中间版正文')).toBeInTheDocument()
    expect(screen.getAllByText('#新版').length).toBeGreaterThan(0)
    expect(screen.getByText('#中间版')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('选择版本 A'), { target: { value: 'content_v2' } })
    fireEvent.change(screen.getByLabelText('选择版本 B'), { target: { value: 'content_v1' } })

    expect(await screen.findByText('v2 对比 v1')).toBeInTheDocument()
    expect(screen.getAllByText('中间版正文').length).toBeGreaterThan(0)
    expect(screen.getByText('旧版正文')).toBeInTheDocument()
    expect(screen.getByText('#旧版')).toBeInTheDocument()
  })

  it('keeps content pagination controls usable with a selectable page size', async () => {
    vi.mocked(fetchContentGroups).mockResolvedValue({ data: { items: [], total: 21, page: 1, size: 5 } } as never)
    const { container } = renderPage(<ContentListPage />)
    await waitFor(() => expect(vi.mocked(fetchContentGroups)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 5 })))
    const pageSizeSelect = screen.getByLabelText('每页条数')
    expect(pageSizeSelect).toHaveDisplayValue('5')
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.pagination button'))
    await waitFor(() => expect(buttons[2]).toBeEnabled())
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toBeDisabled()
    expect(buttons[1]).toHaveTextContent('1')
    fireEvent.click(buttons[2])
    await waitFor(() => expect(vi.mocked(fetchContentGroups)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, size: 5 })))
    fireEvent.change(pageSizeSelect, { target: { value: '20' } })
    await waitFor(() => expect(vi.mocked(fetchContentGroups)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20 })))
  })
})
