import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function AdminZones() {
  const [zones, setZones] = useState([]);
  const [newZoneName, setNewZoneName] = useState('');
  const [areaInputs, setAreaInputs] = useState({});
  const [error, setError] = useState('');

  async function load() {
    try {
      setZones(await api.zones());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAddZone(e) {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      await api.createZone(newZoneName.trim());
      setNewZoneName('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteZone(id) {
    try {
      await api.deleteZone(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddArea(zoneId) {
    const name = (areaInputs[zoneId] || '').trim();
    if (!name) return;
    try {
      await api.addArea(zoneId, name);
      setAreaInputs((s) => ({ ...s, [zoneId]: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteArea(areaId) {
    try {
      await api.deleteArea(areaId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Zones & Areas</h1>
          <p>Zones define the geography of your rate card. Areas (pincodes, localities) map addresses into a zone.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3>Add a Zone</h3>
        <form onSubmit={handleAddZone} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="e.g. West Zone" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} />
          <button className="btn btn-accent" type="submit">Add Zone</button>
        </form>
      </div>

      {zones.length === 0 && <div className="card empty-state">No zones yet. Add your first zone above to get started.</div>}

      {zones.map((zone) => (
        <div className="card" key={zone.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{zone.name}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteZone(zone.id)}>Delete zone</button>
          </div>
          <div style={{ marginBottom: 12 }}>
            {zone.areas.length === 0 && <span className="helper-text">No areas mapped to this zone yet.</span>}
            {zone.areas.map((a) => (
              <span className="zone-chip" key={a.id}>
                {a.name}
                <button onClick={() => handleDeleteArea(a.id)} title="Remove area">×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Area name, e.g. Koramangala"
              value={areaInputs[zone.id] || ''}
              onChange={(e) => setAreaInputs((s) => ({ ...s, [zone.id]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddArea(zone.id)}
            />
            <button className="btn btn-ghost" onClick={() => handleAddArea(zone.id)}>Add Area</button>
          </div>
        </div>
      ))}
    </div>
  );
}
