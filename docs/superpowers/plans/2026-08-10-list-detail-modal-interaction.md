# List Detail Modal Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建任务后直接进入任务队列，并把任务、内容详情统一改为支持深链接的居中弹窗。

**Architecture:** 使用 URL 查询参数作为详情选中状态，`TasksPage` 读取 `task`，`ContentListPage` 读取 `group`。新增一个只负责弹窗行为和无障碍语义的 `DetailModal` 壳层；两个列表页继续保留各自的查询与业务操作。旧动态路由通过 `Navigate` 替换为对应列表查询参数链接。

**Tech Stack:** React 19、React Router 7、TanStack Query 5、TypeScript 5.7、Vitest、Testing Library、现有 CSS 设计变量。

## Global Constraints

- 不修改后端接口和数据结构。
- 不引入新的 UI 组件库或状态管理依赖。
- 任务弹窗桌面端宽约 760px，内容弹窗约 900px；移动端接近全屏。
- 关闭按钮、遮罩点击和 `Escape` 都必须关闭弹窗。
- 打开或关闭详情时保留 URL 中其他查询参数。
- JSON 正文解析失败时必须回退为原始正文。
- 注释使用中文，并保持现有 React/CSS 风格。

---

## File Structure

- Create `src/components/DetailModal.tsx`: 通用弹窗壳层、键盘关闭、遮罩关闭和背景滚动锁定。
- Create `src/components/DetailModal.test.tsx`: 验证真实弹窗行为与无障碍语义。
- Create `src/utils/contentPreview.ts`: 把 JSON 字符串转换为可展示的正文、标签和摘要。
- Create `src/utils/contentPreview.test.ts`: 验证结构化正文和普通正文两条路径。
- Modify `src/pages/Generator.tsx`: 创建成功后进入带 `task` 参数的任务队列。
- Modify `src/pages/Tasks.tsx`: URL 驱动任务弹窗，移除右侧面板布局。
- Modify `src/pages/ContentList.tsx`: URL 驱动内容弹窗并使用结构化预览。
- Modify `src/App.tsx`: 旧详情路径重定向到列表弹窗路径。
- Modify `src/pages/core-pages.test.tsx`: 覆盖创建跳转、列表弹窗和旧链接兼容。
- Modify `src/styles.css`: 居中弹窗、内容预览和移动端样式。

---

### Task 1: Accessible DetailModal Shell

**Files:**
- Create: `src/components/DetailModal.tsx`
- Create: `src/components/DetailModal.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: React `children`, `title`, `open`, `onClose`, optional `size`.
- Produces: `DetailModal({ open, title, onClose, size, children }: DetailModalProps): ReactNode`，其中 `size` 为 `'task' | 'content'`。

- [ ] **Step 1: Write failing behavioral tests**

```tsx
it('renders an accessible modal and closes from its close button', () => {
  const onClose = vi.fn()
  render(<DetailModal open title="任务详情" onClose={onClose}><p>任务内容</p></DetailModal>)
  expect(screen.getByRole('dialog', { name: '任务详情' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '关闭任务详情' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('closes on Escape and backdrop click but not content click', () => {
  const onClose = vi.fn()
  render(<DetailModal open title="内容详情" onClose={onClose}><button>内部按钮</button></DetailModal>)
  fireEvent.click(screen.getByRole('button', { name: '内部按钮' }))
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.mouseDown(screen.getByTestId('detail-modal-backdrop'))
  expect(onClose).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/components/DetailModal.test.tsx`

Expected: FAIL because `DetailModal.tsx` does not exist.

- [ ] **Step 3: Implement the minimal modal shell**

```tsx
export interface DetailModalProps {
  open: boolean
  title: string
  onClose: () => void
  size?: 'task' | 'content'
  children: React.ReactNode
}

export function DetailModal({ open, title, onClose, size = 'task', children }: DetailModalProps) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="detail-modal-backdrop" data-testid="detail-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className={`detail-modal detail-modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="detail-modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label={`关闭${title}`} onClick={onClose}>×</button></header>
        <div className="detail-modal-body">{children}</div>
      </section>
    </div>
  )
}
```

Add the modal styles:

```css
.detail-modal-backdrop { position: fixed; z-index: 50; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; border: 0; background: rgba(26,30,48,.38); backdrop-filter: blur(2px); }
.detail-modal { display: flex; flex-direction: column; width: min(100%,760px); max-height: calc(100vh - 48px); overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: 0 24px 70px rgba(35,39,60,.22); }
.detail-modal-body { min-height: 0; overflow-y: auto; }
.detail-modal--content { width: min(100%,900px); }
.detail-modal-header { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.detail-modal-header h2 { margin: 0; font-size: 15px; }
.detail-modal-actions { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 18px; border-top: 1px solid var(--line); background: rgba(255,255,255,.96); }
@media (max-width: 760px) {
  .detail-modal-backdrop { padding: 10px; }
  .detail-modal { width: 100%; max-height: calc(100vh - 20px); border-radius: 12px; }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- --run src/components/DetailModal.test.tsx`

Expected: 2 tests pass with no React act warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailModal.tsx src/components/DetailModal.test.tsx src/styles.css
git commit -m "feat: add accessible detail modal shell"
```

---

### Task 2: Task Creation and Queue Modal Flow

**Files:**
- Modify: `src/pages/Generator.tsx`
- Modify: `src/pages/Tasks.tsx`
- Modify: `src/pages/core-pages.test.tsx`

**Interfaces:**
- Consumes: `DetailModal` from Task 1 and React Router `useSearchParams`.
- Produces: task selection encoded as `/tasks?task=<task_id>`; `TasksPage` opens and closes details from that parameter.

- [ ] **Step 1: Add failing creation and task-modal tests**

Update the endpoint mock to include `createGenerateTask`, then add:

```tsx
it('navigates to the queue modal after task creation', async () => {
  vi.mocked(createGenerateTask).mockResolvedValueOnce({ data: { task_id: 'task_new', status: 'QUEUED', accepted: true } } as never)
  renderPage(<><GeneratorPage /><LocationProbe /></>)
  await screen.findByText('运行服务正常')
  fireEvent.change(screen.getByPlaceholderText('请输入任务名称，最多 160 字'), { target: { value: '新任务' } })
  fireEvent.change(screen.getByPlaceholderText('如：夏季护肤'), { target: { value: '护肤' } })
  fireEvent.click(screen.getByRole('button', { name: '立即创建' }))
  expect(await screen.findByTestId('location')).toHaveTextContent('/tasks?task=task_new')
})

it('opens task details as a dialog and removes only task on close', async () => {
  const failedTask = { task_id: 'task_failed', task_name: '失败任务', task_type: 'GENERATE', platform: 'XHS', priority: 'NORMAL', status: 'FAILED', current_node: 'generator', progress: 40, requested_count: 2, success_count: 1, failed_count: 1, retry_count: 0, created_at: '2026-08-09T10:00:00' }
  vi.mocked(fetchTasks).mockResolvedValueOnce({ data: { items: [failedTask], total: 1, page: 1, size: 20 } } as never)
  vi.mocked(fetchTaskDetail).mockResolvedValueOnce({ data: { ...failedTask, request_id: 'req_1', current_iteration: 0, max_iteration: 2, input_params: {}, image_requested_count: 0, image_success_count: 0, image_failed_count: 0 } } as never)
  renderPage(<TasksPage />, ['/tasks?source=create'])
  fireEvent.click(await screen.findByText('失败任务'))
  expect(await screen.findByRole('dialog', { name: '任务详情' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '关闭任务详情' }))
  expect(screen.queryByRole('dialog', { name: '任务详情' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/tasks?source=create')
})
```

Change `renderPage` to accept `initialEntries: string[] = ['/']`, render a `LocationProbe` using `useLocation`, and keep the real router instead of mocking navigation.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/pages/core-pages.test.tsx`

Expected: creation still navigates to `/tasks/task_new`, and task details do not expose a dialog role.

- [ ] **Step 3: Implement URL-driven task flow**

In `Generator.tsx`, replace the success navigation with:

```tsx
onSuccess: result => {
  if (result.data?.task_id) navigate(`/tasks?task=${encodeURIComponent(result.data.task_id)}`)
}
```

In `Tasks.tsx`:

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const selectedId = searchParams.get('task')
const selectTask = (taskId: string) => {
  const next = new URLSearchParams(searchParams)
  next.set('task', taskId)
  setSearchParams(next)
}
const closeTask = () => {
  const next = new URLSearchParams(searchParams)
  next.delete('task')
  setSearchParams(next, { replace: true })
}
```

Replace row `setSelectedId` calls with `selectTask`, remove the `split-workspace` wrapper and right `<aside>`, and render the existing detail body inside:

```tsx
<DetailModal open={!!selectedId} title="任务详情" onClose={closeTask} size="task">
  {detailQuery.isLoading ? loadingState : detail ? taskDetailBody : errorState}
</DetailModal>
```

Give the existing cancel/retry/priority container the `detail-modal-actions` class so it remains visible at the bottom while event history scrolls.

- [ ] **Step 4: Run focused tests and build**

Run: `npm test -- --run src/pages/core-pages.test.tsx`

Expected: creation and task modal tests pass; existing task permissions test remains green.

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Generator.tsx src/pages/Tasks.tsx src/pages/core-pages.test.tsx
git commit -m "feat: open created tasks in queue modal"
```

---

### Task 3: Content Modal and Structured Preview

**Files:**
- Create: `src/utils/contentPreview.ts`
- Create: `src/utils/contentPreview.test.ts`
- Modify: `src/pages/ContentList.tsx`
- Modify: `src/pages/core-pages.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `DetailModal` and content detail responses already returned by the API.
- Produces: `parseContentPreview(body: string | null | undefined): { body: string; hashtags: string[]; summary: string }` and content selection encoded as `/content?group=<content_group_id>`.

- [ ] **Step 1: Write failing parser tests**

```ts
it('extracts readable fields from generated JSON content', () => {
  expect(parseContentPreview('{"body":"正文内容","hashtags":["防晒","护肤"],"summary":"内容摘要"}')).toEqual({
    body: '正文内容', hashtags: ['防晒', '护肤'], summary: '内容摘要',
  })
})

it('falls back to plain text when body is not valid JSON', () => {
  expect(parseContentPreview('普通正文')).toEqual({ body: '普通正文', hashtags: [], summary: '' })
})
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `npm test -- --run src/utils/contentPreview.test.ts`

Expected: FAIL because `parseContentPreview` does not exist.

- [ ] **Step 3: Implement the parser**

```ts
export function parseContentPreview(source: string | null | undefined) {
  const fallback = { body: source || '', hashtags: [] as string[], summary: '' }
  if (!source) return fallback
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    return {
      body: typeof parsed.body === 'string' ? parsed.body : source,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((item): item is string => typeof item === 'string') : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    }
  } catch {
    return fallback
  }
}
```

- [ ] **Step 4: Add failing content-dialog test**

Mock one content group and its full detail, click its row, then assert:

```tsx
const content = { content_id: 'content_1', task_id: 'task_1', content_group_id: 'group_1', title: '防晒标题', body: '{"body":"正文内容","hashtags":["防晒","护肤"],"summary":"内容摘要"}', platform: 'XHS', version_no: 1, score: 80, model_name: 'deepseek-chat', provider: 'deepseek', evaluation_detail: {}, media_json: null, status: 'ACTIVE', created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
const group = { content_group_id: 'group_1', root_task_id: 'task_1', latest_task_id: 'task_1', generation_index: 1, platform: 'XHS', current_version_no: 1, version_count: 1, status: 'ACTIVE', current_content: content, created_at: '2026-08-10T02:40:36', updated_at: '2026-08-10T02:40:36' }
vi.mocked(fetchContentGroups).mockResolvedValueOnce({ data: { items: [group], total: 1, page: 1, size: 20 } } as never)
vi.mocked(fetchContentGroupDetail).mockResolvedValueOnce({ data: group } as never)
vi.mocked(fetchContentVersions).mockResolvedValueOnce({ data: [content] } as never)
renderPage(<ContentListPage />, ['/content'])
fireEvent.click(await screen.findByText('防晒标题'))
expect(await screen.findByRole('dialog', { name: '内容详情' })).toBeInTheDocument()
expect(screen.getByText('正文内容')).toBeInTheDocument()
expect(screen.getByText('#防晒')).toBeInTheDocument()
expect(screen.getByText('内容摘要')).toBeInTheDocument()
```

Run: `npm test -- --run src/pages/core-pages.test.tsx`

Expected: FAIL because the current page renders a right panel and raw JSON.

- [ ] **Step 5: Implement URL-driven content modal**

Use `useSearchParams`, with `group` as the selected ID. Preserve unrelated parameters when selecting or closing. Remove `split-workspace`, backdrop button and right `<aside>`, then place the existing metadata, score, history and actions inside:

```tsx
<DetailModal open={!!selectedId} title="内容详情" onClose={closeContent} size="content">
  {detailQuery.isLoading ? loadingState : detail ? contentDetailBody : errorState}
</DetailModal>
```

Compute `const preview = parseContentPreview(current?.body)` and render `preview.body`, hashtag chips labeled `#标签`, and summary only when non-empty. Add:

```css
.content-preview { white-space: pre-wrap; color: #596276; font-size: 12px; line-height: 1.8; }
.content-hashtags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.content-summary { margin-top: 12px; padding: 12px; border-radius: 8px; background: #f7f6ff; color: #5c6477; font-size: 11px; line-height: 1.7; }
```

Give the archive/optimize button container the `detail-modal-actions` class so the primary content actions remain visible while long content scrolls.

- [ ] **Step 6: Run content tests and build**

Run: `npm test -- --run src/utils/contentPreview.test.ts src/pages/core-pages.test.tsx`

Expected: parser and content modal tests pass.

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 7: Commit**

```bash
git add src/utils/contentPreview.ts src/utils/contentPreview.test.ts src/pages/ContentList.tsx src/pages/core-pages.test.tsx src/styles.css
git commit -m "feat: show content details in readable modal"
```

---

### Task 4: Legacy Route Compatibility and End-to-End Verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/core-pages.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: task query key `task` and content query key `group` from Tasks 2 and 3.
- Produces: `/tasks/:taskId -> /tasks?task=:taskId` and `/content/:groupId -> /content?group=:groupId` with history replacement.

- [ ] **Step 1: Add failing legacy route tests**

Add two tests against the real `App` routes:

```tsx
it('redirects a legacy task detail URL to the queue modal URL', async () => {
  renderPage(<><App /><LocationProbe /></>, ['/tasks/task_legacy'])
  expect(await screen.findByTestId('location')).toHaveTextContent('/tasks?task=task_legacy')
})

it('redirects a legacy content detail URL to the content modal URL', async () => {
  renderPage(<><App /><LocationProbe /></>, ['/content/group_legacy'])
  expect(await screen.findByTestId('location')).toHaveTextContent('/content?group=group_legacy')
})
```

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm test -- --run src/pages/core-pages.test.tsx`

Expected: legacy URLs still render the independent detail pages instead of the list modal URLs.

- [ ] **Step 3: Implement route redirects**

```tsx
function LegacyTaskDetailRedirect() {
  const { taskId = '' } = useParams()
  return <Navigate replace to={`/tasks?task=${encodeURIComponent(taskId)}`} />
}

function LegacyContentDetailRedirect() {
  const { groupId = '' } = useParams()
  return <Navigate replace to={`/content?group=${encodeURIComponent(groupId)}`} />
}
```

Replace the two legacy page route elements with these redirect components and remove the unused `TaskDetailPage` and `ContentDetailPage` imports. Keep the source files because they may still contain reference behavior, but they are no longer active routes.

Remove the now-unused `.split-workspace`, `.detail-panel`, `.detail-backdrop` rules and their responsive overrides from `styles.css`; do not remove unrelated task detail page styles.

- [ ] **Step 4: Run complete automated verification**

Run: `npm test -- --run`

Expected: all Vitest tests pass without failures.

Run: `npm run build`

Expected: exit code 0 and generated Vite assets.

- [ ] **Step 5: Verify desktop and mobile behavior in the browser**

Start: `npm run dev -- --host 127.0.0.1`

Check at desktop width 1440px:

- Click the first task row, verify the URL gains `task=<task-id>`, then reload and confirm the centered task dialog returns with a full-width table behind it.
- Click the first content row, verify the URL gains `group=<group-id>`, then reload and confirm the centered content dialog returns with readable body fields.
- Clicking backdrop and pressing `Escape` close the dialog without clearing unrelated query parameters.

Check at mobile width 390px:

- Both dialogs fit within the viewport, use internal scrolling, and keep their close buttons visible.
- Table pages do not reserve blank space for a right panel.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/core-pages.test.tsx src/styles.css
git commit -m "feat: redirect legacy details to list modals"
```

---

## Final Verification Checklist

- `npm test -- --run` reports zero failed tests.
- `npm run build` exits successfully.
- `git diff --check` reports no whitespace errors.
- Creation, task modal, content modal, JSON fallback, close behavior and legacy routes each have a test that was observed failing before implementation and passing afterward.
- Browser verification covers 1440px desktop and 390px mobile layouts.
- No backend file, API contract or new dependency is changed.
