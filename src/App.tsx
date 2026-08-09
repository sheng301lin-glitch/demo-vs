// ============================================================================
// 路由配置
// ============================================================================
import { Routes, Route } from 'react-router'
import { Layout } from './components/Layout'
import { GeneratorPage } from './pages/Generator'
import { TasksPage } from './pages/Tasks'
import { TaskDetailPage } from './pages/TaskDetail'
import { ContentListPage } from './pages/ContentList'
import { ContentDetailPage } from './pages/ContentDetail'
import { SettingsPage } from './pages/Settings'
import { HealthPage } from './pages/Health'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<GeneratorPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="content" element={<ContentListPage />} />
        <Route path="content/:groupId" element={<ContentDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="health" element={<HealthPage />} />
      </Route>
    </Routes>
  )
}
