'use client';

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
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { name: string; href: string; icon?: React.ComponentType<{ className?: string }> }[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    children: [
      { name: 'Items', href: '/inventory/items', icon: Boxes },
      { name: 'Lots', href: '/inventory/lots', icon: Package },
      { name: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse },
      { name: 'Transactions', href: '/inventory/transactions', icon: ArrowLeftRight },
      { name: 'Expiry Alerts', href: '/inventory/expiry-alerts', icon: AlertTriangle },
    ],
  },
  {
    name: 'Production',
    href: '/production',
    icon: Factory,
    children: [
      { name: 'Work Orders', href: '/production/work-orders', icon: ClipboardList },
      { name: 'BOM/Recipes', href: '/production/bom', icon: FileText },
      { name: 'Batch Records', href: '/production/batch-records', icon: FileText },
    ],
  },
  {
    name: 'Quality',
    href: '/quality',
    icon: ClipboardCheck,
    children: [
      { name: 'Tests', href: '/quality/tests', icon: TestTube },
      { name: 'Specifications', href: '/quality/specs', icon: FileText },
      { name: 'Deviations', href: '/quality/deviations', icon: AlertCircle },
    ],
  },
  {
    name: 'Purchasing',
    href: '/purchasing',
    icon: ShoppingCart,
    children: [
      { name: 'Purchase Orders', href: '/purchasing/orders', icon: Receipt },
      { name: 'Vendors', href: '/purchasing/vendors', icon: Truck },
    ],
  },
  {
    name: 'Sales',
    href: '/sales',
    icon: Truck,
    children: [
      { name: 'Sales Orders', href: '/sales/orders', icon: ShoppingBag },
      { name: 'Customers', href: '/sales/customers', icon: UserCheck },
    ],
  },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    role: string;
  };
  onLogout?: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isChildActive = (href: string) => {
    return pathname === href;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-64">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800">
        <Package className="h-8 w-8 text-emerald-500" />
        <span className="ml-2 text-lg font-bold">Herbal ERP</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link
                href={item.children ? item.children[0].href : item.href}
                className={`
                  flex items-center px-3 py-2 rounded-lg text-sm font-medium
                  ${isActive(item.href)
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
              {item.children && isActive(item.href) && (
                <ul className="mt-1 ml-4 space-y-1">
                  {item.children.map((child) => (
                    <li key={child.name}>
                      <Link
                        href={child.href}
                        className={`
                          flex items-center px-3 py-1.5 rounded-lg text-sm
                          ${isChildActive(child.href)
                            ? 'text-emerald-400 bg-gray-800'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }
                        `}
                      >
                        {child.icon && <child.icon className="h-4 w-4 mr-2" />}
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User info */}
      {user && (
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.role}</p>
            </div>
            <button
              onClick={onLogout}
              className="ml-2 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
