const { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } = React;

// ─── Utilities ──────────────────────────────────────────────────────────────

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const formatDate = (s) => {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
};
const timeAgo = (s) => {
  if (!s) return '';
  const d = new Date(s); const now = new Date(); const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return formatDate(s);
};

// ─── Toast System ───────────────────────────────────────────────────────────

const ToastCtx = createContext(null);
const useToast = () => useContext(ToastCtx);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const colors = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    warning: 'bg-amber-500 text-white',
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast font-medium ${colors[t.type] || colors.info}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

// ─── Theme Context ──────────────────────────────────────────────────────────

const ThemeCtx = createContext(null);
const useTheme = () => useContext(ThemeCtx);
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('gs_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gs_theme', theme);
    if (window.__INITIAL_USER__) api('/api/auth/update-theme', { method: 'POST', body: { theme } }).catch(() => {});
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, setTheme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>{children}</ThemeCtx.Provider>;
};

// ─── Router (hash-based) ────────────────────────────────────────────────────

const RouterCtx = createContext(null);
const useRouter = () => useContext(RouterCtx);
const parseHash = () => {
  const h = window.location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const params = new URLSearchParams(qs || '');
  return { path, params };
};
const RouterProvider = ({ children }) => {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((to) => { window.location.hash = to; }, []);
  return <RouterCtx.Provider value={{ ...route, navigate }}>{children}</RouterCtx.Provider>;
};
const Link = ({ to, className, children, ...rest }) => {
  const { navigate } = useRouter();
  return (
    <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); navigate(to); }} {...rest}>
      {children}
    </a>
  );
};

// ─── Auth Context ───────────────────────────────────────────────────────────

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(window.__INITIAL_USER__);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await api('/api/auth/me');
      setUser(data.user);
    } catch { setUser(null); }
  }, []);
  const login = useCallback(() => {
    // Triggers Replit auth iframe
    if (window.LoginWithReplit) {
      window.LoginWithReplit().then(() => { window.location.reload(); });
    } else {
      const s = document.createElement('script');
      s.src = 'https://replit.com/public/js/repl-auth-v2.js';
      s.onload = () => window.LoginWithReplit().then(() => window.location.reload());
      document.body.appendChild(s);
    }
  }, []);
  const logout = useCallback(() => { window.location.href = '/__replauth_logout'; }, []);
  return <AuthCtx.Provider value={{ user, setUser, loading, refresh, login, logout }}>{children}</AuthCtx.Provider>;
};

// ─── Icons (inline SVG, lucide-style) ───────────────────────────────────────

const I = {
  menu: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  user: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  brain: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04Z"/></svg>,
  grad: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  heart: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  dollar: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  cart: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  pin: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  case: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  film: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>,
  users: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  crown: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>,
  zap: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  sun: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  bell: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  eye: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  thumb: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
  spark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/></svg>,
};

// ─── Domain Definitions ─────────────────────────────────────────────────────

const DOMAINS = [
  { name: 'Technology & AI', slug: 'technology', path: '/technology', icon: 'brain', color: 'blue', desc: 'AI tools, programming, gadgets' },
  { name: 'Education', slug: 'education', path: '/content?domain=education', icon: 'grad', color: 'purple', desc: 'Online learning & courses' },
  { name: 'Health & Wellness', slug: 'health', path: '/content?domain=health', icon: 'heart', color: 'red', desc: 'Fitness, mental health, nutrition' },
  { name: 'Finance', slug: 'finance', path: '/content?domain=finance', icon: 'dollar', color: 'green', desc: 'Investing, savings, fintech' },
  { name: 'E-Commerce', slug: 'ecommerce', path: '/content?domain=ecommerce', icon: 'cart', color: 'orange', desc: 'Online stores & retail' },
  { name: 'Travel', slug: 'travel', path: '/content?domain=travel', icon: 'pin', color: 'teal', desc: 'Destinations & experiences' },
  { name: 'Business', slug: 'business', path: '/content?domain=business', icon: 'case', color: 'indigo', desc: 'Strategy & management' },
  { name: 'Entertainment', slug: 'entertainment', path: '/content?domain=entertainment', icon: 'film', color: 'pink', desc: 'Movies, music, gaming' },
  { name: 'Jobs & Freelancing', slug: 'jobs', path: '/jobs', icon: 'users', color: 'yellow', desc: 'Find work & talent' },
];
const colorMap = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', soft: 'bg-blue-100 dark:bg-blue-950/40' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', soft: 'bg-purple-100 dark:bg-purple-950/40' },
  red: { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', soft: 'bg-red-100 dark:bg-red-950/40' },
  green: { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', soft: 'bg-green-100 dark:bg-green-950/40' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', soft: 'bg-orange-100 dark:bg-orange-950/40' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-500', border: 'border-teal-500', soft: 'bg-teal-100 dark:bg-teal-950/40' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500', soft: 'bg-indigo-100 dark:bg-indigo-950/40' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', soft: 'bg-pink-100 dark:bg-pink-950/40' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500', soft: 'bg-yellow-100 dark:bg-yellow-950/40' },
};

// ─── Layout (Sidebar + Main) ────────────────────────────────────────────────

const Sidebar = ({ open, setOpen }) => {
  const { path } = useRouter();
  const { user, login, logout } = useAuth();
  const navItems = [
    { label: 'Home', to: '/', icon: 'menu', color: 'blue' },
    ...(user ? [{ label: 'Dashboard', to: '/dashboard', icon: 'user', color: 'purple' }] : []),
    { label: 'Search', to: '/search', icon: 'search', color: 'teal' },
    { label: 'Content', to: '/content', icon: 'film', color: 'pink' },
    ...(user ? [
      { label: 'Activity', to: '/activity', icon: 'zap', color: 'green' },
      { label: 'Payment', to: '/payment', icon: 'crown', color: 'yellow' },
    ] : []),
  ];
  const isActive = (to) => path === to.split('?')[0];

  return (
    <>
      {open && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 z-40 transform transition-transform glass border-r-4 border-zinc-900 dark:border-zinc-100 flex flex-col ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b-4 border-zinc-900 dark:border-zinc-100">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-pink-500 flex items-center justify-center text-white font-black text-2xl border-3 border-zinc-900 dark:border-zinc-100 transform group-hover:rotate-6 transition-transform">G</div>
            <div>
              <h2 className="font-black text-xl tracking-tight">GuideSoft</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Nine Worlds Hub</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm uppercase transition-all ${
                isActive(n.to) ? `${colorMap[n.color].bg} text-white shadow-lg` : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}>
              {React.createElement(I[n.icon] || I.menu, { className: 'w-4 h-4' })}
              {n.label}
            </Link>
          ))}

          <div className="pt-3 mt-3 border-t-2 border-zinc-300 dark:border-zinc-700">
            <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-widest opacity-60">Domains</p>
            {DOMAINS.map((d) => (
              <Link key={d.slug} to={d.path} onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                <span className={`w-2 h-2 rounded-full ${colorMap[d.color].bg}`}></span>
                <span className="truncate">{d.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="p-4 border-t-4 border-zinc-900 dark:border-zinc-100">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-black text-sm">
                  {(user.full_name || user.username || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate">{user.full_name || user.username}</p>
                  <p className="text-[10px] opacity-70 flex items-center gap-1">
                    {user.subscription_type === 'premium' ? <><I.crown className="w-3 h-3" /> Premium</> : 'Free'}
                    <span className="ml-auto text-blue-500 font-bold">{user.points || 0} pts</span>
                  </p>
                </div>
              </div>
              <button onClick={logout} className="w-full px-3 py-2 rounded-lg bg-red-500 text-white font-bold text-xs uppercase hover:bg-red-600 transition-colors">
                Logout
              </button>
            </div>
          ) : (
            <button onClick={login} className="w-full px-3 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-black text-sm uppercase hover:opacity-90 transition-opacity">
              Sign In Free
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

const TopBar = ({ onMenu }) => {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [q, setQ] = useState('');
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (user) api('/api/notifications').then((d) => setNotifs(d.notifications || [])).catch(() => {});
  }, [user]);

  const submit = (e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q)}`); };

  return (
    <header className="sticky top-0 z-20 glass border-b-4 border-zinc-900 dark:border-zinc-100 px-4 py-3 flex items-center gap-3">
      <button onClick={onMenu} className="lg:hidden p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800">
        <I.menu className="w-5 h-5" />
      </button>
      <form onSubmit={submit} className="flex-1 max-w-xl">
        <div className="relative">
          <I.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search content, jobs, organizations..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 font-medium text-sm focus:border-blue-500" />
        </div>
      </form>
      <button onClick={toggle} className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Toggle theme">
        {theme === 'dark' ? <I.sun className="w-5 h-5" /> : <I.moon className="w-5 h-5" />}
      </button>
      {user && (
        <div className="relative">
          <button onClick={() => setShowNotifs(s => !s)} className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 relative">
            <I.bell className="w-5 h-5" />
            {notifs.filter(n => !n.is_read).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto glass rounded-lg border-2 border-zinc-900 dark:border-zinc-100 shadow-2xl">
              <div className="p-3 border-b-2 border-zinc-300 dark:border-zinc-700 font-bold text-sm">Notifications</div>
              {notifs.length === 0 ? (
                <p className="p-6 text-center text-sm opacity-60">No notifications</p>
              ) : notifs.map(n => (
                <div key={n.id} className={`p-3 border-b border-zinc-200 dark:border-zinc-800 ${!n.is_read ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                  <p className="font-bold text-xs">{n.title}</p>
                  <p className="text-xs opacity-70">{n.message}</p>
                  <p className="text-[10px] opacity-50 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

// ─── Reusable Components ────────────────────────────────────────────────────

const Card = ({ children, className = '', ...p }) => (
  <div className={`bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 ${className}`} {...p}>{children}</div>
);
const Button = ({ children, variant = 'primary', size = 'md', className = '', ...p }) => {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    ghost: 'hover:bg-zinc-200 dark:hover:bg-zinc-800',
    gradient: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 text-white',
  };
  return <button className={`${sizes[size]} ${variants[variant]} rounded-lg font-bold uppercase tracking-wide transition-all ${className}`} {...p}>{children}</button>;
};
const Input = ({ className = '', ...p }) => (
  <input className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 text-sm font-medium ${className}`} {...p} />
);
const Textarea = ({ className = '', ...p }) => (
  <textarea className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 text-sm ${className}`} {...p} />
);
const Select = ({ className = '', children, ...p }) => (
  <select className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 text-sm font-medium ${className}`} {...p}>{children}</select>
);
const Label = ({ children }) => <label className="block text-xs font-bold uppercase tracking-wide mb-1">{children}</label>;
const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-zinc-900 dark:border-zinc-100" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-black uppercase">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"><I.x className="w-5 h-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};
const Badge = ({ children, color = 'blue' }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${colorMap[color]?.soft || 'bg-zinc-200 dark:bg-zinc-800'} ${colorMap[color]?.text || ''}`}>{children}</span>
);
const Spinner = () => <div className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin-slow"></div>;
const Empty = ({ icon = 'spark', title, desc, action }) => (
  <div className="text-center py-16 px-6">
    <div className="inline-flex w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center mb-4">
      {React.createElement(I[icon], { className: 'w-8 h-8 opacity-60' })}
    </div>
    <h3 className="text-lg font-black mb-2">{title}</h3>
    {desc && <p className="text-sm opacity-70 mb-4 max-w-md mx-auto">{desc}</p>}
    {action}
  </div>
);
const RequireAuth = ({ children }) => {
  const { user, login } = useAuth();
  if (!user) return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <I.user className="w-16 h-16 mx-auto opacity-40 mb-4" />
      <h2 className="text-2xl font-black mb-2">Sign in required</h2>
      <p className="opacity-70 mb-6">Please sign in to access this page</p>
      <Button variant="gradient" size="lg" onClick={login}>Sign In Free</Button>
    </div>
  );
  return children;
};

// ─── Pages ──────────────────────────────────────────────────────────────────

const HomePage = () => {
  const { user, login } = useAuth();
  const [stats, setStats] = useState({ content: 0, jobs: 0, entities: 0 });
  useEffect(() => {
    Promise.all([
      api('/api/content').catch(() => ({ content: [] })),
      api('/api/jobs').catch(() => ({ jobs: [] })),
      api('/api/entities').catch(() => ({ entities: [] })),
    ]).then(([c, j, e]) => setStats({ content: c.content?.length || 0, jobs: j.jobs?.length || 0, entities: e.entities?.length || 0 }));
  }, []);
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl gradient-mesh p-8 md:p-16 border-4 border-zinc-900 dark:border-zinc-100">
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-2 border-zinc-900 dark:border-zinc-100 text-xs font-black uppercase mb-6 animate-fadeInUp">
            <I.spark className="w-3 h-3" /> 2026 Edition
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            One hub. <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Nine worlds.</span> Endless possibilities.
          </h1>
          <p className="text-lg md:text-xl opacity-80 mb-8 max-w-2xl animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            GuideSoft connects technology, education, finance, jobs, and more into one premium platform built for the modern professional.
          </p>
          <div className="flex flex-wrap gap-3 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            {user ? (
              <>
                <Link to="/dashboard"><Button size="lg" variant="gradient">Go to Dashboard</Button></Link>
                <Link to="/content"><Button size="lg" variant="secondary">Explore Content</Button></Link>
              </>
            ) : (
              <>
                <Button size="lg" variant="gradient" onClick={login}>Get Started Free</Button>
                <Link to="/search"><Button size="lg" variant="secondary">Explore</Button></Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { label: 'Articles', val: stats.content, icon: 'film', color: 'pink' },
          { label: 'Open Jobs', val: stats.jobs, icon: 'case', color: 'yellow' },
          { label: 'Organizations', val: stats.entities, icon: 'users', color: 'indigo' },
        ].map((s, i) => (
          <Card key={s.label} className="p-6 card-hover" style={{ animation: `fadeInUp 0.5s ${0.1 * i}s forwards`, opacity: 0 }}>
            <div className={`w-10 h-10 rounded-lg ${colorMap[s.color].bg} text-white flex items-center justify-center mb-3`}>
              {React.createElement(I[s.icon], { className: 'w-5 h-5' })}
            </div>
            <div className="text-3xl md:text-4xl font-black">{s.val}+</div>
            <div className="text-xs font-bold uppercase opacity-70">{s.label}</div>
          </Card>
        ))}
      </section>

      {/* Domains */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Explore the Nine Worlds</h2>
            <p className="opacity-70 mt-1">Pick a domain to dive in</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOMAINS.map((d, i) => (
            <Link key={d.slug} to={d.path}>
              <Card className={`p-6 card-hover h-full ${colorMap[d.color].soft}`} style={{ animation: `fadeInUp 0.5s ${0.05 * i}s forwards`, opacity: 0 }}>
                <div className={`w-12 h-12 rounded-xl ${colorMap[d.color].bg} text-white flex items-center justify-center mb-4`}>
                  {React.createElement(I[d.icon], { className: 'w-6 h-6' })}
                </div>
                <h3 className="text-lg font-black mb-1">{d.name}</h3>
                <p className="text-sm opacity-70">{d.desc}</p>
                <div className={`inline-flex items-center gap-1 mt-3 text-xs font-bold ${colorMap[d.color].text}`}>
                  Explore <I.arrow className="w-3 h-3" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-10 md:p-16 text-white text-center border-4 border-zinc-900 dark:border-zinc-100">
          <h2 className="text-3xl md:text-5xl font-black mb-4">Join thousands of pros</h2>
          <p className="text-lg opacity-90 mb-6 max-w-2xl mx-auto">Sign up free and unlock your dashboard, save content, apply for jobs, and more.</p>
          <Button size="lg" onClick={login} className="bg-white !text-blue-600 hover:bg-zinc-100">Sign In Free</Button>
        </section>
      )}
    </div>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showNew, setShowNew] = useState(null); // 'project' | 'task'
  const toast = useToast();

  const load = useCallback(() => {
    Promise.all([
      api('/api/dashboard/stats'),
      api('/api/tasks'),
      api('/api/projects'),
    ]).then(([d, t, p]) => { setData(d); setTasks(t.tasks || []); setProjects(p.projects || []); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const updateTaskStatus = async (id, status) => {
    try {
      await api(`/api/tasks/${id}`, { method: 'PUT', body: { status } });
      setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
      toast(`Task moved to ${status}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  if (!data) return <DashboardSkeleton />;
  const s = data.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black">Welcome back, {user.full_name || user.username}</h1>
          <p className="opacity-70">Here's your activity overview</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNew('project')} variant="gradient"><I.plus className="w-4 h-4 inline mr-1" /> New Project</Button>
          <Button onClick={() => setShowNew('task')} variant="primary"><I.plus className="w-4 h-4 inline mr-1" /> New Task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Projects', val: s.projects, color: 'blue', icon: 'case' },
          { label: 'Total Tasks', val: s.tasks, color: 'purple', icon: 'check' },
          { label: 'Completed', val: s.tasks_done, color: 'green', icon: 'check' },
          { label: 'Content', val: s.content, color: 'pink', icon: 'film' },
          { label: 'Points', val: s.points, color: 'yellow', icon: 'crown' },
        ].map((x) => (
          <Card key={x.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg ${colorMap[x.color].bg} text-white flex items-center justify-center`}>
                {React.createElement(I[x.icon], { className: 'w-4 h-4' })}
              </div>
            </div>
            <div className="text-2xl font-black">{x.val}</div>
            <div className="text-xs font-bold uppercase opacity-70">{x.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Kanban */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-black mb-3">Kanban Board</h2>
          <div className="grid grid-cols-3 gap-3">
            {['todo', 'in_progress', 'done'].map((status) => (
              <div key={status} className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-3 min-h-[300px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wide">{status.replace('_', ' ')}</h3>
                  <Badge color={status === 'todo' ? 'blue' : status === 'in_progress' ? 'yellow' : 'green'}>
                    {tasks.filter(t => t.status === status).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {tasks.filter(t => t.status === status).map((t) => (
                    <div key={t.id} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:shadow-lg transition-all">
                      <p className="font-bold text-sm mb-1">{t.title}</p>
                      {t.description && <p className="text-xs opacity-70 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <Badge color={t.priority === 'high' ? 'red' : t.priority === 'low' ? 'blue' : 'yellow'}>{t.priority}</Badge>
                        <div className="flex gap-1">
                          {status !== 'todo' && <button onClick={() => updateTaskStatus(t.id, status === 'done' ? 'in_progress' : 'todo')} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300">←</button>}
                          {status !== 'done' && <button onClick={() => updateTaskStatus(t.id, status === 'todo' ? 'in_progress' : 'done')} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300">→</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.status === status).length === 0 && (
                    <p className="text-center text-xs opacity-50 py-8">No tasks</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black mb-3">Recent Projects</h2>
            <div className="space-y-2">
              {projects.length === 0 ? <Card className="p-4 text-sm opacity-70">No projects yet</Card> :
                projects.slice(0, 4).map(p => (
                  <Card key={p.id} className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{p.title}</p>
                        <p className="text-xs opacity-70 truncate">{p.description || 'No description'}</p>
                      </div>
                      <Badge color={p.status === 'active' ? 'green' : 'blue'}>{p.status}</Badge>
                    </div>
                    <div className="mt-2 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${p.progress || 0}%` }}></div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3">Recent Activity</h2>
            <Card className="p-3 space-y-2 max-h-80 overflow-y-auto">
              {data.recent_activity.length === 0 ? (
                <p className="text-sm opacity-70 text-center py-4">No recent activity</p>
              ) : data.recent_activity.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium">{a.action.replace(/_/g, ' ')}</p>
                    <p className="opacity-60">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>

      <NewItemModal type={showNew} onClose={() => setShowNew(null)} onCreated={load} projects={projects} />
    </div>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="h-10 w-1/3 skeleton rounded-lg"></div>
    <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 skeleton rounded-xl"></div>)}</div>
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-80 skeleton rounded-xl"></div>)}</div>
      <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl"></div>)}</div>
    </div>
  </div>
);

const NewItemModal = ({ type, onClose, onCreated, projects }) => {
  const [form, setForm] = useState({});
  const toast = useToast();
  useEffect(() => { setForm({}); }, [type]);
  if (!type) return null;
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (type === 'project') {
        await api('/api/projects', { method: 'POST', body: form });
        toast('Project created!', 'success');
      } else {
        await api('/api/tasks', { method: 'POST', body: form });
        toast('Task created!', 'success');
      }
      onCreated(); onClose();
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={true} onClose={onClose} title={`New ${type}`}>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Title *</Label><Input required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Description</Label><Textarea rows="3" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Select value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </Select>
          </div>
          {type === 'project' ? (
            <div>
              <Label>Category</Label>
              <Select value={form.category || 'general'} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </Select>
            </div>
          ) : (
            <div>
              <Label>Project</Label>
              <Select value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value || null })}>
                <option value="">No project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>
          )}
        </div>
        <Button type="submit" variant="gradient" className="w-full">Create {type}</Button>
      </form>
    </Modal>
  );
};

const TechnologyPage = () => {
  const [content, setContent] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      api('/api/content?domain=technology'),
      api('/api/tech/stats'),
    ]).then(([c, s]) => { setContent(c.content || []); setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-8">
      <div className="rounded-3xl gradient-mesh p-8 md:p-12 border-4 border-zinc-900 dark:border-zinc-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center"><I.brain className="w-8 h-8" /></div>
          <div>
            <h1 className="text-4xl font-black">Technology & AI</h1>
            <p className="opacity-70">Latest in tech, AI, and software</p>
          </div>
        </div>
        {stats && (
          <div className="grid grid-cols-3 gap-3 mt-6 max-w-md">
            <div><div className="text-2xl font-black">{stats.content}</div><div className="text-xs opacity-70 uppercase font-bold">Articles</div></div>
            <div><div className="text-2xl font-black">{stats.jobs}</div><div className="text-xs opacity-70 uppercase font-bold">Jobs</div></div>
            <div><div className="text-2xl font-black">{stats.entities}</div><div className="text-xs opacity-70 uppercase font-bold">Companies</div></div>
          </div>
        )}
      </div>
      <div>
        <h2 className="text-2xl font-black mb-4">Featured Articles</h2>
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-72 skeleton rounded-xl"></div>)}</div>
        ) : content.length === 0 ? <Empty title="No tech content yet" /> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{content.map(c => <ContentCard key={c.id} item={c} />)}</div>
        )}
      </div>
    </div>
  );
};

const ContentCard = ({ item }) => {
  const tags = JSON.parse(item.tags || '[]');
  return (
    <Card className="overflow-hidden card-hover">
      {item.image_url && (
        <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-wrap gap-1 mb-2">
          <Badge color="blue">{item.domain}</Badge>
          {tags.slice(0, 2).map(t => <Badge key={t} color="purple">{t}</Badge>)}
        </div>
        <h3 className="font-black text-lg mb-2 line-clamp-2">{item.title}</h3>
        <p className="text-sm opacity-70 line-clamp-2 mb-3">{item.body}</p>
        <div className="flex items-center justify-between text-xs opacity-60">
          <span className="flex items-center gap-1"><I.eye className="w-3 h-3" /> {item.views}</span>
          <span className="flex items-center gap-1"><I.thumb className="w-3 h-3" /> {item.likes}</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </Card>
  );
};

const ContentPage = () => {
  const { params } = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState(params.get('domain') || '');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const { user } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (domain) qs.append('domain', domain);
    if (search) qs.append('search', search);
    api(`/api/content?${qs}`).then(d => { setItems(d.content || []); setLoading(false); }).catch(() => setLoading(false));
  }, [domain, search]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black">Content Library</h1>
          <p className="opacity-70">Articles, guides, and tutorials across all domains</p>
        </div>
        {user && <Button variant="gradient" onClick={() => setShowNew(true)}><I.plus className="w-4 h-4 inline mr-1" /> Create</Button>}
      </div>

      <Card className="p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Filter by domain</Label>
            <Select value={domain} onChange={e => setDomain(e.target.value)}>
              <option value="">All domains</option>
              {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-72 skeleton rounded-xl"></div>)}</div>
      ) : items.length === 0 ? <Empty title="No content found" desc="Try a different filter or be the first to create one!" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{items.map(i => <ContentCard key={i.id} item={i} />)}</div>
      )}

      <NewContentModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
    </div>
  );
};

const NewContentModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ status: 'published', domain: 'technology', category: 'article' });
  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/content', { method: 'POST', body: form });
      toast('Content published!', 'success');
      onCreated(); onClose(); setForm({ status: 'published', domain: 'technology', category: 'article' });
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Create Content">
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Title *</Label><Input required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Body</Label><Textarea rows="6" value={form.body || ''} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Domain</Label>
            <Select value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>
              {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="article">Article</option><option value="guide">Guide</option><option value="tutorial">Tutorial</option><option value="news">News</option>
            </Select>
          </div>
        </div>
        <div><Label>Image URL</Label><Input value={form.image_url || ''} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
        <Button type="submit" variant="gradient" className="w-full">Publish</Button>
      </form>
    </Modal>
  );
};

const JobsPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ domain: '', type: '', search: '' });
  const [showNew, setShowNew] = useState(false);
  const [applyJob, setApplyJob] = useState(null);
  const { user } = useAuth();
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter.domain) qs.append('domain', filter.domain);
    if (filter.type) qs.append('type', filter.type);
    if (filter.search) qs.append('search', filter.search);
    api(`/api/jobs?${qs}`).then(d => { setJobs(d.jobs || []); setLoading(false); }).catch(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 p-8 border-4 border-zinc-900 dark:border-zinc-100 text-white">
        <h1 className="text-4xl font-black">Jobs & Freelancing</h1>
        <p className="opacity-90 mt-2">Discover opportunities across all nine worlds</p>
        {user && <Button onClick={() => setShowNew(true)} className="mt-4 bg-white !text-zinc-900 hover:bg-zinc-100"><I.plus className="w-4 h-4 inline mr-1" /> Post a Job</Button>}
      </div>

      <Card className="p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Domain</Label>
            <Select value={filter.domain} onChange={e => setFilter({ ...filter, domain: e.target.value })}>
              <option value="">All</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
              <option value="">All</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="freelance">Freelance</option><option value="contract">Contract</option>
            </Select>
          </div>
          <div><Label>Search</Label><Input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Title, company..." /></div>
        </div>
      </Card>

      {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl"></div>)}</div>
        : jobs.length === 0 ? <Empty title="No jobs found" desc="Adjust filters or check back later" /> : (
          <div className="space-y-3">
            {jobs.map(j => (
              <Card key={j.id} className="p-5 card-hover">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge color="yellow">{j.type}</Badge><Badge color="blue">{j.domain}</Badge>
                    </div>
                    <h3 className="text-xl font-black mb-1">{j.title}</h3>
                    <p className="text-sm opacity-70">{j.company} · {j.location}</p>
                    <p className="text-sm mt-2 line-clamp-2 opacity-80">{j.description}</p>
                    {(j.salary_min || j.salary_max) && (
                      <p className="text-sm font-bold mt-2 text-green-600">
                        ₹{(j.salary_min/100000).toFixed(1)}L - ₹{(j.salary_max/100000).toFixed(1)}L /year
                      </p>
                    )}
                  </div>
                  <Button variant="primary" onClick={() => user ? setApplyJob(j) : toast('Please sign in to apply', 'warning')}>Apply</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <NewJobModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
      <ApplyJobModal job={applyJob} onClose={() => setApplyJob(null)} />
    </div>
  );
};

const NewJobModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ type: 'full-time', domain: 'technology' });
  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/jobs', { method: 'POST', body: { ...form, salary_min: parseInt(form.salary_min) || null, salary_max: parseInt(form.salary_max) || null } });
      toast('Job posted!', 'success'); onCreated(); onClose(); setForm({ type: 'full-time', domain: 'technology' });
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Post a Job">
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Title *</Label><Input required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Company</Label><Input value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="freelance">Freelance</option><option value="contract">Contract</option>
            </Select>
          </div>
          <div>
            <Label>Domain</Label>
            <Select value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>
              {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
          </div>
        </div>
        <div><Label>Description</Label><Textarea rows="4" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Salary Min (₹)</Label><Input type="number" value={form.salary_min || ''} onChange={e => setForm({ ...form, salary_min: e.target.value })} /></div>
          <div><Label>Salary Max (₹)</Label><Input type="number" value={form.salary_max || ''} onChange={e => setForm({ ...form, salary_max: e.target.value })} /></div>
        </div>
        <Button type="submit" variant="gradient" className="w-full">Post Job</Button>
      </form>
    </Modal>
  );
};

const ApplyJobModal = ({ job, onClose }) => {
  const [letter, setLetter] = useState('');
  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/jobs/${job.id}/apply`, { method: 'POST', body: { cover_letter: letter } });
      toast('Application submitted!', 'success'); onClose(); setLetter('');
    } catch (e) { toast(e.message, 'error'); }
  };
  if (!job) return null;
  return (
    <Modal open={true} onClose={onClose} title={`Apply: ${job.title}`}>
      <form onSubmit={submit} className="space-y-3">
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <p className="font-bold">{job.company}</p>
          <p className="text-sm opacity-70">{job.location} · {job.type}</p>
        </div>
        <div><Label>Cover Letter</Label><Textarea rows="6" value={letter} onChange={e => setLetter(e.target.value)} placeholder="Why are you a great fit?" /></div>
        <Button type="submit" variant="gradient" className="w-full">Submit Application</Button>
      </form>
    </Modal>
  );
};

const SearchPage = () => {
  const { params, navigate } = useRouter();
  const [q, setQ] = useState(params.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const search = useCallback((query) => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setLoading(true);
    api(`/api/search?q=${encodeURIComponent(query)}`).then(d => { setResults(d.results || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { if (q) search(q); }, []);
  const submit = (e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); search(q); };
  const grouped = useMemo(() => results.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {}), [results]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-black">Search Everything</h1>
        <p className="opacity-70">Find content, jobs, and organizations</p>
      </div>
      <form onSubmit={submit}>
        <div className="relative">
          <I.search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-60" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type to search..."
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 text-lg font-medium" />
        </div>
      </form>
      {loading && <div className="text-center py-8"><Spinner /></div>}
      {!loading && q && results.length === 0 && <Empty title={`No results for "${q}"`} desc="Try different keywords" />}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h2 className="text-xl font-black mb-3 capitalize">{type === 'content' ? 'Articles' : type === 'job' ? 'Jobs' : 'Organizations'} ({items.length})</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {items.map((r, idx) => (
              <Card key={`${r.type}-${r.id}-${idx}`} className="p-4 card-hover cursor-pointer" onClick={() => {
                if (r.type === 'job') navigate('/jobs');
                else if (r.type === 'entity') navigate('/entities');
                else navigate('/content');
              }}>
                <Badge color="blue">{r.domain}</Badge>
                <h3 className="font-black text-lg mt-2">{r.title}</h3>
                {r.subtitle && <p className="text-sm opacity-70">{r.subtitle}</p>}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const PaymentPage = () => {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [processing, setProcessing] = useState(false);

  const subscribe = async (plan) => {
    setProcessing(true);
    try {
      const init = await api('/api/payments/initiate', { method: 'POST', body: { plan } });
      // Simulate payment processing
      await new Promise(r => setTimeout(r, 1500));
      await api('/api/payments/confirm', { method: 'POST', body: { payment_id: init.payment_id } });
      toast('Welcome to Premium! 🎉', 'success');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
    setProcessing(false);
  };

  const plans = [
    { name: 'Free', price: 0, features: ['Browse all content', 'Basic dashboard', '5 projects', 'Community access'], color: 'blue', current: user?.subscription_type === 'free' },
    { name: 'Premium', price: 200, features: ['Everything in Free', 'Unlimited projects', 'Priority support', 'Advanced analytics', '100 bonus points'], color: 'yellow', popular: true, current: user?.subscription_type === 'premium' },
    { name: 'Business', price: 500, features: ['Everything in Premium', 'Team collaboration', 'API access', 'Custom branding', 'Dedicated manager'], color: 'purple' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-black">Choose Your Plan</h1>
        <p className="opacity-70 mt-2">Unlock the full power of GuideSoft</p>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {plans.map(p => (
          <Card key={p.name} className={`p-6 relative ${p.popular ? 'ring-4 ring-yellow-400 scale-105' : ''}`}>
            {p.popular && <Badge color="yellow" className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>}
            <h3 className="text-2xl font-black">{p.name}</h3>
            <div className="my-4">
              <span className="text-5xl font-black">₹{p.price}</span>
              {p.price > 0 && <span className="opacity-60">/mo</span>}
            </div>
            <ul className="space-y-2 mb-6">
              {p.features.map(f => <li key={f} className="flex items-center gap-2 text-sm"><I.check className={`w-4 h-4 ${colorMap[p.color].text}`} /> {f}</li>)}
            </ul>
            {p.current ? (
              <Button variant="secondary" className="w-full" disabled>Current Plan</Button>
            ) : p.price === 0 ? (
              <Button variant="secondary" className="w-full" disabled>Free Forever</Button>
            ) : (
              <Button variant="gradient" className="w-full" onClick={() => user ? subscribe(p.name.toLowerCase()) : toast('Please sign in first', 'warning')} disabled={processing}>
                {processing ? <Spinner /> : `Upgrade to ${p.name}`}
              </Button>
            )}
          </Card>
        ))}
      </div>
      <Card className="p-6 max-w-3xl mx-auto">
        <h2 className="text-xl font-black mb-3">Frequently Asked</h2>
        <div className="space-y-3 text-sm">
          <div><strong>Can I cancel anytime?</strong> Yes, cancel from your account dashboard at any time.</div>
          <div><strong>Is payment secure?</strong> All transactions use industry-standard encryption.</div>
          <div><strong>Do you offer refunds?</strong> Yes, 7-day money-back guarantee.</div>
        </div>
      </Card>
    </div>
  );
};

const EntitiesPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ domain: '', search: '' });
  const [showNew, setShowNew] = useState(false);
  const { user } = useAuth();
  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter.domain) qs.append('domain', filter.domain);
    if (filter.search) qs.append('search', filter.search);
    api(`/api/entities?${qs}`).then(d => { setItems(d.entities || []); setLoading(false); }).catch(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black">Organizations</h1>
          <p className="opacity-70">Companies, institutions, and entities</p>
        </div>
        {user && <Button variant="gradient" onClick={() => setShowNew(true)}><I.plus className="w-4 h-4 inline mr-1" /> Add Organization</Button>}
      </div>
      <Card className="p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Domain</Label>
            <Select value={filter.domain} onChange={e => setFilter({ ...filter, domain: e.target.value })}>
              <option value="">All</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
          </div>
          <div><Label>Search</Label><Input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Name..." /></div>
        </div>
      </Card>
      {loading ? <div className="grid md:grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-40 skeleton rounded-xl"></div>)}</div>
        : items.length === 0 ? <Empty title="No organizations" /> : (
          <div className="grid md:grid-cols-2 gap-3">
            {items.map(e => (
              <Card key={e.id} className="p-5 card-hover">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-black text-xl">
                    {e.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-lg">{e.name}</h3>
                    <div className="flex gap-1 my-1"><Badge color="blue">{e.domain}</Badge><Badge color="purple">{e.type}</Badge></div>
                    <p className="text-sm opacity-70 line-clamp-2">{e.description}</p>
                    {e.website && <a href={e.website} target="_blank" rel="noopener" className="text-xs text-blue-500 font-bold mt-2 inline-block">{e.website}</a>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      <NewEntityModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
    </div>
  );
};

const NewEntityModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ type: 'organization', domain: 'technology' });
  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/entities', { method: 'POST', body: form });
      toast('Organization added!', 'success'); onCreated(); onClose(); setForm({ type: 'organization', domain: 'technology' });
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Organization">
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name *</Label><Input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="organization">Organization</option><option value="company">Company</option><option value="nonprofit">Non-profit</option><option value="institution">Institution</option>
            </Select>
          </div>
          <div>
            <Label>Domain</Label>
            <Select value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>
              {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </Select>
          </div>
        </div>
        <div><Label>Description</Label><Textarea rows="3" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Website</Label><Input value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Email</Label><Input type="email" value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
        </div>
        <Button type="submit" variant="gradient" className="w-full">Add Organization</Button>
      </form>
    </Modal>
  );
};

const ActivityPage = () => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api(`/api/activity?page=${page}`).then(d => { setItems(d.activity || []); setTotal(d.total); setLoading(false); }).catch(() => setLoading(false));
  }, [page]);

  const iconForAction = (action) => {
    if (action.includes('created')) return 'plus';
    if (action.includes('updated')) return 'edit';
    if (action.includes('deleted')) return 'trash';
    if (action.includes('payment')) return 'crown';
    if (action.includes('applied')) return 'case';
    return 'zap';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-black">User Activity</h1>
        <p className="opacity-70">Your complete action history</p>
      </div>
      {loading ? <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-16 skeleton rounded-lg"></div>)}</div>
        : items.length === 0 ? <Empty title="No activity yet" desc="Start using the platform to see your history!" /> : (
          <Card className="divide-y-2 divide-zinc-200 dark:divide-zinc-800">
            {items.map((a, idx) => {
              const Icon = I[iconForAction(a.action)];
              const meta = JSON.parse(a.metadata || '{}');
              return (
                <div key={a.id} className="p-4 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50" style={{ animation: `slideIn 0.3s ${0.03 * idx}s forwards`, opacity: 0 }}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold capitalize">{a.action.replace(/_/g, ' ')}</p>
                    {a.resource_type && <p className="text-xs opacity-70">on {a.resource_type} {meta.title && `· "${meta.title}"`}</p>}
                  </div>
                  <p className="text-xs opacity-60 whitespace-nowrap">{timeAgo(a.created_at)}</p>
                </div>
              );
            })}
          </Card>
        )}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="px-4 py-2 font-bold">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>Next</Button>
        </div>
      )}
    </div>
  );
};

const NotFoundPage = () => (
  <div className="text-center py-20">
    <h1 className="text-9xl font-black opacity-20">404</h1>
    <h2 className="text-2xl font-black mb-2">Page not found</h2>
    <p className="opacity-70 mb-6">The page you're looking for doesn't exist</p>
    <Link to="/"><Button variant="gradient">Go Home</Button></Link>
  </div>
);

// ─── Main App ───────────────────────────────────────────────────────────────

const Routes = () => {
  const { path } = useRouter();
  const p = path.split('?')[0];
  switch (p) {
    case '/': return <HomePage />;
    case '/dashboard': return <RequireAuth><DashboardPage /></RequireAuth>;
    case '/technology': return <TechnologyPage />;
    case '/jobs': return <JobsPage />;
    case '/search': return <SearchPage />;
    case '/payment': return <RequireAuth><PaymentPage /></RequireAuth>;
    case '/entities': return <EntitiesPage />;
    case '/content': return <ContentPage />;
    case '/activity': return <RequireAuth><ActivityPage /></RequireAuth>;
    default: return <NotFoundPage />;
  }
};

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { path } = useRouter();
  useEffect(() => { window.scrollTo(0, 0); setSidebarOpen(false); }, [path]);
  return (
    <div className="flex">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 lg:ml-0">
        <TopBar onMenu={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Routes />
        </main>
        <footer className="p-6 text-center text-xs opacity-60 border-t-2 border-zinc-200 dark:border-zinc-800 mt-12">
          GuideSoft · Nine Worlds Hub · Built 2026
        </footer>
      </div>
    </div>
  );
};

const Root = () => (
  <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <RouterProvider>
          <App />
        </RouterProvider>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
