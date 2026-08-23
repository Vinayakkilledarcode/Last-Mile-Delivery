import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import PlaceOrder from './pages/PlaceOrder.jsx';
import OrderList from './pages/OrderList.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import AgentDashboard from './pages/AgentDashboard.jsx';
import AgentAvailable from './pages/AgentAvailable.jsx';
import AdminZones from './pages/AdminZones.jsx';
import AdminRateCards from './pages/AdminRateCards.jsx';
import AdminAgents from './pages/AdminAgents.jsx';

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route path="/" element={
        user
          ? <Navigate to={user.role === 'agent' ? '/agent' : '/orders'} replace />
          : <Navigate to="/login" replace />
      } />

      <Route path="/orders/new" element={
        <Protected roles={['customer', 'admin']}><PlaceOrder /></Protected>
      } />
      <Route path="/orders" element={
        <Protected roles={['customer', 'admin']}><OrderList /></Protected>
      } />
      <Route path="/orders/:id" element={
        <Protected><OrderDetail /></Protected>
      } />
      <Route path="/agent" element={
        <Protected roles={['agent']}><AgentDashboard /></Protected>
      } />
      <Route path="/agent/available" element={
        <Protected roles={['agent']}><AgentAvailable /></Protected>
      } />
      <Route path="/admin/zones" element={
        <Protected roles={['admin']}><AdminZones /></Protected>
      } />
      <Route path="/admin/rates" element={
        <Protected roles={['admin']}><AdminRateCards /></Protected>
      } />
      <Route path="/admin/agents" element={
        <Protected roles={['admin']}><AdminAgents /></Protected>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
