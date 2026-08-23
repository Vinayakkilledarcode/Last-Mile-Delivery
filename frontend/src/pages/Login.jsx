import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(email.trim().toLowerCase(), password);
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
        <p className="helper-text" style={{ marginBottom: 24 }}>Sign in to track and manage deliveries.</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="helper-text" style={{ marginTop: 18 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
        <p className="helper-text" style={{ marginTop: 18, lineHeight: 1.6 }}>
          Demo logins — admin@lastmile.test / admin123, priya@lastmile.test / customer123, ravi.agent@lastmile.test / agent123
        </p>
      </div>
    </div>
  );
}
