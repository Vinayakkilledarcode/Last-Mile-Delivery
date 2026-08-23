import { useEffect, useState } from 'react';
import { api } from '../api.js';

const COMBOS = [
  { order_type: 'B2C', zone_type: 'intra', label: 'B2C · Intra-zone' },
  { order_type: 'B2C', zone_type: 'inter', label: 'B2C · Inter-zone' },
  { order_type: 'B2B', zone_type: 'intra', label: 'B2B · Intra-zone' },
  { order_type: 'B2B', zone_type: 'inter', label: 'B2B · Inter-zone' },
];

export default function AdminRateCards() {
  const [rateCards, setRateCards] = useState([]);
  const [codSurcharges, setCodSurcharges] = useState([]);
  const [form, setForm] = useState({});
  const [codForm, setCodForm] = useState({ B2C: '', B2B: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    try {
      const { rateCards, codSurcharges } = await api.rateCards();
      setRateCards(rateCards);
      setCodSurcharges(codSurcharges);
      const nextForm = {};
      COMBOS.forEach((c) => {
        const existing = rateCards.find((r) => r.order_type === c.order_type && r.zone_type === c.zone_type);
        nextForm[`${c.order_type}-${c.zone_type}`] = {
          base_price: existing?.base_price ?? '',
          rate_per_kg: existing?.rate_per_kg ?? '',
        };
      });
      setForm(nextForm);
      const nextCod = { B2C: '', B2B: '' };
      codSurcharges.forEach((c) => { nextCod[c.order_type] = c.surcharge_amount; });
      setCodForm(nextCod);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(combo) {
    setError('');
    setNotice('');
    const key = `${combo.order_type}-${combo.zone_type}`;
    const values = form[key];
    if (values.base_price === '' || values.rate_per_kg === '') {
      setError('Both base price and rate per kg are required.');
      return;
    }
    try {
      await api.updateRateCard({
        order_type: combo.order_type,
        zone_type: combo.zone_type,
        base_price: Number(values.base_price),
        rate_per_kg: Number(values.rate_per_kg),
      });
      setNotice(`${combo.label} rate card saved.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveCod(orderType) {
    setError('');
    setNotice('');
    if (codForm[orderType] === '') {
      setError('Enter a surcharge amount.');
      return;
    }
    try {
      await api.updateCodSurcharge({ order_type: orderType, surcharge_amount: Number(codForm[orderType]) });
      setNotice(`${orderType} COD surcharge saved.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rate Cards</h1>
          <p>Every price the engine uses to calculate a charge is configured here — nothing is hardcoded.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="grid-2">
        {COMBOS.map((combo) => {
          const key = `${combo.order_type}-${combo.zone_type}`;
          const values = form[key] || { base_price: '', rate_per_kg: '' };
          return (
            <div className="card" key={key}>
              <h3>{combo.label}</h3>
              <div className="field">
                <label>Base price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={values.base_price}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: { ...f[key], base_price: e.target.value } }))}
                />
              </div>
              <div className="field">
                <label>Rate per kg (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={values.rate_per_kg}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: { ...f[key], rate_per_kg: e.target.value } }))}
                />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => handleSave(combo)}>Save</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>COD Surcharge</h3>
        <p className="helper-text" style={{ marginBottom: 14 }}>Added on top of the base charge whenever payment type is Cash on Delivery.</p>
        <div className="grid-2">
          {['B2C', 'B2B'].map((type) => (
            <div key={type} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label>{type} surcharge (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={codForm[type]}
                  onChange={(e) => setCodForm((f) => ({ ...f, [type]: e.target.value }))}
                />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => handleSaveCod(type)}>Save</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
