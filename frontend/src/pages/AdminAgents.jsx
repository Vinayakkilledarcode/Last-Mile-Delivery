import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setAgents(await api.agents());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Agents</h1>
          <p>Availability and current zone drive who gets picked for auto-assignment.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {agents.length === 0 ? (
          <div className="empty-state">No delivery agents have registered yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Contact</th><th>Zone</th><th>Active orders</th><th>Availability</th></tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}<br /><span className="helper-text">{a.phone}</span></td>
                  <td>{a.zone_name || '—'}</td>
                  <td>{a.active_orders}</td>
                  <td>
                    <span className={`status-pill ${a.is_available ? 'status-Delivered' : 'status-Failed'}`}>
                      {a.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
