import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function AgentAvailable() {
  const [orders, setOrders] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [claiming, setClaiming] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.availableOrders();
      setOrders(data);
      setChecked({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggle(id) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  const selectedIds = Object.keys(checked).filter((id) => checked[id]);

  async function handleClaimSelected() {
    setClaiming(true);
    setError('');
    setNotice('');
    const succeeded = [];
    const failed = [];
    for (const id of selectedIds) {
      try {
        await api.claimOrder(id);
        succeeded.push(id);
      } catch (err) {
        failed.push(`#${id}: ${err.message}`);
      }
    }
    setClaiming(false);
    if (succeeded.length) setNotice(`Claimed ${succeeded.length} order${succeeded.length > 1 ? 's' : ''}: ${succeeded.map((s) => `#${s}`).join(', ')}`);
    if (failed.length) setError(failed.join(' · '));
    await load();
  }

  const zoneMatches = orders.filter((o) => o.in_my_zone);
  const others = orders.filter((o) => !o.in_my_zone);

  function renderRow(o) {
    return (
      <tr key={o.id}>
        <td>
          <input type="checkbox" checked={!!checked[o.id]} onChange={() => toggle(o.id)} />
        </td>
        <td className="mono">#{o.id}</td>
        <td>{o.pickup_area_name} → {o.drop_area_name}</td>
        <td>
          {o.in_my_zone
            ? <span className="status-pill status-Delivered">In your zone</span>
            : <span className="helper-text">{o.pickup_zone_name}</span>}
        </td>
        <td>{o.order_type} · {o.payment_type}</td>
        <td className="mono">₹{o.total_charge}</td>
        <td>{o.customer_name}</td>
        <td><Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">Details</Link></td>
      </tr>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Available Pickups</h1>
          <p>Unassigned orders waiting for a driver. Tick the ones you can take and claim them — first come, first served.</p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      {selectedIds.length > 0 && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{selectedIds.length} order{selectedIds.length > 1 ? 's' : ''} selected</span>
          <button className="btn btn-accent" onClick={handleClaimSelected} disabled={claiming}>
            {claiming ? 'Claiming…' : `Take Charge of Selected`}
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 24px 0' }}>
          <h3>In Your Zone {zoneMatches.length > 0 && `(${zoneMatches.length})`}</h3>
        </div>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : zoneMatches.length === 0 ? (
          <div className="empty-state">No unassigned orders in your current zone right now.</div>
        ) : (
          <table>
            <thead>
              <tr><th></th><th>Order</th><th>Route</th><th>Zone</th><th>Type</th><th>Charge</th><th>Customer</th><th></th></tr>
            </thead>
            <tbody>{zoneMatches.map(renderRow)}</tbody>
          </table>
        )}
      </div>

      {others.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px 0' }}>
            <h3>Other Zones ({others.length})</h3>
          </div>
          <table>
            <thead>
              <tr><th></th><th>Order</th><th>Route</th><th>Zone</th><th>Type</th><th>Charge</th><th>Customer</th><th></th></tr>
            </thead>
            <tbody>{others.map(renderRow)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
