'use client';

import { useState, useEffect, useRef } from 'react';
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
  TestTube,
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
  ListChecks,
  Award,
  ScrollText,
  Scale,
  CalendarDays,
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
  children?: { name: string; href: string; icon?: React.ComponentType<{ className?: string }>; badge?: number }[];
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
      { name: 'Items', href: '/inventory/items', icon: Boxes },
      { name: 'Lots', href: '/inventory/lots', icon: Package },
      { name: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse },
      { name: 'Transactions', href: '/inventory/transactions', icon: ArrowLeftRight },
      { name: 'ใบเบิกวัตถุดิบ', href: '/inventory/requisitions', icon: ClipboardList },
      { name: 'ตรวจรับของ (GRN)', href: '/inventory/goods-receipt', icon: ClipboardCheck },
      { name: 'Returns Inbox', href: '/inventory/returns', icon: Undo2 },
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
      { name: 'เบิกวัตถุดิบเพิ่ม', href: '/material-withdrawal', icon: ArrowLeftRight },
      { name: 'รออนุมัติเบิกเพิ่ม', href: '/material-withdrawal/pending', icon: Bell },
      { name: 'Master Data', href: '/master-data', icon: Settings },
    ],
  },
  {
    name: 'Quality',
    href: '/quality',
    icon: ClipboardCheck,
    roles: ['admin', 'manager', 'production', 'qc'],
    children: [
      { name: 'QC Entry', href: '/quality/qc-entry', icon: FlaskConical },
      { name: 'ตรวจรับเข้า', href: '/quality/incoming-inspection', icon: ClipboardCheck },
      { name: 'ตรวจเครื่องชั่ง (ลูกตุ้ม)', href: '/quality/scale-verification', icon: Scale },
      { name: 'แจ้งเตือนบำรุงรักษา', href: '/notifications', icon: Bell },
      { name: 'ปฏิทินบำรุงรักษา', href: '/notifications/calendar', icon: CalendarDays },
      { name: 'Certificate of Analysis', href: '/quality/coa', icon: Award },
      { name: 'COA Templates', href: '/quality/coa/templates', icon: Layers },
      { name: 'Test Panels', href: '/quality/test-panels', icon: ListChecks },
      { name: 'Tests', href: '/quality/tests', icon: TestTube },
      { name: 'Specifications', href: '/quality/specs', icon: FileText },
      { name: 'Deviations', href: '/quality/deviations', icon: AlertCircle },
      { name: 'QC Audit Trail', href: '/quality/audit-trail', icon: ScrollText },
    ],
  },
  {
    name: 'GMP Compliance',
    href: '/gmp',
    icon: Shield,
    roles: ['admin', 'manager', 'qc', 'qa', 'production'],
    children: [
      { name: 'Documents', href: '/gmp/documents', icon: FileSearch },
      { name: 'Changes', href: '/gmp/changes', icon: History },
      { name: 'CAPA', href: '/gmp/capa', icon: Target },
      { name: 'Complaints', href: '/gmp/complaints', icon: MessageSquare },
      { name: 'Recalls', href: '/gmp/recalls', icon: Undo2 },
      { name: 'Sanitation', href: '/gmp/sanitation', icon: Droplets },
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
    ],
  },
  {
    name: 'Sales',
    href: '/sales',
    icon: Truck,
    roles: ['admin', 'manager', 'sales', 'warehouse'],
    children: [
      { name: 'Sales Orders', href: '/sales/orders', icon: ShoppingBag },
      { name: 'VMI Orders', href: '/sales/vmi-orders', icon: Share2 },
      { name: 'Customers', href: '/sales/customers', icon: UserCheck },
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
      { name: 'Authorizations', href: '/hr/authorizations', icon: Shield },
      { name: 'Health Records', href: '/hr/health-records', icon: HeartPulse },
      { name: 'Roles', href: '/hr/roles', icon: UserCheck },
      { name: 'Notifications', href: '/hr/notifications', icon: Bell },
      { name: 'Audit Trail', href: '/hr/audit', icon: History },
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
      { name: 'Approval Workflows', href: '/settings/approval-workflows', icon: ClipboardCheck },
      { name: 'Matching Tolerances', href: '/settings/matching-tolerances', icon: Target },
      { name: 'Workflow Test', href: '/settings/workflow-test', icon: Play },
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
  return navigation.filter((item) => {
    // Administrator sees all menu items — bypass role filtering.
    if (isAdmin) return true;
    // If no roles specified, item is visible to all authenticated users.
    if (!item.roles || item.roles.length === 0) {
      return true;
    }
    // User's role passes if ANY of its expanded aliases is in the allow-list.
    return item.roles.some((allowed) => expanded.includes(allowed.toLowerCase()));
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

export function Sidebar({ user, onLogout, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  // Sidebar nav array uses English labels as the source; navLabel resolves
  // them to Thai/English at render time via src/locales/*/navigation.json.
  const tNav = useTranslations('navigation');

  // Filter navigation items based on user role
  const filteredNavigation = getFilteredNavigation(user?.role);

  // Initialize expanded items with parent of current route
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const parentName = findParentForPath(pathname, filteredNavigation);
    return parentName ? [parentName] : [];
  });

  // Auto-expand parent items when navigating to child routes
  // This effect synchronizes the expanded state with the current route
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
    if (parentItem && !expandedItems.includes(parentItem)) {
       
      setExpandedItems((prev) => [...prev, parentItem]);
    }
  }, [pathname, filteredNavigation, expandedItems]);

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isChildActive = (href: string) => {
    return pathname === href;
  };

  const toggleExpand = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
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
        <nav className="absolute inset-0 overflow-y-auto pt-4 md:pt-6 pb-16 px-2 md:px-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <div className="space-y-1">
          {filteredNavigation.map((item) => (
            <div key={item.name}>
              {item.children ? (
                // Parent with children
                <div>
                  <button
                    onClick={() => toggleExpand(item.name)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm font-medium',
                      'transition-all duration-200 ease-out',
                      'motion-reduce:transition-none',
                      'group',
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

                  {/* Submenu with smooth animation */}
                  <div
                    className={cn(
                      'overflow-hidden',
                      'transition-all duration-300 ease-out',
                      'motion-reduce:transition-none',
                      isExpanded(item.name)
                        ? 'max-h-96 opacity-100'
                        : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="mt-1 ml-3 md:ml-4 pl-3 md:pl-4 border-l border-slate-700/50 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={handleLinkClick}
                          className={cn(
                            'flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg text-sm',
                            'transition-all duration-200 ease-out',
                            'motion-reduce:transition-none',
                            isChildActive(child.href)
                              ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                          )}
                        >
                          {child.icon && (
                            <child.icon
                              className={cn(
                                'h-4 w-4',
                                isChildActive(child.href) && 'text-emerald-400'
                              )}
                            />
                          )}
                          <span>{navLabel(child.name, tNav)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Single item without children
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    'flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm font-medium',
                    'transition-all duration-200 ease-out',
                    'motion-reduce:transition-none',
                    'group',
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
        {/* Bottom fade — softens any partially-cut last visible item, hints
            that more content is below the scrollable area. */}
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
