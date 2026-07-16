'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Factory,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  Users,
  Settings,
  LogOut,
  Warehouse,
  FileText,
  AlertTriangle,
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  AlertCircle,
  Receipt,
  ShoppingBag,
  UserCheck,
  ChevronDown,
  Leaf,
  Sparkles,
  Activity,
  Building2,
  UserCog,
  Network,
  GraduationCap,
  Shield,
  ShieldCheck,
  HeartPulse,
  Bell,
  History,
  Share2,
  RefreshCw,
  FileSearch,
  Target,
  MessageSquare,
  Undo2,
  Droplets,
  FlaskConical,
  Search,
  Briefcase,
  BarChart3,
  Sliders,
  Bug,
  Calculator,
  Landmark,
  Wrench,
  CalendarCheck,
  DollarSign,
  LayoutGrid,
  CheckCircle,
  TrendingUp,
  Play,
  Layers,
  Award,
  ScrollText,
  Scale,
  Thermometer,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { expandRole } from '@/lib/auth/role-mapping';
import { navLabel } from '@/lib/i18n/nav-labels';
import { useTranslations } from 'next-intl';
import { SidebarLanguageToggle } from '@/components/shared/language-switcher';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  roles?: string[]; // Roles that can see this menu item (empty = all roles)
  children?: NavChild[];
}

interface NavChild {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  // Roles that can see this child link (undefined/empty = inherit parent visibility).
  // Used to hide admin/hr_admin-only sub-pages from lower-privileged users so they
  // don't click into a 403. Admin always bypasses.
  roles?: string[];
  // external = render a plain <a> doing a full browser navigation instead of a
  // client-side <Link>. Needed for the Metaherb SSO handoff: href points at an
  // API route that mints a token and 302-redirects cross-origin, which Next's
  // client router can't follow.
  external?: boolean;
}

// Define which roles can access which modules
// Empty array or undefined = accessible to all authenticated users
// 'admin' role can access everything
const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }, // All users
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    roles: ['admin', 'manager', 'warehouse', 'production', 'qc', 'purchasing'],
    children: [
      // Master data
      { name: 'Items', href: '/inventory/items', icon: Boxes },
      { name: 'Lots', href: '/inventory/lots', icon: Package },
      { name: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse },
      // Inbound → outbound → returns
      { name: 'Goods Receipt (Warehouse)', href: '/inventory/goods-receipt', icon: ClipboardCheck },
      { name: 'Material Requisitions', href: '/inventory/requisitions', icon: ClipboardList },
      { name: 'Returns Inbox', href: '/inventory/returns', icon: Undo2 },
      // Records & monitoring
      { name: 'Transactions', href: '/inventory/transactions', icon: ArrowLeftRight },
      { name: 'Expiry Alerts', href: '/inventory/expiry-alerts', icon: AlertTriangle },
    ],
  },
  {
    name: 'Production',
    href: '/production',
    icon: Factory,
    roles: ['admin', 'manager', 'production', 'qc'],
    children: [
      { name: 'BOM/Recipes', href: '/production/bom', icon: FileText },
      { name: 'Work Orders', href: '/production/work-orders', icon: ClipboardList },
      { name: 'Batch Records', href: '/production/batch-records', icon: FileText },
      { name: 'Extra Withdrawal (non-BOM)', href: '/material-withdrawal', icon: ArrowLeftRight },
      { name: 'Master Data', href: '/master-data', icon: Settings },
    ],
  },
  {
    name: 'Quality',
    href: '/quality',
    icon: ClipboardCheck,
    roles: ['admin', 'manager', 'production', 'qc'],
    children: [
      // QC records & inspection forms
      { name: 'QC Entry', href: '/quality/qc-entry', icon: FlaskConical },
      { name: 'ใบตรวจ QC', href: '/quality/qc-inspections', icon: ClipboardList },
      // Certificate of Analysis (templates live inside this page)
      { name: 'Certificate of Analysis', href: '/quality/coa', icon: Award },
      // Incoming Inspection (QC) — removed from the menu; the "รอลงทะเบียน QC"
      // panel in QC Entry now surfaces the lines awaiting registration. The
      // /quality/incoming-inspection route + API remain for the aging/overview
      // dashboard if it needs to be re-linked later.
      // Deviations & audit
      { name: 'Deviations', href: '/quality/deviations', icon: AlertCircle },
      { name: 'QC Audit Trail', href: '/quality/audit-trail', icon: ScrollText },
    ],
  },
  {
    name: 'Premises',
    href: '/premises',
    icon: Building2,
    roles: ['admin', 'manager', 'qc', 'qa', 'production', 'warehouse'],
    children: [
      { name: 'Premises Overview', href: '/premises', icon: Building2 },
      { name: 'Storage Monitoring', href: '/premises/storage-monitoring', icon: Thermometer },
      { name: 'Environmental Inspection', href: '/premises/environmental/inspections', icon: Thermometer },
      { name: 'Scale Verification', href: '/premises/scale-verification', icon: Scale },
      { name: 'Sanitation', href: '/premises/sanitation', icon: Sparkles },
      { name: 'Water Quality', href: '/premises/environmental/water-quality', icon: Droplets },
      { name: 'Maintenance Alerts', href: '/premises/notifications', icon: Bell },
    ],
  },
  {
    name: 'GMP Compliance',
    href: '/gmp',
    icon: Shield,
    roles: ['admin', 'manager', 'qc', 'qa', 'production'],
    children: [
      { name: 'Documents', href: '/gmp/documents', icon: FileSearch },
      { name: 'SOP Assistant', href: '/gmp/documents/assistant', icon: Sparkles },
      { name: 'Changes', href: '/gmp/changes', icon: History },
      { name: 'CAPA', href: '/gmp/capa', icon: Target },
      { name: 'Complaints', href: '/gmp/complaints', icon: MessageSquare },
      { name: 'Recalls', href: '/gmp/recalls', icon: Undo2 },
      { name: 'Stability', href: '/gmp/stability', icon: FlaskConical },
      { name: 'Internal Audit', href: '/gmp/internal-audit', icon: Search },
      { name: 'Contracts', href: '/gmp/contracts', icon: Briefcase },
      { name: 'PQR', href: '/gmp/pqr', icon: BarChart3 },
    ],
  },
  {
    name: 'Purchasing',
    href: '/purchasing',
    icon: ShoppingCart,
    roles: ['admin', 'manager', 'purchasing', 'warehouse'],
    children: [
      { name: 'Requisitions', href: '/purchasing/requisitions', icon: ClipboardList },
      { name: 'Purchase Orders', href: '/purchasing/orders', icon: Receipt },
      { name: 'Vendors', href: '/purchasing/vendors', icon: Building2 },
      { name: 'Purchase Report', href: '/purchasing/reports', icon: FileText },
      { name: 'Herbal Market', href: '/api/sso/metaherb', icon: LogIn, external: true },
    ],
  },
  {
    name: 'Sales',
    href: '/sales',
    icon: Truck,
    roles: ['admin', 'manager', 'sales', 'warehouse'],
    children: [
      { name: 'Sales Orders', href: '/sales/orders', icon: ShoppingBag },
      { name: 'Delivery Notes', href: '/sales/deliveries', icon: Truck },
      { name: 'VMI Orders', href: '/sales/vmi-orders', icon: Share2 },
      { name: 'Customers', href: '/sales/customers', icon: UserCheck },
      { name: 'Sales Report', href: '/sales/reports', icon: FileText },
    ],
  },
  {
    name: 'Accounting',
    href: '/accounting',
    icon: Calculator,
    roles: ['admin', 'manager', 'accounting', 'finance'],
    children: [
      { name: 'Dashboard', href: '/accounting', icon: LayoutDashboard },
      { name: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: Landmark },
      { name: 'Account Types', href: '/accounting/account-types', icon: Layers },
      { name: 'Journal Entries', href: '/accounting/journal-entries', icon: FileText },
      { name: 'AP Invoices', href: '/accounting/ap', icon: Receipt },
      { name: 'AR Invoices', href: '/accounting/ar', icon: DollarSign },
      { name: 'Fixed Assets', href: '/accounting/fixed-assets', icon: Building2 },
      { name: 'Equipment', href: '/accounting/equipment', icon: Wrench },
      { name: 'Period Close', href: '/accounting/period-close', icon: CalendarCheck },
      { name: 'Bank Reconciliation', href: '/accounting/bank-reconciliation', icon: RefreshCw },
      { name: 'Credit/Debit Notes', href: '/accounting/credit-debit-notes', icon: FileText },
      { name: '3-Way Matching', href: '/accounting/matching', icon: ClipboardCheck },
      { name: 'Approvals', href: '/accounting/approvals', icon: CheckCircle },
      { name: 'Standard Costs', href: '/accounting/standard-costs', icon: Target },
      { name: 'Variance Reports', href: '/accounting/variance-reports', icon: TrendingUp },
      { name: 'Reports', href: '/accounting/reports', icon: BarChart3 },
    ],
  },
  {
    name: 'Cost Management',
    href: '/cost',
    icon: DollarSign,
    roles: ['admin', 'manager', 'finance', 'accounting', 'purchasing', 'production'],
    children: [
      { name: 'Dashboard', href: '/cost', icon: BarChart3 },
      { name: 'Landed Costs', href: '/cost/landed-costs', icon: Truck },
      { name: 'Work Centers', href: '/cost/work-centers', icon: Factory },
      { name: 'Cost Summary', href: '/cost/reports/cost-summary', icon: FileText },
    ],
  },
  {
    name: 'VMI Portal',
    href: '/vmi',
    icon: Share2,
    roles: ['admin', 'manager', 'sales', 'warehouse'],
    children: [
      { name: 'Dashboard', href: '/vmi', icon: Activity },
      { name: 'Sync', href: '/vmi/sync', icon: RefreshCw },
      { name: 'Orders', href: '/sales/vmi-orders', icon: ShoppingCart },
    ],
  },
  {
    name: 'HR',
    href: '/hr',
    icon: UserCog,
    roles: ['admin', 'manager', 'hr', 'hr_admin', 'hr_staff'],
    children: [
      { name: 'Organization', href: '/hr/org', icon: Network },
      { name: 'Employees', href: '/hr/employees', icon: Users },
      { name: 'Positions', href: '/hr/positions', icon: ClipboardList },
      { name: 'Training', href: '/hr/training', icon: GraduationCap },
      // Authorizations / Roles / Audit are admin-style governance pages — keep
      // them out of lower HR roles (hr_staff) to avoid 403 dead-ends.
      { name: 'Authorizations', href: '/hr/authorizations', icon: Shield, roles: ['admin', 'manager', 'hr_admin'] },
      { name: 'Health Records', href: '/hr/health-records', icon: HeartPulse },
      { name: 'Roles', href: '/hr/roles', icon: UserCheck, roles: ['admin', 'manager', 'hr_admin'] },
      { name: 'Notifications', href: '/hr/notifications', icon: Bell },
      { name: 'Audit Trail', href: '/hr/audit', icon: History, roles: ['admin', 'manager', 'hr_admin'] },
    ],
  },
  {
    name: 'Template',
    href: '/template',
    icon: LayoutGrid,
    roles: ['admin'], // Admin-family only (dev reference module — not for end users)
    children: [
      { name: 'Dashboard', href: '/template', icon: LayoutDashboard },
      { name: 'Items', href: '/template/items', icon: Package },
    ],
  },
  {
    name: 'Issues',
    href: '/issues',
    icon: Bug,
    roles: [], // Accessible to all authenticated users
    children: [
      { name: 'Dashboard', href: '/issues', icon: LayoutDashboard },
      { name: 'All Issues', href: '/issues/list', icon: ClipboardList },
      { name: 'Report Issue', href: '/issues/new', icon: AlertTriangle },
    ],
  },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['admin', 'manager', 'hr'] },
  { name: 'Users', href: '/users', icon: Users, roles: ['admin', 'manager'] },
  {
    name: 'Admin',
    href: '/admin',
    icon: Shield,
    roles: ['admin'],
    children: [
      { name: 'Confidential Groups', href: '/admin/confidential-groups', icon: ShieldCheck },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'manager'],
    children: [
      { name: 'General', href: '/settings', icon: Sliders },
      { name: 'Metaherb SSO', href: '/settings/metaherb-sso', icon: LogIn, roles: ['admin', 'manager'] },
      { name: 'Approval Workflows', href: '/settings/approval-workflows', icon: ClipboardCheck },
      { name: 'Matching Tolerances', href: '/settings/matching-tolerances', icon: Target },
      { name: 'Workflow Test', href: '/settings/workflow-test', icon: Play, roles: ['admin'] },
    ],
  },
];

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    role: string;
  };
  onLogout?: () => void;
  onNavigate?: () => void;
}

// Helper function to filter navigation based on role.
//
// Uses `expandRole()` so an HR role code like "QC_ANALYST" (stored on
// users.role when set via /users/new) gets translated to the legacy
// lowercase equivalents (["qc"]) that the menu definitions above compare
// against. Without this, HR-coded users see an empty sidebar because the
// string "qc_analyst" is not in any item.roles list.
function getFilteredNavigation(role: string | undefined): NavItem[] {
  const expanded = expandRole(role);
  const isAdmin = expanded.includes('admin');

  // Shared allow-list check: empty/undefined roles = visible to all.
  const allowed = (roles: string[] | undefined): boolean => {
    if (isAdmin) return true;
    if (!roles || roles.length === 0) return true;
    return roles.some((r) => expanded.includes(r.toLowerCase()));
  };

  return navigation
    .filter((item) => allowed(item.roles))
    .map((item) => {
      if (!item.children) return item;
      // Filter children too so users without permission don't see sub-links
      // that 403 on click (e.g. Roles / Authorizations / Audit Trail).
      const visibleChildren = item.children.filter((child) => allowed(child.roles));
      return { ...item, children: visibleChildren };
    });
}

// Helper to find parent item for current pathname
function findParentForPath(pathname: string, navItems: NavItem[]): string | null {
  // First check if pathname matches the parent href directly
  const directMatch = navItems.find(
    (item) => item.children && pathname.startsWith(item.href)
  );
  if (directMatch) return directMatch.name;

  // Also check children hrefs (e.g. /master-data is a child of Production at /production)
  const childMatch = navItems.find(
    (item) => item.children?.some(
      (child) => pathname === child.href || pathname.startsWith(child.href + '/')
    )
  );
  return childMatch?.name ?? null;
}

// Persist the open groups + scroll position across the Sidebar remounts that
// happen on every cross-module navigation (each module has its own layout.tsx
// that renders MainLayout → Sidebar, so moving between modules unmounts and
// remounts the rail). Without this the expanded group collapsed and the scroll
// jumped back to the top on each navigation. sessionStorage keeps it stable for
// the tab's lifetime.
const EXPANDED_KEY = 'sidebar:expandedItems';
const SCROLL_KEY = 'sidebar:scrollTop';

function readExpanded(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(EXPANDED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

export function Sidebar({ user, onLogout, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  // Scroll container ref (kept for layout). The sidebar never auto-scrolls.
  const navScrollRef = useRef<HTMLElement | null>(null);
  // Sidebar nav array uses English labels as the source; navLabel resolves
  // them to Thai/English at render time via src/locales/*/navigation.json.
  const tNav = useTranslations('navigation');

  // Filter navigation items based on user role. Memoized so its identity is
  // stable across renders — otherwise the route-change effects below would see
  // a "new" dependency every render and churn.
  const filteredNavigation = useMemo(() => getFilteredNavigation(user?.role), [user?.role]);

  // Initialize expanded items from sessionStorage (survives remount) and fall
  // back to the parent group of the current route on first ever load.
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const persisted = readExpanded();
    if (persisted) return persisted;
    const parentName = findParentForPath(pathname, filteredNavigation);
    return parentName ? [parentName] : [];
  });

  // Mirror expanded groups into sessionStorage whenever they change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedItems));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [expandedItems]);

  // Restore the saved scroll position on mount, then keep it saved as the user
  // scrolls. This makes the rail stay exactly where it was across navigations.
  useEffect(() => {
    const scroller = navScrollRef.current;
    if (!scroller) return;
    try {
      const saved = window.sessionStorage.getItem(SCROLL_KEY);
      if (saved) scroller.scrollTop = Number(saved) || 0;
    } catch {
      /* ignore */
    }
    const onScroll = () => {
      try {
        window.sessionStorage.setItem(SCROLL_KEY, String(scroller.scrollTop));
      } catch {
        /* ignore */
      }
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-expand the parent group ONLY when the route actually changes (i.e. the
  // user navigated to a new page). This must NOT depend on expandedItems —
  // otherwise clicking to open one group (e.g. "บัญชี") re-runs the effect and
  // force-re-expands the group of the CURRENT page (e.g. "คลังสินค้า"), so the
  // wrong menu pops open. We read/extend expandedItems via the functional
  // updater instead of listing it as a dependency.
  useEffect(() => {
    // Skip on initial mount (handled by useState initializer)
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname;
      return;
    }
    // Only run when pathname actually changes
    if (prevPathnameRef.current === pathname) {
      return;
    }
    prevPathnameRef.current = pathname;

    const parentItem = findParentForPath(pathname, filteredNavigation);
    if (parentItem) {
      setExpandedItems((prev) => (prev.includes(parentItem) ? prev : [...prev, parentItem]));
    }
  }, [pathname, filteredNavigation]);

  // Ordinary-sidebar behaviour: the rail NEVER auto-scrolls. Clicking a group
  // just expands/collapses it in place; navigating never yanks the view. The
  // sidebar stays exactly where the user left it. (We previously scrolled the
  // active item into view, but that fought the user's scroll position and made
  // the menu jump — removed entirely.)

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isChildActive = (href: string) => {
    return pathname === href;
  };

  // Toggle a group open/closed AND keep the clicked button pinned under the
  // cursor. overflow-anchor:none stops the browser's own anchoring, but the
  // submenu still adds/removes height *above* lower groups, so a group clicked
  // while the rail is scrolled would still drift. We measure the button's
  // viewport offset before the state change and restore it on every animation
  // frame for the length of the 300ms max-height transition — so the row the
  // user clicked never moves on screen, exactly like a normal sidebar.
  const toggleExpand = (name: string, evt?: React.MouseEvent<HTMLButtonElement>) => {
    const btn = evt?.currentTarget ?? null;
    const scroller = navScrollRef.current;
    const topBefore = btn ? btn.getBoundingClientRect().top : null;

    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );

    if (!btn || !scroller || topBefore == null) return;
    // Re-pin across the transition (max-h animates over ~300ms). Each frame we
    // nudge scrollTop by however much the button has drifted from where it was.
    const start = performance.now();
    const pin = () => {
      const topNow = btn.getBoundingClientRect().top;
      const drift = topNow - topBefore;
      if (Math.abs(drift) > 0.5) scroller.scrollTop += drift;
      if (performance.now() - start < 360) requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
  };

  const isExpanded = (name: string) => {
    return expandedItems.includes(name);
  };

  const handleLinkClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <div className="flex flex-col h-full w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 shadow-2xl">
      {/* Logo Section */}
      <div className="flex items-center h-16 md:h-20 px-4 md:px-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={cn(
                'w-10 h-10 md:w-11 md:h-11 rounded-xl',
                'bg-gradient-to-br from-emerald-400 to-teal-500',
                'flex items-center justify-center',
                'shadow-lg shadow-emerald-500/30'
              )}
            >
              <Leaf className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3">
              <Sparkles
                className={cn(
                  'w-3 h-3 text-amber-400',
                  'motion-safe:animate-pulse motion-reduce:animate-none'
                )}
              />
            </div>
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
              Herbal ERP
            </h1>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-medium">
              Medicine Management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation — relative wrapper hosts a bottom fade so partially-cut
          items soften out instead of being sharply clipped; extra bottom
          padding ensures the last item has room above the user section. */}
      <div className="flex-1 min-h-0 relative">
        {/* overflowAnchor:'none' — the submenus are always in the DOM and merely
            animate their height (max-h-0 ↔ max-h-[48rem]). When the rail is
            scrolled and a group expands, the browser's scroll-anchoring tries to
            "preserve" the view by shifting scrollTop, which makes the whole rail
            visibly jump. Disabling scroll-anchoring on the scroll container keeps
            the rail exactly where the user left it. */}
        <nav ref={navScrollRef} style={{ overflowAnchor: 'none' }} className="absolute inset-0 overflow-y-auto pt-4 md:pt-6 pb-28 px-2 md:px-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <div className="space-y-1">
          {filteredNavigation.map((item) => (
            <div key={item.name}>
              {item.children ? (
                // Parent with children
                <div>
                  <button
                    onClick={(e) => toggleExpand(item.name, e)}
                    data-active={isActive(item.href) ? 'true' : undefined}
                    aria-expanded={isExpanded(item.name)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm font-medium',
                      'transition-all duration-200 ease-out',
                      'motion-reduce:transition-none',
                      'group',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div
                        className={cn(
                          'p-1.5 md:p-2 rounded-lg',
                          'transition-all duration-200 ease-out',
                          'motion-reduce:transition-none',
                          isActive(item.href)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm">{navLabel(item.name, tNav)}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4',
                        'transition-transform duration-200 ease-out',
                        'motion-reduce:transition-none',
                        isExpanded(item.name) && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Submenu with smooth animation.
                      max-h-96 (384px) was clipping any section with more
                      than ~9 children — Quality currently has 15 and the
                      bottom 7 (Certificate of Analysis, COA Templates,
                      Test Panels, Tests, Specifications, Deviations,
                      QC Audit Trail) silently disappeared under
                      overflow-hidden. Bumped the expanded cap to 48rem
                      (~768px ≈ 19 rows) so the animation still has a
                      target height but no real submenu gets truncated. */}
                  <div
                    className={cn(
                      'overflow-hidden',
                      'transition-all duration-300 ease-out',
                      'motion-reduce:transition-none',
                      isExpanded(item.name)
                        ? 'max-h-[48rem] opacity-100'
                        : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="mt-1 ml-3 md:ml-4 pl-3 md:pl-4 border-l border-slate-700/50 space-y-1">
                      {item.children.map((child) => {
                        const childClassName = cn(
                          'flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg text-sm',
                          'transition-all duration-200 ease-out',
                          'motion-reduce:transition-none',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900',
                          isChildActive(child.href)
                            ? 'bg-emerald-500/10 text-emerald-400 font-medium border-l-2 border-emerald-400 -ml-[2px] pl-[calc(0.5rem+2px)] md:pl-[calc(0.75rem+2px)]'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        );
                        const childInner = (
                          <>
                            {child.icon && (
                              <child.icon
                                className={cn(
                                  'h-4 w-4',
                                  isChildActive(child.href) && 'text-emerald-400'
                                )}
                              />
                            )}
                            <span>{navLabel(child.name, tNav)}</span>
                          </>
                        );
                        // External children (e.g. the Metaherb SSO handoff) point at
                        // an API route that 302-redirects cross-origin — use a plain
                        // <a> so the browser does a full navigation, not Next routing.
                        if (child.external) {
                          return (
                            <a
                              key={child.name}
                              href={child.href}
                              onClick={handleLinkClick}
                              className={childClassName}
                            >
                              {childInner}
                            </a>
                          );
                        }
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={handleLinkClick}
                            data-active={isChildActive(child.href) ? 'true' : undefined}
                            aria-current={isChildActive(child.href) ? 'page' : undefined}
                            className={childClassName}
                          >
                            {childInner}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                // Single item without children
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  data-active={isActive(item.href) ? 'true' : undefined}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm font-medium',
                    'transition-all duration-200 ease-out',
                    'motion-reduce:transition-none',
                    'group',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  )}
                >
                  <div
                    className={cn(
                      'p-1.5 md:p-2 rounded-lg',
                      'transition-all duration-200 ease-out',
                      'motion-reduce:transition-none',
                      isActive(item.href)
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm">{navLabel(item.name, tNav)}</span>
                </Link>
              )}
            </div>
          ))}
        </div>
        </nav>
        {/* Bottom fade — softens any partially-cut last visible item, hints that
            more content is below the scrollable area. The nav's pb-28 gives the
            last item (VMI Portal) enough room to scroll fully above the fade, so
            it never sits dimmed under the gradient. */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* User Section — flex-shrink-0 prevents it from compressing the nav */}
      {user && (
        <div className="flex-shrink-0 p-3 md:p-4 border-t border-slate-700/50 bg-slate-900">
          <div
            className={cn(
              'flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl',
              'bg-slate-800/50',
              'transition-all duration-200 ease-out',
              'motion-reduce:transition-none',
              'hover:bg-slate-800'
            )}
          >
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  'h-9 w-9 md:h-10 md:w-10 rounded-xl',
                  'bg-gradient-to-br from-emerald-400 to-teal-500',
                  'flex items-center justify-center',
                  'shadow-lg shadow-emerald-500/20'
                )}
              >
                <span className="text-sm font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div
                className={cn(
                  'absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3',
                  'bg-emerald-400 rounded-full border-2 border-slate-900'
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 truncate">
                {user.role}
              </p>
            </div>
            <button
              onClick={onLogout}
              className={cn(
                'p-1.5 md:p-2 rounded-lg flex-shrink-0',
                'text-slate-400 hover:text-red-400',
                'hover:bg-red-500/10',
                'transition-all duration-200 ease-out',
                'motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'
              )}
              title="Logout"
            >
              <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>

          {/* Language Toggle — native HTML button (reliable on Chrome/Firefox/Edge) */}
          <div className="mt-3 px-1 sidebar-language-switcher">
            <SidebarLanguageToggle />
          </div>
        </div>
      )}
    </div>
  );
}
