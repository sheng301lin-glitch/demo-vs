# AI 内容工作台

基于 React、TypeScript 和 Vite 的 AI 内容生成工作台前端，与 Python Agent Runtime 后端配合，提供任务创建、任务队列、内容与版本管理、模型配置和运行状态检查。

## 技术栈

- React 19 + React Router 7
- TypeScript 5.7 + Vite 6
- TanStack Query、Axios、React Hook Form、Zod、Zustand
- Recharts、Lucide React
- Vitest + Testing Library

## 开发环境

- Node.js 20 或更高版本
- npm（随受支持的 Node.js 版本安装）
- Python Agent Runtime 后端（联调任务和内容接口时需要）

## 本地启动

安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

默认访问地址为 <http://localhost:5173>。

开发服务器会将 `/api` 请求代理到 `http://localhost:8000`。需要真实任务、统计和内容数据时，请在后端仓库中完成配置和数据库迁移，然后启动 API：

```bash
python3 -m pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

如需让排队任务在后台执行，还需启动 Redis 和 Runtime Worker：

```bash
python3 -m app.workers.main
```

后端的完整 MySQL、Redis 和环境变量说明请查看 Python Agent Runtime 仓库中的 README 与 `.env.example`。

## 可用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 执行 TypeScript 项目检查并生成生产构建 |
| `npm test -- --run` | 单次运行 Vitest 测试 |
| `npm run preview` | 本地预览生产构建 |

## 页面路由

| 路由 | 页面 |
| --- | --- |
| `/` | 新建内容生成任务 |
| `/tasks` | 任务队列、筛选、统计和详情面板 |
| `/tasks/:taskId` | 独立任务详情 |
| `/content` | 内容列表、统计、筛选和版本摘要 |
| `/content/:groupId` | 内容详情与历史版本 |
| `/settings` | 模型配置 |
| `/health` | 后端健康状态 |

任务 KPI、队列状态、内容列表和版本信息均读取后端 API，并由 TanStack Query 管理缓存和刷新；浏览器本地存储不承担列表数据源职责。

## 目录结构

```text
src/
├── api/          # Axios 客户端与 API 端点
├── components/   # 布局、侧栏和顶栏等共享组件
├── hooks/        # React Query 查询与轮询封装
├── pages/        # 新建任务、任务、内容、设置和健康检查页面
├── stores/       # Zustand 界面状态
├── types/        # API 与业务类型
├── utils/        # 仪表盘等纯函数和测试
├── App.tsx       # 路由入口
└── styles.css    # 全局设计 tokens 与页面样式
```

## 验证

提交代码前运行：

```bash
npm test -- --run
npm run build
```

构建输出位于 `dist/`，该目录不应提交到 Git。

## 常见问题

### 页面显示后端不可用或请求失败

确认后端监听 `http://localhost:8000`，并先访问 `/health` 页面检查连接状态。开发环境应通过相对路径 `/api` 请求接口，以使用 Vite 代理。

### 5173 端口已被占用

停止占用端口的进程，或使用 `npm run dev -- --port 5174` 临时启动。更换端口后浏览器访问地址也会相应变化。

### 依赖状态异常

先确认 Node.js 版本符合要求，再重新运行 `npm install`。不要随意删除 `package-lock.json`，它用于保持团队依赖版本一致。

### 页面能打开但任务不执行

API 服务只负责接收和查询任务。请同时确认 MySQL、Redis 以及 `python3 -m app.workers.main` 均已正常运行。
