import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'customer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const emailTaken = error === 'An account with this email already exists';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, email: form.email.trim().toLowerCase(), name: form.name.trim() };
      const { token, user } = await api.register(payload);
      login(token, user);
      navigate(user.role === 'agent' ? '/agent' : '/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">LM</span><span>Last-Mile</span></div>
        <p className="helper-text" style={{ marginBottom: 24 }}>Create an account to place or deliver orders.</p>
        {error && (
          <div className="error-banner">
            {error}
            {emailTaken && (
              <>
                {' '}
                <Link to="/login" style={{ fontWeight: 600 }}>Sign in instead →</Link>
              </>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="field">
            <label>Full name</label>
            <input
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Phone</label>
            <input
              name="phone"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="field">
            <label>I am a</label>
            <select value={form.role} onChange={(e) => update('role', e.target.value)}>
              <option value="customer">Customer</option>
              <option value="agent">Delivery agent</option>
            </select>
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="helper-text" style={{ marginTop: 18 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
