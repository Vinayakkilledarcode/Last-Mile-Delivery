import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatusPill from '../components/StatusPill.jsx';

const STATUSES = ['Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Rescheduled'];

export default function OrderList() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [zones, setZones] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filters, setFilters] = useState({ status: '', zoneId: '', agentId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listOrders(filters);
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (user.role === 'admin') {
      api.zones().then(setZones).catch(() => {});
      api.agents().then(setAgents).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.zoneId, filters.agentId]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{user.role === 'admin' ? 'All Orders' : 'My Orders'}</h1>
          <p>{user.role === 'admin' ? 'Every order across every zone, filterable by status, zone or agent.' : 'Track every order you have placed.'}</p>
        </div>
        {user.role !== 'agent' && (
          <Link to="/orders/new" className="btn btn-accent">+ New Order</Link>
        )}
      </div>

      {user.role === 'admin' && (
        <div className="filter-bar">
          <div className="field">
            <label>Status</label>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Zone</label>
            <select value={filters.zoneId} onChange={(e) => setFilters((f) => ({ ...f, zoneId: e.target.value }))}>
              <option value="">All zones</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Agent</label>
            <select value={filters.agentId} onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value }))}>
              <option value="">All agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">No orders here yet. Once one is placed, it will show up in this list.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Type</th>
                <th>Charge</th>
                <th>Status</th>
                <th>Agent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">#{o.id}</td>
                  <td>{o.pickup_area_name} → {o.drop_area_name}</td>
                  <td>{o.order_type} · {o.payment_type}</td>
                  <td className="mono">₹{o.total_charge}</td>
                  <td><StatusPill status={o.status} /></td>
                  <td>{o.agent_name || '—'}</td>
                  <td><Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
