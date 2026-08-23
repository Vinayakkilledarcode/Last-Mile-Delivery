import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatusPill from '../components/StatusPill.jsx';

export default function AgentDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [me, setMe] = useState(null);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    try {
      const [orderData, meData, zoneData] = await Promise.all([api.listOrders(), api.me(), api.zones()]);
      setOrders(orderData);
      setMe(meData);
      setZones(zoneData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleAvailability() {
    try {
      await api.updateAvailability(user.id, { is_available: me.is_available ? 0 : 1 });
      setNotice(me.is_available ? 'You are now marked unavailable.' : 'You are now marked available.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateZone(zoneId) {
    try {
      await api.updateAvailability(user.id, { current_zone_id: zoneId || null });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const active = orders.filter((o) => !['Delivered', 'Failed'].includes(o.status));
  const past = orders.filter((o) => ['Delivered', 'Failed'].includes(o.status));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Deliveries</h1>
          <p>Orders assigned to you, and your current availability.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      {me && (
        <div className="card">
          <h3>Availability</h3>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Current zone</label>
              <select value={me.current_zone_id || ''} onChange={(e) => updateZone(e.target.value)}>
                <option value="">No zone set</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <button className={`btn ${me.is_available ? 'btn-danger' : 'btn-accent'}`} onClick={toggleAvailability}>
              {me.is_available ? 'Go Unavailable' : 'Go Available'}
            </button>
            <span className="helper-text">
              Status: <strong>{me.is_available ? 'Available for new pickups' : 'Not receiving new assignments'}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 24px 0' }}><h3>Active Deliveries</h3></div>
        {active.length === 0 ? (
          <div className="empty-state">No active deliveries assigned right now.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Order</th><th>Route</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {active.map((o) => (
                <tr key={o.id}>
                  <td className="mono">#{o.id}</td>
                  <td>{o.pickup_area_name} → {o.drop_area_name}</td>
                  <td><StatusPill status={o.status} /></td>
                  <td><Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {past.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px 0' }}><h3>Completed</h3></div>
          <table>
            <thead>
              <tr><th>Order</th><th>Route</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {past.map((o) => (
                <tr key={o.id}>
                  <td className="mono">#{o.id}</td>
                  <td>{o.pickup_area_name} → {o.drop_area_name}</td>
                  <td><StatusPill status={o.status} /></td>
                  <td><Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
