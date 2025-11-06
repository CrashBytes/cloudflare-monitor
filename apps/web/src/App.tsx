import { Routes, Route } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
import { useMonitoringStore } from './stores/monitoringStore';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import Layout from './components/organisms/Layout';

export default function App() {
  // Initialize SSE connection for real-time updates
  useSSE();
  
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </Layout>
  );
}
