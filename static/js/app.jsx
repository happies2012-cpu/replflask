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
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(s);
};

// Custom hook: reveal on scroll
const useInView = (threshold = 0.12) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
};

// Reveal wrapper component
const Reveal = ({ children, delay = 0, className = '' }) => {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'in-view' : ''} ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
};

// ─── Toast System ───────────────────────────────────────────────────────────

const ToastCtx = createContext(null);
const useToast = () => useContext(ToastCtx);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const colors = {
    success: 'bg-emerald-500/90 text-white',
    error:   'bg-red-500/90 text-white',
    info:    'bg-indigo-500/90 text-white',
    warning: 'bg-amber-500/90 text-white',
  };
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${colors[t.type] || colors.info}`}>
            <span className="mr-2 font-black">{icons[t.type]}</span>{t.message}
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
  const [theme, setTheme] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('theme');
    if (override === 'dark' || override === 'light') return override;
    return localStorage.getItem('gs_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gs_theme', theme);
    if (window.__INITIAL_USER__) api('/api/auth/update-theme', { method: 'POST', body: { theme } }).catch(() => {});
  }, [theme]);
  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeCtx.Provider>
  );
};

// ─── Router ─────────────────────────────────────────────────────────────────

const RouterCtx = createContext(null);
const useRouter = () => useContext(RouterCtx);
const parseHash = () => {
  const h = window.location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { path, params: new URLSearchParams(qs || '') };
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

// ─── Auth Context ────────────────────────────────────────────────────────────

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(window.__INITIAL_USER__);
  const refresh = useCallback(async () => {
    try { const data = await api('/api/auth/me'); setUser(data.user); }
    catch { setUser(null); }
  }, []);
  const login = useCallback(() => {
    if (window.LoginWithReplit) {
      window.LoginWithReplit().then(() => window.location.reload());
    } else {
      const s = document.createElement('script');
      s.src = 'https://replit.com/public/js/repl-auth-v2.js';
      s.onload = () => window.LoginWithReplit().then(() => window.location.reload());
      document.body.appendChild(s);
    }
  }, []);
  const logout = useCallback(() => { window.location.href = '/__replauth_logout'; }, []);
  return <AuthCtx.Provider value={{ user, setUser, refresh, login, logout }}>{children}</AuthCtx.Provider>;
};

// ─── Icons (lucide-style inline SVG) ────────────────────────────────────────

const I = {
  menu:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x:       p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search:  p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  user:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  brain:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04Z"/></svg>,
  grad:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  heart:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  dollar:  p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  cart:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  pin:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  case:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  film:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>,
  users:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  crown:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>,
  zap:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  sun:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  bell:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  plus:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  check:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>,
  arrow:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  eye:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  thumb:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
  spark:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/></svg>,
  cpu:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/></svg>,
  shield:  p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  activity:p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  globe:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
};

// ─── Domain & Color Maps ─────────────────────────────────────────────────────

const DOMAINS = [
  { name: 'Technology & AI', slug: 'technology', path: '/technology', icon: 'brain',  color: 'blue',   desc: 'Neural networks, programming, compute' },
  { name: 'Education',       slug: 'education',  path: '/content?domain=education',  icon: 'grad',   color: 'purple', desc: 'Knowledge synthesis & upskilling' },
  { name: 'Health & Wellness', slug: 'health',   path: '/content?domain=health',     icon: 'heart',  color: 'red',    desc: 'Biometric optimization & wellness' },
  { name: 'Finance',         slug: 'finance',    path: '/content?domain=finance',    icon: 'dollar', color: 'green',  desc: 'Asset matrices & capital routing' },
  { name: 'E-Commerce',      slug: 'ecommerce',  path: '/content?domain=ecommerce',  icon: 'cart',   color: 'orange', desc: 'Digital commerce & trade nodes' },
  { name: 'Travel',          slug: 'travel',     path: '/content?domain=travel',     icon: 'globe',  color: 'teal',   desc: 'Geo-nav & destination mapping' },
  { name: 'Business',        slug: 'business',   path: '/content?domain=business',   icon: 'case',   color: 'indigo', desc: 'Strategy systems & org protocol' },
  { name: 'Entertainment',   slug: 'entertainment',path:'/content?domain=entertainment',icon:'film', color: 'pink',   desc: 'Media streams & content matrix' },
  { name: 'Jobs & Freelancing',slug:'jobs',       path: '/jobs',                      icon: 'users',  color: 'yellow', desc: 'Talent nodes & mission matching' },
];

const colorMap = {
  blue:   { bg:'bg-blue-500',   text:'text-blue-500',   border:'border-blue-500',   soft:'bg-blue-100/60 dark:bg-blue-950/40',   shadow:'shadow-blue-500/30'   },
  purple: { bg:'bg-purple-500', text:'text-purple-500', border:'border-purple-500', soft:'bg-purple-100/60 dark:bg-purple-950/40',shadow:'shadow-purple-500/30' },
  red:    { bg:'bg-red-500',    text:'text-red-500',    border:'border-red-500',    soft:'bg-red-100/60 dark:bg-red-950/40',     shadow:'shadow-red-500/30'    },
  green:  { bg:'bg-emerald-500',text:'text-emerald-500',border:'border-emerald-500',soft:'bg-emerald-100/60 dark:bg-emerald-950/40',shadow:'shadow-emerald-500/30'},
  orange: { bg:'bg-orange-500', text:'text-orange-500', border:'border-orange-500', soft:'bg-orange-100/60 dark:bg-orange-950/40',shadow:'shadow-orange-500/30' },
  teal:   { bg:'bg-teal-500',   text:'text-teal-500',   border:'border-teal-500',   soft:'bg-teal-100/60 dark:bg-teal-950/40',   shadow:'shadow-teal-500/30'   },
  indigo: { bg:'bg-indigo-500', text:'text-indigo-500', border:'border-indigo-500', soft:'bg-indigo-100/60 dark:bg-indigo-950/40',shadow:'shadow-indigo-500/30' },
  pink:   { bg:'bg-pink-500',   text:'text-pink-500',   border:'border-pink-500',   soft:'bg-pink-100/60 dark:bg-pink-950/40',   shadow:'shadow-pink-500/30'   },
  yellow: { bg:'bg-yellow-500', text:'text-yellow-600', border:'border-yellow-500', soft:'bg-yellow-100/60 dark:bg-yellow-950/40',shadow:'shadow-yellow-500/30' },
};

// ─── AnimatedBackground ──────────────────────────────────────────────────────

const AnimatedBackground = () => (
  <div className="animated-bg" aria-hidden="true">
    <div className="orb orb-1" />
    <div className="orb orb-2" />
    <div className="orb orb-3" />
    <div className="orb orb-4" />
    <div className="orb orb-5" />
  </div>
);

// ─── GlassCard ───────────────────────────────────────────────────────────────

const GlassCard = ({ children, className = '', hover = false, strong = false, glow = false, ...p }) => (
  <div
    className={`
      ${strong ? 'glass-strong' : 'glass'}
      ${hover ? 'card-hover glass-border cursor-pointer' : ''}
      ${glow ? 'animate-glow-pulse' : ''}
      rounded-2xl ${className}
    `}
    {...p}
  >
    {children}
  </div>
);

// ─── GlassButton ─────────────────────────────────────────────────────────────

const GlassButton = ({ children, variant = 'primary', size = 'md', className = '', icon, ...p }) => {
  const sizes = { xs: 'px-2.5 py-1 text-[11px]', sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base', xl: 'px-8 py-4 text-lg' };
  const variants = {
    primary:  'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/35 hover:shadow-xl hover:shadow-indigo-500/50',
    secondary:'glass-soft hover:bg-white/60 dark:hover:bg-white/10 text-zinc-900 dark:text-zinc-100 border border-white/50 dark:border-white/10',
    danger:   'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white shadow-lg shadow-red-500/35',
    success:  'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/35',
    ghost:    'hover:bg-white/60 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300',
    gradient: 'bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white shadow-lg shadow-fuchsia-500/35 hover:shadow-xl hover:shadow-fuchsia-500/55',
    outline:  'border-2 border-zinc-900/70 dark:border-white/40 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 text-zinc-900 dark:text-white',
    glass:    'glass border border-white/50 dark:border-white/15 hover:bg-white/70 dark:hover:bg-white/10 text-zinc-900 dark:text-zinc-100',
    amber:    'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white shadow-lg shadow-amber-500/35',
  };
  return (
    <button
      className={`
        ${sizes[size]} ${variants[variant]}
        rounded-xl font-bold uppercase tracking-wide
        transition-all duration-200 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center gap-2 justify-center
        ${className}
      `}
      {...p}
    >
      {icon && React.createElement(I[icon] || (() => null), { className: 'w-4 h-4 flex-shrink-0' })}
      {children}
    </button>
  );
};

// Alias for internal use
const Button = GlassButton;
const Card = GlassCard;

// ─── ThemeToggle ─────────────────────────────────────────────────────────────

const ThemeToggle = () => {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
      className={`
        relative p-2.5 rounded-xl transition-all duration-300 group
        hover:bg-white/60 dark:hover:bg-white/10
        ${theme === 'dark' ? 'text-amber-400' : 'text-indigo-500'}
      `}
    >
      <div className="transition-all duration-500 group-hover:rotate-12">
        {theme === 'dark'
          ? <I.sun className="w-5 h-5" />
          : <I.moon className="w-5 h-5" />}
      </div>
    </button>
  );
};

// ─── Form Components ─────────────────────────────────────────────────────────

const Input    = ({ className = '', ...p })            => <input    className={`text-sm font-medium ${className}`} {...p} />;
const Textarea = ({ className = '', rows = 3, ...p }) => <textarea  className={`text-sm ${className}`} rows={rows} {...p} />;
const Select   = ({ className = '', children, ...p }) => <select    className={`text-sm font-medium ${className}`} {...p}>{children}</select>;
const Label    = ({ children }) => (
  <label className="block text-[10px] font-black uppercase tracking-[0.15em] mb-1.5 text-zinc-500 dark:text-zinc-400">
    {children}
  </label>
);

// ─── Modal ───────────────────────────────────────────────────────────────────

const Modal = ({ open, onClose, title, children }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) { window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; }
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'fadeInScale 0.2s ease both' }}
    >
      <div
        className="glass-strong rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeInScale 0.3s cubic-bezier(.4,0,.2,1) both' }}
      >
        <div className="p-5 border-b border-white/30 dark:border-white/08 flex items-center justify-between sticky top-0 glass-strong z-10 rounded-t-2xl">
          <h2 className="text-base font-black tracking-tight uppercase">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-900/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <I.x className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// ─── Misc UI Components ──────────────────────────────────────────────────────

const Badge = ({ children, color = 'blue' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${colorMap[color]?.soft || 'bg-zinc-200 dark:bg-zinc-800'} ${colorMap[color]?.text || ''}`}>
    {children}
  </span>
);

const Spinner = ({ size = 5 }) => (
  <div className={`inline-block w-${size} h-${size} border-2 border-current border-t-transparent rounded-full animate-spin-slow`} />
);

const Empty = ({ icon = 'spark', title, desc, action }) => (
  <div className="text-center py-20 px-6">
    <div className="inline-flex w-20 h-20 rounded-full glass items-center justify-center mb-5 animate-float">
      {React.createElement(I[icon] || I.spark, { className: 'w-9 h-9 opacity-50' })}
    </div>
    <h3 className="text-xl font-black mb-2 tracking-tight">{title}</h3>
    {desc && <p className="text-sm opacity-60 mb-5 max-w-sm mx-auto leading-relaxed">{desc}</p>}
    {action}
  </div>
);

const StatusPill = ({ online = true }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass text-[10px] font-black uppercase tracking-widest">
    <span className={`status-dot ${online ? 'status-online' : 'status-off'}`} />
    {online ? 'Online' : 'Offline'}
  </span>
);

const SectionHeader = ({ eyebrow, title, subtitle }) => (
  <div className="mb-8">
    {eyebrow && (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-soft text-[10px] font-black uppercase tracking-[0.15em] mb-3 text-indigo-600 dark:text-indigo-400">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
        {eyebrow}
      </div>
    )}
    <h2 className="text-3xl md:text-4xl font-black tracking-tight">{title}</h2>
    {subtitle && <p className="text-sm opacity-60 mt-1.5 font-medium">{subtitle}</p>}
  </div>
);

const RequireAuth = ({ children }) => {
  const { user, login } = useAuth();
  if (!user) return (
    <div className="max-w-md mx-auto py-24 text-center">
      <div className="w-20 h-20 rounded-full glass flex items-center justify-center mx-auto mb-6 animate-float">
        <I.shield className="w-9 h-9 opacity-50" />
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-soft text-[10px] font-black uppercase tracking-widest mb-4 text-red-500">
        <span className="status-dot status-off" /> Access Restricted
      </div>
      <h2 className="text-2xl font-black mb-2 tracking-tight">Neural Auth Required</h2>
      <p className="opacity-60 mb-8 text-sm">Authentication sequence must be completed to access this module.</p>
      <GlassButton variant="gradient" size="lg" icon="user" onClick={login}>Initialize Auth Sequence</GlassButton>
    </div>
  );
  return children;
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const Sidebar = ({ open, setOpen }) => {
  const { path } = useRouter();
  const { user, login, logout } = useAuth();

  const navItems = [
    { label: 'Home Base',  to: '/',          icon: 'cpu',    color: 'blue'   },
    ...(user ? [{ label: 'Command Center', to: '/dashboard', icon: 'activity', color: 'purple' }] : []),
    { label: 'Data Scan',  to: '/search',    icon: 'search', color: 'teal'   },
    { label: 'Stream Hub', to: '/content',   icon: 'film',   color: 'pink'   },
    ...(user ? [
      { label: 'System Log',  to: '/activity', icon: 'zap',   color: 'green'  },
      { label: 'Access Tier', to: '/payment',  icon: 'crown', color: 'yellow' },
    ] : []),
  ];
  const isActive = (to) => path === to.split('?')[0];

  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-72 z-40
          transform transition-all duration-300 ease-in-out
          glass border-r border-white/35 dark:border-white/08
          flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/35 dark:border-white/08">
          <Link to="/" className="flex items-center gap-3 group" onClick={() => setOpen(false)}>
            <div className="
              w-11 h-11 rounded-xl
              bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500
              flex items-center justify-center text-white font-black text-xl
              shadow-lg shadow-fuchsia-500/45
              group-hover:scale-110 group-hover:rotate-6 transition-all duration-300
              animate-glow-pulse
            ">
              G
            </div>
            <div>
              <p className="font-black text-lg tracking-tight leading-none">GuideSoft</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-55 mt-0.5">Nine Worlds · v2026</p>
            </div>
          </Link>
        </div>

        {/* Status bar */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg glass-soft">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">System Status</span>
            <StatusPill online={true} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
          {navItems.map((n) => {
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  font-bold text-xs uppercase tracking-widest
                  transition-all duration-200
                  ${active
                    ? `${colorMap[n.color].bg} text-white shadow-lg ${colorMap[n.color].shadow}`
                    : 'hover:bg-white/60 dark:hover:bg-white/05 hover:translate-x-1.5'
                  }
                `}
              >
                {React.createElement(I[n.icon] || I.menu, { className: 'w-4 h-4 flex-shrink-0' })}
                {n.label}
                {active && <span className="ml-auto text-[8px] font-black tracking-widest opacity-70">ACTIVE</span>}
              </Link>
            );
          })}

          {/* Domains */}
          <div className="pt-3 mt-2 border-t border-white/35 dark:border-white/08">
            <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
              ◈ Node Matrix
            </p>
            {DOMAINS.map((d) => (
              <Link
                key={d.slug}
                to={d.path}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-white/60 dark:hover:bg-white/05 hover:translate-x-1.5 transition-all duration-200"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${colorMap[d.color].bg} flex-shrink-0`} />
                <span className="truncate">{d.name}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/35 dark:border-white/08">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl glass-soft">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-sm shadow-md flex-shrink-0">
                  {(user.full_name || user.username || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate">{user.full_name || user.username}</p>
                  <p className="text-[10px] opacity-60 flex items-center gap-1">
                    {user.subscription_type === 'premium'
                      ? <><I.crown className="w-2.5 h-2.5 text-amber-500" /> Premium Node</>
                      : 'Free Access'}
                    <span className="ml-auto text-indigo-500 font-black">{user.points || 0}pt</span>
                  </p>
                </div>
              </div>
              <GlassButton
                variant="danger"
                size="sm"
                className="w-full"
                onClick={logout}
              >
                Terminate Session
              </GlassButton>
            </div>
          ) : (
            <GlassButton
              variant="gradient"
              size="md"
              className="w-full"
              icon="user"
              onClick={login}
            >
              Initialize Auth
            </GlassButton>
          )}
        </div>
      </aside>
    </>
  );
};

// ─── TopBar ──────────────────────────────────────────────────────────────────

const TopBar = ({ onMenu }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [q, setQ] = useState('');
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (user) api('/api/notifications').then(d => setNotifs(d.notifications || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const unread = notifs.filter(n => !n.is_read).length;
  const submit = e => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q)}`); };

  return (
    <header className="sticky top-0 z-20 glass border-b border-white/35 dark:border-white/08 px-4 py-2.5 flex items-center gap-3">
      <button
        onClick={onMenu}
        className="lg:hidden p-2 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
        aria-label="Open navigation"
      >
        <I.menu className="w-5 h-5" />
      </button>

      {/* Live clock */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-soft text-[10px] font-black tracking-widest uppercase opacity-70">
        <span className="status-dot status-online" />
        {time.toLocaleTimeString('en-US', { hour12: false })}
      </div>

      {/* Search */}
      <form onSubmit={submit} className="flex-1 max-w-xl">
        <div className="relative">
          <I.search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Query the data matrix..."
            className="!pl-10 !pr-4 !py-2 !rounded-xl !text-sm"
            aria-label="Search"
          />
        </div>
      </form>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Notifications */}
      {user && (
        <div className="relative">
          <button
            onClick={() => setShowNotifs(s => !s)}
            className="p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors relative"
            aria-label={`${unread} notifications`}
          >
            <I.bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-gradient-to-br from-red-500 to-pink-500 rounded-full ring-2 ring-white dark:ring-black animate-pulse" />
            )}
          </button>
          {showNotifs && (
            <div
              className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto glass-strong rounded-2xl shadow-2xl"
              style={{ animation: 'fadeInScale 0.2s ease both' }}
            >
              <div className="p-3.5 border-b border-white/35 dark:border-white/08 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                <I.bell className="w-3.5 h-3.5" /> Signal Feed
              </div>
              {notifs.length === 0 ? (
                <p className="p-8 text-center text-sm opacity-50">No incoming signals</p>
              ) : notifs.map(n => (
                <div key={n.id} className={`p-3 border-b border-white/20 dark:border-white/05 ${!n.is_read ? 'bg-indigo-500/10' : ''}`}>
                  <p className="font-bold text-xs">{n.title}</p>
                  <p className="text-xs opacity-60 mt-0.5">{n.message}</p>
                  <p className="text-[10px] opacity-40 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

// ─── Pages ──────────────────────────────────────────────────────────────────

// ── Home Page ────────────────────────────────────────────────────────────────

const HomePage = () => {
  const { user, login } = useAuth();
  const [stats, setStats] = useState({ content: 0, jobs: 0, entities: 0 });

  useEffect(() => {
    Promise.all([
      api('/api/content').catch(() => ({ content: [] })),
      api('/api/jobs').catch(() => ({ jobs: [] })),
      api('/api/entities').catch(() => ({ entities: [] })),
    ]).then(([c, j, e]) => setStats({
      content: c.content?.length || 0,
      jobs: j.jobs?.length || 0,
      entities: e.entities?.length || 0,
    }));
  }, []);

  return (
    <div className="space-y-14">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl gradient-mesh glass-strong p-8 md:p-14 lg:p-20 min-h-[60vh] flex flex-col justify-center">
        <div aria-hidden className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-fuchsia-400/45 blur-3xl animate-blob" />
        <div aria-hidden className="absolute -bottom-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-indigo-400/40 blur-3xl animate-blob" style={{ animationDelay: '5s' }} />
        <div aria-hidden className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full bg-cyan-400/30 blur-3xl animate-blob" style={{ animationDelay: '10s' }} />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-strong text-[10px] font-black uppercase tracking-[0.2em] mb-8 animate-fadeInUp chip-glow">
            <I.cpu className="w-3 h-3 text-indigo-500" />
            System Initialized · Build 2026.1
            <span className="animate-blink text-indigo-500 ml-1">|</span>
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.92] mb-7 animate-fadeInUp"
            style={{ animationDelay: '0.1s' }}
          >
            One hub.<br />
            <span className="text-gradient">Nine worlds.</span><br />
            Endless <span className="text-gradient-amber">possibilities.</span>
          </h1>

          <p
            className="text-base md:text-xl opacity-75 mb-9 max-w-2xl leading-relaxed animate-fadeInUp font-medium"
            style={{ animationDelay: '0.2s' }}
          >
            GuideSoft interconnects nine domain matrices — technology, education, finance, jobs and more — into a unified intelligence platform for the modern operator.
          </p>

          <div className="flex flex-wrap gap-3 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            {user ? (
              <>
                <Link to="/dashboard">
                  <GlassButton size="lg" variant="gradient" icon="cpu">Access Command Center</GlassButton>
                </Link>
                <Link to="/content">
                  <GlassButton size="lg" variant="glass">Stream Data Feed</GlassButton>
                </Link>
              </>
            ) : (
              <>
                <GlassButton size="lg" variant="gradient" icon="user" onClick={login}>Initialize Free Access</GlassButton>
                <Link to="/search">
                  <GlassButton size="lg" variant="glass" icon="search">Scan Matrix</GlassButton>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <Reveal>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Data Streams',    val: stats.content,  icon: 'film',    color: 'pink',   prefix: '' },
            { label: 'Open Missions',   val: stats.jobs,     icon: 'case',    color: 'yellow', prefix: '' },
            { label: 'Network Nodes',   val: stats.entities, icon: 'globe',   color: 'teal',   prefix: '' },
          ].map((s, i) => (
            <GlassCard key={s.label} hover className="p-5 md:p-7" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={`w-10 h-10 rounded-xl ${colorMap[s.color].bg} text-white flex items-center justify-center mb-4 shadow-lg ${colorMap[s.color].shadow}`}>
                {React.createElement(I[s.icon], { className: 'w-5 h-5' })}
              </div>
              <div className="text-3xl md:text-4xl font-black text-gradient-amber">{s.val}+</div>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-55 mt-1">{s.label}</div>
            </GlassCard>
          ))}
        </div>
      </Reveal>

      {/* Domains */}
      <section>
        <Reveal>
          <SectionHeader
            eyebrow="Domain Matrix"
            title="Explore the Nine Worlds"
            subtitle="Select a node to enter the corresponding data sphere"
          />
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {DOMAINS.map((d) => (
            <Reveal key={d.slug}>
              <Link to={d.path}>
                <GlassCard hover className={`p-6 h-full ${colorMap[d.color].soft} border border-transparent`}>
                  <div className={`w-12 h-12 rounded-xl ${colorMap[d.color].bg} text-white flex items-center justify-center mb-5 shadow-lg ${colorMap[d.color].shadow}`}>
                    {React.createElement(I[d.icon], { className: 'w-6 h-6' })}
                  </div>
                  <h3 className="text-base font-black mb-1.5 tracking-tight">{d.name}</h3>
                  <p className="text-xs opacity-60 leading-relaxed mb-4">{d.desc}</p>
                  <div className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${colorMap[d.color].text}`}>
                    Enter Node <I.arrow className="w-3 h-3" />
                  </div>
                </GlassCard>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <Reveal>
        <section>
          <SectionHeader
            eyebrow="Platform Capabilities"
            title="System Architecture"
            subtitle="Core modules powering the Nine Worlds ecosystem"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
            {[
              { icon: 'shield',   title: 'Secure Auth',       desc: 'Neural authentication with encrypted session tokens and role-based access.',   color: 'indigo' },
              { icon: 'activity', title: 'Real-Time Feed',    desc: 'Live data ingestion and stream processing across all nine domains.',           color: 'green'  },
              { icon: 'cpu',      title: 'Smart Search',      desc: 'Cross-domain query engine with semantic matching and instant results.',        color: 'blue'   },
              { icon: 'crown',    title: 'Access Tiers',      desc: 'Tiered subscription nodes with progressive feature unlocks.',                  color: 'yellow' },
            ].map(f => (
              <Reveal key={f.title}>
                <GlassCard hover className="p-5">
                  <div className={`w-10 h-10 rounded-xl ${colorMap[f.color].bg} text-white flex items-center justify-center mb-4 shadow-md ${colorMap[f.color].shadow}`}>
                    {React.createElement(I[f.icon], { className: 'w-5 h-5' })}
                  </div>
                  <h3 className="font-black text-sm mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-xs opacity-55 leading-relaxed">{f.desc}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      {/* CTA */}
      {!user && (
        <Reveal>
          <section className="relative overflow-hidden rounded-3xl glass-strong p-10 md:p-16 text-center border border-white/40 dark:border-white/10">
            <div aria-hidden className="absolute inset-0 gradient-mesh opacity-60 pointer-events-none rounded-3xl" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[10px] font-black uppercase tracking-widest mb-6 text-indigo-600 dark:text-indigo-400">
                <I.zap className="w-3 h-3" /> Free Access Available
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
                Join the <span className="text-gradient">Neural Network</span>
              </h2>
              <p className="text-base opacity-70 mb-8 max-w-2xl mx-auto font-medium">
                Authenticate your identity and access the full command interface — content creation, mission applications, analytics, and more.
              </p>
              <GlassButton size="xl" variant="gradient" icon="user" onClick={login}>
                Initialize Free Sequence
              </GlassButton>
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
};

// ── Dashboard Page ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showNew, setShowNew] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    Promise.all([
      api('/api/dashboard/stats'),
      api('/api/tasks'),
      api('/api/projects'),
    ]).then(([d, t, p]) => {
      setData(d); setTasks(t.tasks || []); setProjects(p.projects || []);
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const updateTaskStatus = async (id, status) => {
    try {
      await api(`/api/tasks/${id}`, { method: 'PUT', body: { status } });
      setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
      toast(`Mission moved to ${status.replace('_', ' ')}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  if (!data) return <DashboardSkeleton />;
  const s = data.stats;

  return (
    <div className="space-y-7">
      {/* Header */}
      <Reveal className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-soft text-[10px] font-black uppercase tracking-widest mb-3 text-indigo-500">
            <span className="status-dot status-online" /> Command Center Active
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Welcome, <span className="text-gradient">{user.full_name || user.username}</span>
          </h1>
          <p className="opacity-55 text-sm mt-1 font-medium">Neural link established · All systems nominal</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <GlassButton variant="glass" size="sm" icon="plus" onClick={() => setShowNew('project')}>New Project</GlassButton>
          <GlassButton variant="gradient" size="sm" icon="plus" onClick={() => setShowNew('task')}>New Task</GlassButton>
        </div>
      </Reveal>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger">
        {[
          { label: 'Projects',  val: s.projects,   color: 'blue',   icon: 'case'    },
          { label: 'Tasks',     val: s.tasks,      color: 'purple', icon: 'check'   },
          { label: 'Completed', val: s.tasks_done, color: 'green',  icon: 'check'   },
          { label: 'Content',   val: s.content,    color: 'pink',   icon: 'film'    },
          { label: 'XP Points', val: s.points,     color: 'yellow', icon: 'crown'   },
        ].map((x, i) => (
          <Reveal key={x.label} delay={i * 0.06}>
            <GlassCard className="p-4">
              <div className={`w-8 h-8 rounded-lg ${colorMap[x.color].bg} text-white flex items-center justify-center mb-3 shadow-sm ${colorMap[x.color].shadow}`}>
                {React.createElement(I[x.icon], { className: 'w-4 h-4' })}
              </div>
              <div className="text-2xl font-black">{x.val}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-50 mt-0.5">{x.label}</div>
            </GlassCard>
          </Reveal>
        ))}
      </div>

      {/* Kanban + Projects */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Kanban */}
        <Reveal className="lg:col-span-2">
          <h2 className="text-lg font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <I.activity className="w-4 h-4 text-indigo-500" /> Mission Board
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'todo',        label: 'Queue',      color: 'blue'   },
              { id: 'in_progress', label: 'Processing', color: 'yellow' },
              { id: 'done',        label: 'Complete',   color: 'green'  },
            ].map((col) => (
              <div key={col.id} className="glass rounded-2xl p-3 min-h-[280px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.15em] opacity-70">{col.label}</h3>
                  <Badge color={col.color}>{tasks.filter(t => t.status === col.id).length}</Badge>
                </div>
                <div className="space-y-2">
                  {tasks.filter(t => t.status === col.id).map(t => (
                    <div key={t.id} className="glass-strong p-3 rounded-xl cursor-pointer hover:scale-[1.02] transition-all duration-200">
                      <p className="font-bold text-xs mb-1 leading-snug">{t.title}</p>
                      {t.description && <p className="text-[10px] opacity-55 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <Badge color={t.priority === 'high' ? 'red' : t.priority === 'low' ? 'blue' : 'yellow'}>{t.priority}</Badge>
                        <div className="flex gap-1">
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => updateTaskStatus(t.id, col.id === 'done' ? 'in_progress' : 'todo')}
                              className="text-[9px] px-1.5 py-0.5 rounded glass-soft font-black hover:bg-white/70 dark:hover:bg-white/15 transition-colors"
                            >←</button>
                          )}
                          {col.id !== 'done' && (
                            <button
                              onClick={() => updateTaskStatus(t.id, col.id === 'todo' ? 'in_progress' : 'done')}
                              className="text-[9px] px-1.5 py-0.5 rounded glass-soft font-black hover:bg-white/70 dark:hover:bg-white/15 transition-colors"
                            >→</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.status === col.id).length === 0 && (
                    <p className="text-center text-[10px] uppercase tracking-widest opacity-35 py-10">— Empty Queue —</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Projects + Activity */}
        <Reveal className="space-y-5">
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <I.case className="w-4 h-4 text-purple-500" /> Active Projects
            </h2>
            <div className="space-y-2">
              {projects.length === 0
                ? <GlassCard className="p-4 text-xs opacity-60 text-center">No projects initialized</GlassCard>
                : projects.slice(0, 4).map(p => (
                  <GlassCard key={p.id} className="p-3.5">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-black text-xs truncate">{p.title}</p>
                        <p className="text-[10px] opacity-55 truncate">{p.description || 'No description'}</p>
                      </div>
                      <Badge color={p.status === 'active' ? 'green' : 'blue'}>{p.status}</Badge>
                    </div>
                    <div className="h-1.5 bg-zinc-200/60 dark:bg-zinc-800/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-700"
                        style={{ width: `${p.progress || 0}%` }}
                      />
                    </div>
                    <p className="text-[9px] opacity-40 mt-1.5 font-bold uppercase tracking-widest">{p.progress || 0}% Complete</p>
                  </GlassCard>
                ))
              }
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <I.zap className="w-4 h-4 text-green-500" /> System Log
            </h2>
            <GlassCard className="p-3 space-y-2 max-h-72 overflow-y-auto no-scrollbar">
              {data.recent_activity.length === 0
                ? <p className="text-xs opacity-55 text-center py-6">Log empty</p>
                : data.recent_activity.map(a => (
                  <div key={a.id} className="flex items-start gap-2.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold capitalize truncate">{a.action.replace(/_/g, ' ')}</p>
                      <p className="opacity-40 text-[10px]">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))
              }
            </GlassCard>
          </div>
        </Reveal>
      </div>

      <NewItemModal type={showNew} onClose={() => setShowNew(null)} onCreated={load} projects={projects} />
    </div>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="h-10 w-1/3 skeleton" />
    <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 skeleton" />)}</div>
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-72 skeleton" />)}</div>
      <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-28 skeleton" />)}</div>
    </div>
  </div>
);

const NewItemModal = ({ type, onClose, onCreated, projects }) => {
  const [form, setForm] = useState({});
  const toast = useToast();
  useEffect(() => { setForm({}); }, [type]);
  if (!type) return null;
  const submit = async e => {
    e.preventDefault();
    try {
      if (type === 'project') await api('/api/projects', { method: 'POST', body: form });
      else await api('/api/tasks', { method: 'POST', body: form });
      toast(`${type === 'project' ? 'Project' : 'Mission'} initialized.`, 'success');
      onCreated(); onClose();
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={true} onClose={onClose} title={`Initialize ${type === 'project' ? 'Project' : 'Mission'}`}>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Designation *</Label><Input required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Enter mission designation..." /></div>
        <div><Label>Description</Label><Textarea rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Mission parameters..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority Level</Label>
            <Select value={form.priority || 'medium'} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </Select>
          </div>
          {type === 'project' ? (
            <div>
              <Label>Domain Node</Label>
              <Select value={form.category || 'general'} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </Select>
            </div>
          ) : (
            <div>
              <Label>Link to Project</Label>
              <Select value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value || null })}>
                <option value="">Standalone</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>
          )}
        </div>
        <GlassButton type="submit" variant="gradient" className="w-full">Deploy {type === 'project' ? 'Project' : 'Mission'}</GlassButton>
      </form>
    </Modal>
  );
};

// ── Technology Page ───────────────────────────────────────────────────────────

const TechnologyPage = () => {
  const [content, setContent] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/api/content?domain=technology'),
      api('/api/tech/stats'),
    ]).then(([c, s]) => { setContent(c.content || []); setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-9">
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl gradient-mesh glass-strong p-8 md:p-12">
          <div aria-hidden className="absolute -top-16 -right-16 w-72 h-72 bg-blue-400/40 rounded-full blur-3xl animate-blob" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-xl shadow-blue-500/40 flex-shrink-0">
              <I.brain className="w-9 h-9" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">
                <span className="status-dot status-online" /> Neural Domain · Active
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Technology & AI</h1>
              <p className="opacity-60 mt-1 text-sm">Latest compute intelligence, programming matrices, and AI breakthroughs</p>
            </div>
            {stats && (
              <div className="grid grid-cols-3 gap-6 text-center">
                {[['content', 'Streams'], ['jobs', 'Missions'], ['entities', 'Nodes']].map(([k, l]) => (
                  <div key={k}>
                    <div className="text-2xl font-black text-gradient">{stats[k]}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-50">{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <SectionHeader eyebrow="Featured Streams" title="Compute Intelligence Feed" />
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-72 skeleton" />)}</div>
        ) : content.length === 0 ? <Empty title="No data streams detected" /> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {content.map(c => <ContentCard key={c.id} item={c} />)}
          </div>
        )}
      </Reveal>
    </div>
  );
};

// ── Content Card ──────────────────────────────────────────────────────────────

const ContentCard = ({ item }) => {
  const tags = JSON.parse(item.tags || '[]');
  return (
    <GlassCard hover className="overflow-hidden">
      {item.image_url && (
        <div className="aspect-video overflow-hidden">
          <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge color="blue">{item.domain}</Badge>
          {tags.slice(0, 2).map(t => <Badge key={t} color="purple">{t}</Badge>)}
        </div>
        <h3 className="font-black text-base leading-snug mb-2.5 line-clamp-2">{item.title}</h3>
        <p className="text-xs opacity-60 line-clamp-2 mb-4 leading-relaxed">{item.body}</p>
        <div className="flex items-center justify-between text-[10px] opacity-50 font-bold uppercase tracking-wide">
          <span className="flex items-center gap-1"><I.eye className="w-3 h-3" /> {item.views}</span>
          <span className="flex items-center gap-1"><I.thumb className="w-3 h-3" /> {item.likes}</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </GlassCard>
  );
};

// ── Content Page ──────────────────────────────────────────────────────────────

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
    <div className="space-y-7">
      <Reveal className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pink-500 mb-2">
            <span className="status-dot status-online" /> Stream Hub · Live
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Content Stream</h1>
          <p className="opacity-55 text-sm mt-1">Articles, guides, and transmissions across all nine domains</p>
        </div>
        {user && <GlassButton variant="gradient" size="sm" icon="plus" onClick={() => setShowNew(true)}>Upload Stream</GlassButton>}
      </Reveal>

      <Reveal>
        <GlassCard className="p-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Filter by Domain Node</Label><Select value={domain} onChange={e => setDomain(e.target.value)}><option value="">All Domains</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select></div>
            <div><Label>Query Stream</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transmissions..." /></div>
          </div>
        </GlassCard>
      </Reveal>

      {loading
        ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-72 skeleton" />)}</div>
        : items.length === 0
          ? <Empty icon="film" title="No streams detected" desc="Adjust domain filter or upload the first transmission." />
          : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">{items.map(i => <Reveal key={i.id}><ContentCard item={i} /></Reveal>)}</div>
      }
      <NewContentModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
    </div>
  );
};

const NewContentModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ status: 'published', domain: 'technology', category: 'article' });
  const toast = useToast();
  const submit = async e => {
    e.preventDefault();
    try {
      await api('/api/content', { method: 'POST', body: form });
      toast('Stream uploaded to matrix.', 'success');
      onCreated(); onClose(); setForm({ status: 'published', domain: 'technology', category: 'article' });
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Upload Data Stream">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Stream Title *</Label><Input required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Designation..." /></div>
        <div><Label>Stream Body</Label><Textarea rows={6} value={form.body || ''} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Transmission payload..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Domain Node</Label><Select value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select></div>
          <div><Label>Format</Label><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="article">Article</option><option value="guide">Guide</option><option value="tutorial">Tutorial</option><option value="news">News Flash</option></Select></div>
        </div>
        <div><Label>Thumbnail URL</Label><Input value={form.image_url || ''} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
        <GlassButton type="submit" variant="gradient" className="w-full">Transmit to Matrix</GlassButton>
      </form>
    </Modal>
  );
};

// ── Jobs Page ─────────────────────────────────────────────────────────────────

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
    <div className="space-y-7">
      {/* Hero Banner */}
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl p-8 md:p-12 glass-strong border border-white/40 dark:border-white/10">
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-amber-400/80 via-orange-500/70 to-pink-500/60 rounded-3xl" />
          <div aria-hidden className="absolute -top-16 right-0 w-72 h-72 rounded-full bg-yellow-300/40 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2 flex items-center gap-2">
                <I.users className="w-3 h-3" /> Mission Dispatch · Global
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">Jobs & Freelancing</h1>
              <p className="opacity-85 mt-1.5 text-sm font-medium">Match your talent vector with open mission briefs across all nine worlds</p>
            </div>
            {user && (
              <GlassButton size="md" className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur" icon="plus" onClick={() => setShowNew(true)}>
                Post Mission
              </GlassButton>
            )}
          </div>
        </section>
      </Reveal>

      {/* Filters */}
      <Reveal>
        <GlassCard className="p-5">
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Domain Node</Label><Select value={filter.domain} onChange={e => setFilter({ ...filter, domain: e.target.value })}><option value="">All Domains</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select></div>
            <div><Label>Contract Type</Label><Select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}><option value="">All Types</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="freelance">Freelance</option><option value="contract">Contract</option></Select></div>
            <div><Label>Search Matrix</Label><Input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Title, company..." /></div>
          </div>
        </GlassCard>
      </Reveal>

      {/* Job list */}
      {loading
        ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 skeleton" />)}</div>
        : jobs.length === 0
          ? <Empty icon="case" title="No missions available" desc="Adjust filters or check back when new briefs are dispatched." />
          : (
            <div className="space-y-3 stagger">
              {jobs.map(j => (
                <Reveal key={j.id}>
                  <GlassCard hover className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2.5">
                          <Badge color="yellow">{j.type}</Badge>
                          <Badge color="blue">{j.domain}</Badge>
                        </div>
                        <h3 className="text-lg font-black tracking-tight mb-1">{j.title}</h3>
                        <p className="text-sm opacity-60 font-medium">{j.company} · {j.location}</p>
                        <p className="text-xs mt-2.5 line-clamp-2 opacity-75 leading-relaxed">{j.description}</p>
                        {(j.salary_min || j.salary_max) && (
                          <p className="text-sm font-black mt-2 text-emerald-500">
                            ₹{(j.salary_min / 100000).toFixed(1)}L – ₹{(j.salary_max / 100000).toFixed(1)}L/yr
                          </p>
                        )}
                      </div>
                      <GlassButton
                        variant="primary"
                        size="sm"
                        icon="arrow"
                        onClick={() => user ? setApplyJob(j) : toast('Auth sequence required to apply', 'warning')}
                      >
                        Apply
                      </GlassButton>
                    </div>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          )
      }

      <NewJobModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
      <ApplyJobModal job={applyJob} onClose={() => setApplyJob(null)} />
    </div>
  );
};

const NewJobModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ type: 'full-time', domain: 'technology' });
  const toast = useToast();
  const submit = async e => {
    e.preventDefault();
    try {
      await api('/api/jobs', { method: 'POST', body: { ...form, salary_min: parseInt(form.salary_min) || null, salary_max: parseInt(form.salary_max) || null } });
      toast('Mission brief dispatched.', 'success'); onCreated(); onClose(); setForm({ type: 'full-time', domain: 'technology' });
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Dispatch Mission Brief">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Mission Title *</Label><Input required value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Organization</Label><Input value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
          <div><Label>Deployment Zone</Label><Input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Contract Type</Label><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="freelance">Freelance</option><option value="contract">Contract</option></Select></div>
          <div><Label>Domain Node</Label><Select value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select></div>
        </div>
        <div><Label>Mission Brief</Label><Textarea rows={4} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the mission parameters..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Compensation Floor (₹)</Label><Input type="number" value={form.salary_min || ''} onChange={e => setForm({ ...form, salary_min: e.target.value })} /></div>
          <div><Label>Compensation Ceiling (₹)</Label><Input type="number" value={form.salary_max || ''} onChange={e => setForm({ ...form, salary_max: e.target.value })} /></div>
        </div>
        <GlassButton type="submit" variant="gradient" className="w-full">Dispatch Brief</GlassButton>
      </form>
    </Modal>
  );
};

const ApplyJobModal = ({ job, onClose }) => {
  const [letter, setLetter] = useState('');
  const toast = useToast();
  const submit = async e => {
    e.preventDefault();
    try {
      await api(`/api/jobs/${job.id}/apply`, { method: 'POST', body: { cover_letter: letter } });
      toast('Application transmitted successfully.', 'success'); onClose(); setLetter('');
    } catch (e) { toast(e.message, 'error'); }
  };
  if (!job) return null;
  return (
    <Modal open={true} onClose={onClose} title={`Mission Application · ${job.title}`}>
      <form onSubmit={submit} className="space-y-4">
        <GlassCard className="p-4 glass-soft">
          <p className="font-black text-sm">{job.company}</p>
          <p className="text-xs opacity-60 mt-0.5">{job.location} · {job.type}</p>
        </GlassCard>
        <div><Label>Operator Statement</Label><Textarea rows={6} value={letter} onChange={e => setLetter(e.target.value)} placeholder="Describe your qualification matrix and mission alignment..." /></div>
        <GlassButton type="submit" variant="gradient" className="w-full">Transmit Application</GlassButton>
      </form>
    </Modal>
  );
};

// ── Search Page ───────────────────────────────────────────────────────────────

const SearchPage = () => {
  const { params, navigate } = useRouter();
  const [q, setQ] = useState(params.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback((query) => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setLoading(true);
    api(`/api/search?q=${encodeURIComponent(query)}`)
      .then(d => { setResults(d.results || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (q) search(q); }, []);
  const submit = e => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); search(q); };
  const grouped = useMemo(() => results.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {}), [results]);

  return (
    <div className="space-y-7">
      <Reveal>
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">
            <span className="status-dot status-online" /> Scan Engine · Ready
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Query Matrix</h1>
          <p className="opacity-55 text-sm mt-1">Cross-domain intelligence scan — content, missions, network nodes</p>
        </div>
      </Reveal>

      <Reveal>
        <form onSubmit={submit}>
          <GlassCard className="p-2">
            <div className="relative">
              <I.search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50 pointer-events-none" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Enter search query sequence..."
                className="!pl-12 !pr-4 !py-4 !rounded-xl !text-base !bg-transparent !border-0 !shadow-none"
                aria-label="Search query"
              />
            </div>
          </GlassCard>
        </form>
      </Reveal>

      {loading && (
        <div className="text-center py-12">
          <Spinner size={8} />
          <p className="text-xs font-black uppercase tracking-widest mt-3 opacity-50">Scanning Matrix...</p>
        </div>
      )}

      {!loading && q && results.length === 0 && (
        <Empty icon="search" title={`No results for "${q}"`} desc="Refine query parameters or expand search scope." />
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <Reveal key={type}>
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${type === 'content' ? 'bg-pink-500' : type === 'job' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              {type === 'content' ? 'Data Streams' : type === 'job' ? 'Open Missions' : 'Network Nodes'}
              <Badge color="blue">{items.length}</Badge>
            </h2>
            <div className="grid md:grid-cols-2 gap-3 stagger">
              {items.map((r, idx) => (
                <GlassCard
                  hover
                  key={`${r.type}-${r.id}-${idx}`}
                  className="p-4 cursor-pointer"
                  onClick={() => navigate(r.type === 'job' ? '/jobs' : r.type === 'entity' ? '/entities' : '/content')}
                >
                  <Badge color={r.type === 'content' ? 'pink' : r.type === 'job' ? 'yellow' : 'blue'}>{r.domain}</Badge>
                  <h3 className="font-black text-sm mt-2.5 leading-snug">{r.title}</h3>
                  {r.subtitle && <p className="text-xs opacity-55 mt-1">{r.subtitle}</p>}
                  <div className={`inline-flex items-center gap-1 mt-3 text-[10px] font-black uppercase tracking-widest ${r.type === 'job' ? 'text-yellow-600 dark:text-yellow-400' : 'text-indigo-500'}`}>
                    View Record <I.arrow className="w-3 h-3" />
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </Reveal>
      ))}

      {!q && (
        <Reveal>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              { icon: 'film',  label: 'Browse Content',  to: '/content',  color: 'pink'   },
              { icon: 'case',  label: 'Browse Missions',  to: '/jobs',     color: 'yellow' },
              { icon: 'globe', label: 'Browse Nodes',     to: '/entities', color: 'teal'   },
            ].map(item => (
              <Link key={item.to} to={item.to}>
                <GlassCard hover className={`p-5 text-center ${colorMap[item.color].soft}`}>
                  <div className={`w-10 h-10 rounded-xl ${colorMap[item.color].bg} text-white flex items-center justify-center mx-auto mb-3`}>
                    {React.createElement(I[item.icon], { className: 'w-5 h-5' })}
                  </div>
                  <p className="font-black text-xs uppercase tracking-widest">{item.label}</p>
                </GlassCard>
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
};

// ── Payment Page ──────────────────────────────────────────────────────────────

const PaymentPage = () => {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [processing, setProcessing] = useState(false);

  const subscribe = async (plan) => {
    setProcessing(true);
    try {
      const init = await api('/api/payments/initiate', { method: 'POST', body: { plan } });
      await new Promise(r => setTimeout(r, 1600));
      await api('/api/payments/confirm', { method: 'POST', body: { payment_id: init.payment_id } });
      toast('Access tier upgraded. Welcome to the network.', 'success');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
    setProcessing(false);
  };

  const plans = [
    {
      name: 'Free',
      price: 0,
      label: 'Guest Access',
      desc: 'Basic node entry with limited permissions',
      features: ['Browse all streams', 'Basic command interface', '5 projects max', 'Community node access'],
      color: 'blue',
      current: user?.subscription_type === 'free',
    },
    {
      name: 'Premium',
      price: 200,
      label: 'Neural Link',
      desc: 'Full system access with elevated permissions',
      features: ['Unlimited project nodes', 'Priority response queue', 'Advanced analytics matrix', 'API data streams', '100 XP bonus allocation'],
      color: 'yellow',
      popular: true,
      current: user?.subscription_type === 'premium',
    },
    {
      name: 'Business',
      price: 500,
      label: 'Apex Protocol',
      desc: 'Enterprise-grade access with command override',
      features: ['All Neural Link features', 'Team collaboration matrix', 'Custom branding node', 'Dedicated account agent', 'White-glove SLA'],
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-10">
      <Reveal className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[10px] font-black uppercase tracking-widest mb-5 text-indigo-500">
          <I.crown className="w-3 h-3" /> Access Tier Selection
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          Select Your <span className="text-gradient">Access Protocol</span>
        </h1>
        <p className="opacity-55 mt-3 text-sm max-w-xl mx-auto font-medium">
          Upgrade your neural link to unlock advanced system capabilities across all nine worlds
        </p>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-5 items-start stagger">
        {plans.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.1}>
            <GlassCard
              className={`p-7 relative ${p.popular ? 'ring-2 ring-yellow-400/70 scale-[1.03] shadow-2xl shadow-yellow-400/20' : ''}`}
              strong={p.popular}
            >
              {p.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-400/40">
                    ◈ Optimal Choice
                  </span>
                </div>
              )}
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${colorMap[p.color].soft} ${colorMap[p.color].text} text-[10px] font-black uppercase tracking-widest mb-4`}>
                <I.shield className="w-3 h-3" /> {p.label}
              </div>
              <h3 className="text-2xl font-black mb-1">{p.name}</h3>
              <p className="text-xs opacity-55 mb-5 leading-relaxed">{p.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-black">₹{p.price}</span>
                {p.price > 0 && <span className="opacity-50 text-sm">/month</span>}
                {p.price === 0 && <span className="text-xs opacity-50 ml-2 font-bold uppercase tracking-widest">Forever</span>}
              </div>
              <ul className="space-y-2.5 mb-7">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-xs font-medium">
                    <I.check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colorMap[p.color].text}`} />
                    {f}
                  </li>
                ))}
              </ul>
              {p.current ? (
                <GlassButton variant="glass" className="w-full" disabled>
                  ◈ Current Protocol
                </GlassButton>
              ) : p.price === 0 ? (
                <GlassButton variant="secondary" className="w-full" disabled>
                  Guest Protocol
                </GlassButton>
              ) : (
                <GlassButton
                  variant={p.popular ? 'amber' : 'gradient'}
                  className="w-full"
                  onClick={() => user ? subscribe(p.name.toLowerCase()) : toast('Auth sequence required', 'warning')}
                  disabled={processing}
                >
                  {processing ? <Spinner size={4} /> : `Upgrade to ${p.label}`}
                </GlassButton>
              )}
            </GlassCard>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <GlassCard className="p-7 max-w-3xl mx-auto">
          <h2 className="text-lg font-black uppercase tracking-widest mb-5 flex items-center gap-2">
            <I.spark className="w-4 h-4 text-indigo-500" /> Protocol FAQ
          </h2>
          <div className="space-y-4">
            {[
              ['Can I downgrade or cancel?', 'Affirmative. Tier adjustments can be initiated from command center at any sync cycle.'],
              ['Is the transaction secure?', 'All payment vectors are encrypted using AES-256 and processed through hardened nodes.'],
              ['Refund policy?', 'A 7-cycle rollback window is available for all tier upgrades. Contact support to initiate.'],
            ].map(([q, a]) => (
              <div key={q} className="p-4 glass-soft rounded-xl">
                <p className="font-black text-sm mb-1">{q}</p>
                <p className="text-xs opacity-60 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
};

// ── Entities Page ─────────────────────────────────────────────────────────────

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
    <div className="space-y-7">
      <Reveal className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-500 mb-2">
            <span className="status-dot status-online" /> Network Registry · Active
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Network Nodes</h1>
          <p className="opacity-55 text-sm mt-1">Organizations, institutions, and registered entities across the matrix</p>
        </div>
        {user && <GlassButton variant="gradient" size="sm" icon="plus" onClick={() => setShowNew(true)}>Register Node</GlassButton>}
      </Reveal>

      <Reveal>
        <GlassCard className="p-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Domain Filter</Label><Select value={filter.domain} onChange={e => setFilter({ ...filter, domain: e.target.value })}><option value="">All Domains</option>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select></div>
            <div><Label>Query Node</Label><Input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Name..." /></div>
          </div>
        </GlassCard>
      </Reveal>

      {loading
        ? <div className="grid md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-40 skeleton" />)}</div>
        : items.length === 0
          ? <Empty icon="globe" title="No nodes registered" desc="Be the first to register an entity node in this domain." />
          : (
            <div className="grid md:grid-cols-2 gap-4 stagger">
              {items.map(e => (
                <Reveal key={e.id}>
                  <GlassCard hover className="p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-500/30 flex-shrink-0">
                        {e.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-base tracking-tight">{e.name}</h3>
                        <div className="flex flex-wrap gap-1.5 my-1.5">
                          <Badge color="blue">{e.domain}</Badge>
                          <Badge color="purple">{e.type}</Badge>
                        </div>
                        <p className="text-xs opacity-60 line-clamp-2 leading-relaxed">{e.description}</p>
                        {e.website && (
                          <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 font-black mt-2 inline-flex items-center gap-1">
                            <I.globe className="w-2.5 h-2.5" /> {e.website.replace('https://', '')}
                          </a>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          )
      }
      <NewEntityModal open={showNew} onClose={() => setShowNew(false)} onCreated={load} />
    </div>
  );
};

const NewEntityModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ type: 'organization', domain: 'technology' });
  const toast = useToast();
  const submit = async e => {
    e.preventDefault();
    try {
      await api('/api/entities', { method: 'POST', body: form });
      toast('Node registered in matrix.', 'success'); onCreated(); onClose(); setForm({ type: 'organization', domain: 'technology' });
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Register Network Node">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Entity Designation *</Label><Input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Node Type</Label><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="organization">Organization</option><option value="company">Company</option><option value="nonprofit">Non-profit</option><option value="institution">Institution</option></Select></div>
          <div><Label>Domain Node</Label><Select value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>{DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select></div>
        </div>
        <div><Label>Entity Description</Label><Textarea rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Operational mandate..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Web Address</Label><Input value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Contact Signal</Label><Input type="email" value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
        </div>
        <GlassButton type="submit" variant="gradient" className="w-full">Register Node</GlassButton>
      </form>
    </Modal>
  );
};

// ── Activity Page ─────────────────────────────────────────────────────────────

const ActivityPage = () => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/activity?page=${page}`)
      .then(d => { setItems(d.activity || []); setTotal(d.total); setLoading(false); })
      .catch(() => setLoading(false));
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
    <div className="space-y-7">
      <Reveal>
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-500 mb-2">
            <span className="status-dot status-online" /> System Log · Recording
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">System Event Log</h1>
          <p className="opacity-55 text-sm mt-1">Complete operator action history — all interactions recorded</p>
        </div>
      </Reveal>

      {loading
        ? <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-16 skeleton" />)}</div>
        : items.length === 0
          ? <Empty icon="activity" title="Log empty — no events recorded" desc="Begin operating the platform to generate system events." />
          : (
            <Reveal>
              <GlassCard className="divide-y divide-white/20 dark:divide-white/06">
                {items.map((a, idx) => {
                  const Icon = I[iconForAction(a.action)] || I.zap;
                  const meta = JSON.parse(a.metadata || '{}');
                  return (
                    <div
                      key={a.id}
                      className="p-4 md:p-5 flex items-center gap-4 hover:bg-white/40 dark:hover:bg-white/04 transition-colors"
                      style={{ animation: `slideIn 0.35s ${0.03 * idx}s both` }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/25">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm capitalize tracking-tight">{a.action.replace(/_/g, ' ')}</p>
                        {a.resource_type && (
                          <p className="text-[10px] opacity-50 font-medium mt-0.5">
                            {a.resource_type}{meta.title ? ` · "${meta.title}"` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-[10px] opacity-40 font-bold uppercase tracking-widest whitespace-nowrap">{timeAgo(a.created_at)}</div>
                    </div>
                  );
                })}
              </GlassCard>
            </Reveal>
          )
      }

      {total > 20 && (
        <div className="flex justify-center items-center gap-3">
          <GlassButton variant="glass" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</GlassButton>
          <span className="px-4 py-2 glass rounded-xl text-xs font-black uppercase tracking-widest">
            Page {page} / {Math.ceil(total / 20)}
          </span>
          <GlassButton variant="glass" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>Next →</GlassButton>
        </div>
      )}
    </div>
  );
};

// ── 404 Page ──────────────────────────────────────────────────────────────────

const NotFoundPage = () => (
  <div className="text-center py-24">
    <div className="text-9xl font-black opacity-10 tracking-tighter mb-4">404</div>
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-soft text-[10px] font-black uppercase tracking-widest mb-6 text-red-500">
      <span className="status-dot status-off" /> Node Not Found
    </div>
    <h2 className="text-2xl font-black mb-2 tracking-tight">Destination node unreachable</h2>
    <p className="opacity-55 mb-8 text-sm">The requested path does not exist in the current matrix.</p>
    <Link to="/"><GlassButton variant="gradient" icon="cpu">Return to Home Base</GlassButton></Link>
  </div>
);

// ─── Main App Shell ──────────────────────────────────────────────────────────

const Routes = () => {
  const { path } = useRouter();
  const p = path.split('?')[0];
  switch (p) {
    case '/':           return <HomePage />;
    case '/dashboard':  return <RequireAuth><DashboardPage /></RequireAuth>;
    case '/technology': return <TechnologyPage />;
    case '/jobs':       return <JobsPage />;
    case '/search':     return <SearchPage />;
    case '/payment':    return <RequireAuth><PaymentPage /></RequireAuth>;
    case '/entities':   return <EntitiesPage />;
    case '/content':    return <ContentPage />;
    case '/activity':   return <RequireAuth><ActivityPage /></RequireAuth>;
    default:            return <NotFoundPage />;
  }
};

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { path } = useRouter();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setSidebarOpen(false); }, [path]);

  return (
    <>
      <AnimatedBackground />
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar onMenu={() => setSidebarOpen(true)} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Routes />
          </main>
          <footer className="mt-12 px-6 py-5 border-t border-white/25 dark:border-white/06 glass">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-xs">G</div>
                <span className="text-[11px] font-black uppercase tracking-[0.15em] opacity-50">GuideSoft · Nine Worlds Hub · Build 2026.1</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill online={true} />
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
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
