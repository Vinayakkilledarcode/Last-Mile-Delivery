import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV_BY_ROLE = {
  customer: [
    { to: '/orders/new', label: 'Place an Order' },
    { to: '/orders', label: 'My Orders' },
  ],
  agent: [
    { to: '/agent', label: 'My Deliveries' },
    { to: '/agent/available', label: 'Available Pickups' },
  ],
  admin: [
    { to: '/orders', label: 'All Orders' },
    { to: '/orders/new', label: 'Place an Order' },
    { to: '/admin/zones', label: 'Zones & Areas' },
    { to: '/admin/rates', label: 'Rate Cards' },
    { to: '/admin/agents', label: 'Agents' },
  ],
};

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const links = NAV_BY_ROLE[user.role] || [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">LM</span>
          <span>Last-Mile</span>
        </div>
        <div className="brand-sub">Delivery Operations</div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              end={link.to === '/orders' || link.to === '/agent'}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials(user.name)}</div>
            <div>
              <div className="user-chip-name">{user.name}</div>
              <div className="user-chip-role">{user.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
