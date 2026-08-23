import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const emptyForm = {
  customerEmail: '',
  pickupAddress: '',
  pickupArea: '',
  dropAddress: '',
  dropArea: '',
  length: '',
  breadth: '',
  height: '',
  actualWeight: '',
  orderType: 'B2C',
  paymentType: 'Prepaid',
};

export default function PlaceOrder() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [zones, setZones] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.zones().then(setZones).catch(() => {});
  }, []);

  const allAreas = zones.flatMap((z) => z.areas.map((a) => ({ ...a, zoneName: z.name })));

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setQuote(null);
  }

  const canQuote = form.pickupArea && form.dropArea && form.length && form.breadth && form.height && form.actualWeight;

  async function handleGetQuote() {
    setQuoteError('');
    setQuoting(true);
    try {
      const result = await api.quote({
        pickupArea: form.pickupArea,
        dropArea: form.dropArea,
        length: Number(form.length),
        breadth: Number(form.breadth),
        height: Number(form.height),
        actualWeight: Number(form.actualWeight),
        orderType: form.orderType,
        paymentType: form.paymentType,
      });
      setQuote(result);
    } catch (err) {
      setQuoteError(err.message);
    } finally {
      setQuoting(false);
    }
  }

  async function handleConfirm() {
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (user.role !== 'admin') delete payload.customerEmail;
      const order = await api.createOrder(payload);
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Place an Order</h1>
          <p>Enter package and address details to see the delivery charge before confirming.</p>
        </div>
      </div>

      {submitError && <div className="error-banner">{submitError}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          {user.role === 'admin' && (
            <div className="card">
              <h3>Order on behalf of</h3>
              <div className="field">
                <label>Customer email</label>
                <input
                  value={form.customerEmail}
                  onChange={(e) => update('customerEmail', e.target.value)}
                  placeholder="customer@example.com"
                />
                <div className="helper-text">Leave blank only if you are testing as the customer yourself.</div>
              </div>
            </div>
          )}

          <div className="card">
            <h3>Pickup & Drop</h3>
            <div className="field">
              <label>Pickup address</label>
              <input value={form.pickupAddress} onChange={(e) => update('pickupAddress', e.target.value)} required />
            </div>
            <div className="field">
              <label>Pickup area</label>
              <select value={form.pickupArea} onChange={(e) => update('pickupArea', e.target.value)} required>
                <option value="">Select area</option>
                {allAreas.map((a) => (
                  <option key={a.id} value={a.name}>{a.name} ({a.zoneName})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Drop address</label>
              <input value={form.dropAddress} onChange={(e) => update('dropAddress', e.target.value)} required />
            </div>
            <div className="field">
              <label>Drop area</label>
              <select value={form.dropArea} onChange={(e) => update('dropArea', e.target.value)} required>
                <option value="">Select area</option>
                {allAreas.map((a) => (
                  <option key={a.id} value={a.name}>{a.name} ({a.zoneName})</option>
                ))}
              </select>
            </div>
            {allAreas.length === 0 && (
              <div className="helper-text">No areas configured yet — ask an admin to set up zones first.</div>
            )}
          </div>

          <div className="card">
            <h3>Package Details</h3>
            <div className="grid-3">
              <div className="field">
                <label>Length (cm)</label>
                <input type="number" min="1" value={form.length} onChange={(e) => update('length', e.target.value)} required />
              </div>
              <div className="field">
                <label>Breadth (cm)</label>
                <input type="number" min="1" value={form.breadth} onChange={(e) => update('breadth', e.target.value)} required />
              </div>
              <div className="field">
                <label>Height (cm)</label>
                <input type="number" min="1" value={form.height} onChange={(e) => update('height', e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label>Actual weight (kg)</label>
              <input type="number" min="0.1" step="0.1" value={form.actualWeight} onChange={(e) => update('actualWeight', e.target.value)} required />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Order type</label>
                <select value={form.orderType} onChange={(e) => update('orderType', e.target.value)}>
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                </select>
              </div>
              <div className="field">
                <label>Payment type</label>
                <select value={form.paymentType} onChange={(e) => update('paymentType', e.target.value)}>
                  <option value="Prepaid">Prepaid</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
            </div>
          </div>

          <button className="btn btn-ghost" onClick={handleGetQuote} disabled={!canQuote || quoting}>
            {quoting ? 'Calculating…' : 'Calculate Charge'}
          </button>
        </div>

        <div>
          {quoteError && <div className="error-banner">{quoteError}</div>}
          {quote ? (
            <div className="charge-box">
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8993A3', marginBottom: 4 }}>
                Estimated charge
              </div>
              <div className="total">₹{quote.totalCharge}</div>
              <div style={{ height: 16 }} />
              <div className="row"><span>Route</span><span>{quote.zoneRelation === 'intra' ? 'Intra-zone' : 'Inter-zone'}</span></div>
              <div className="row"><span>Volumetric weight</span><span>{quote.volumetricWeight} kg</span></div>
              <div className="row"><span>Billed weight</span><span>{quote.billedWeight} kg</span></div>
              <div className="row"><span>Base charge</span><span>₹{quote.baseCharge}</span></div>
              <div className="row"><span>COD surcharge</span><span>₹{quote.codSurcharge}</span></div>
              <div style={{ height: 16 }} />
              <button
                className="btn btn-accent"
                onClick={handleConfirm}
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {submitting ? 'Placing order…' : 'Confirm & Place Order'}
              </button>
            </div>
          ) : (
            <div className="card empty-state">
              Fill in the details and calculate the charge to see it here before you confirm.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
