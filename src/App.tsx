// ============================================================================
// 路由配置
// ============================================================================
import { Navigate, Route, Routes, useParams } from 'react-router'
import { Layout } from './components/Layout'
import { GeneratorPage } from './pages/Generator'
import { TasksPage } from './pages/Tasks'
import { ContentListPage } from './pages/ContentList'
import { SettingsPage } from './pages/Settings'
import { HealthPage } from './pages/Health'

function LegacyTaskDetailRedirect() {
  const { taskId = '' } = useParams()
  return <Navigate replace to={`/tasks?task=${encodeURIComponent(taskId)}`} />
}

function LegacyContentDetailRedirect() {
  const { groupId = '' } = useParams()
  return <Navigate replace to={`/content?group=${encodeURIComponent(groupId)}`} />
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<GeneratorPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:taskId" element={<LegacyTaskDetailRedirect />} />
        <Route path="content" element={<ContentListPage />} />
        <Route path="content/:groupId" element={<LegacyContentDetailRedirect />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="health" element={<HealthPage />} />
      </Route>
    </Routes>
  )
}
