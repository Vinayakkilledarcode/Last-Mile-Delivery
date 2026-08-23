import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatusPill from '../components/StatusPill.jsx';

const NEXT_STATUS = {
  Created: 'Picked Up',
  'Picked Up': 'In Transit',
  'In Transit': 'Out for Delivery',
  'Out for Delivery': 'Delivered',
  Rescheduled: 'Picked Up',
};

const ALL_STATUSES = ['Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Rescheduled'];

export default function OrderDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');

  async function load() {
    try {
      const data = await api.getOrder(id);
      setOrder(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    if (user.role === 'admin') api.agents().then(setAgents).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAction(fn, successMsg) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(successMsg);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <div className="error-banner">{error}</div>;
  if (!order) return <div className="empty-state">Loading order…</div>;

  const canAdvance = (user.role === 'agent' && order.agent_id === user.id) || user.role === 'admin';
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Order #{order.id}</h1>
          <p>{order.pickup_area_name} → {order.drop_area_name} · placed {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <StatusPill status={order.status} />
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3>Shipment</h3>
            <table>
              <tbody>
                <tr><td>Customer</td><td>{order.customer_name} ({order.customer_email})</td></tr>
                <tr><td>Pickup</td><td>{order.pickup_address}</td></tr>
                <tr><td>Drop</td><td>{order.drop_address}</td></tr>
                <tr><td>Dimensions</td><td>{order.length_cm} × {order.breadth_cm} × {order.height_cm} cm</td></tr>
                <tr><td>Actual / Billed weight</td><td>{order.actual_weight_kg} kg / {order.billed_weight_kg} kg</td></tr>
                <tr><td>Order type</td><td>{order.order_type} · {order.payment_type}</td></tr>
                <tr><td>Total charge</td><td className="mono">₹{order.total_charge}</td></tr>
                <tr><td>Agent</td><td>{order.agent_name ? `${order.agent_name} (${order.agent_phone})` : 'Not assigned yet'}</td></tr>
                {order.reschedule_date && <tr><td>Rescheduled for</td><td>{order.reschedule_date}</td></tr>}
              </tbody>
            </table>
          </div>

          {user.role === 'admin' && (
            <div className="card">
              <h3>Admin Controls</h3>
              <div className="field">
                <label>Assign agent</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Auto-assign nearest available</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id} disabled={!a.is_available}>
                        {a.name} — {a.zone_name || 'no zone'} {a.is_available ? '' : '(unavailable)'}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => runAction(() => api.assignOrder(order.id, selectedAgent || undefined), 'Agent assigned.')}
                  >
                    Assign
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Override status</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select status</option>
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    className="btn btn-ghost"
                    disabled={busy || !overrideStatus}
                    onClick={() => runAction(() => api.updateStatus(order.id, overrideStatus, 'Manually set by admin'), 'Status updated.')}
                  >
                    Set
                  </button>
                </div>
                <div className="helper-text">Admin overrides skip the normal lifecycle checks — use for corrections.</div>
              </div>
            </div>
          )}

          {user.role === 'agent' && canAdvance && (
            <div className="card">
              <h3>Update Delivery</h3>
              {nextStatus && (
                <button
                  className="btn btn-accent"
                  disabled={busy}
                  onClick={() => runAction(() => api.updateStatus(order.id, nextStatus), `Marked as ${nextStatus}.`)}
                  style={{ marginRight: 10 }}
                >
                  Mark as {nextStatus}
                </button>
              )}
              {['Picked Up', 'In Transit', 'Out for Delivery'].includes(order.status) && (
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => runAction(() => api.updateStatus(order.id, 'Failed', 'Delivery attempt failed'), 'Marked as failed.')}
                >
                  Mark as Failed
                </button>
              )}
            </div>
          )}

          {user.role === 'customer' && order.status === 'Failed' && (
            <div className="card">
              <h3>Reschedule Delivery</h3>
              <p className="helper-text" style={{ marginBottom: 12 }}>
                This delivery could not be completed. Pick a new date and we will reassign an agent.
              </p>
              <div className="field">
                <label>New delivery date</label>
                <input type="date" value={rescheduleDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setRescheduleDate(e.target.value)} />
              </div>
              <button
                className="btn btn-accent"
                disabled={busy || !rescheduleDate}
                onClick={() => runAction(() => api.reschedule(order.id, rescheduleDate), 'Delivery rescheduled.')}
              >
                Reschedule
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Tracking Timeline</h3>
          <ul className="timeline">
            {order.history.map((h) => (
              <li key={h.id}>
                <div className="t-status">{h.status}</div>
                <div className="t-meta">{new Date(h.created_at).toLocaleString()} · {h.actor_name || 'system'} ({h.actor_role})</div>
                {h.note && <div className="t-note">{h.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
