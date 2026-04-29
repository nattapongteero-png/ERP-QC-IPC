'use client';

import { MainLayout } from '@/components/layout/main-layout';
import {
  FlaskConical,
  Package,
  Factory,
  AlertTriangle,
  TrendingUp,
  Activity,
  ShieldAlert,
  Clock,
  XCircle,
  Snowflake,
  Boxes,
  ArrowUpRight,
  ArrowRight,
  CircleDashed,
  Sparkles,
  Layers,
  Microscope,
  Beaker,
  Pill,
  ClipboardCheck,
  ChevronRight,
  Zap,
  Heart,
} from 'lucide-react';

// ===== Mock Data =====
const KPI_DATA = {
  totalItems: 1234,
  activeWO: 12,
  openDeviations: 3,
  expiringSoon: 8,
  quarantine: 5,
};

const WORK_ORDERS = [
  {
    id: 'WO-2026-0001',
    product: 'Fa Talai Jone Capsule 500mg',
    qty: '10,000 caps',
    progress: 78,
    status: 'in-progress',
    statusLabel: 'In Progress',
    line: 'Line A',
  },
  {
    id: 'WO-2026-0002',
    product: 'Andrographis Extract Tablet',
    qty: '5,000 tabs',
    progress: 45,
    status: 'in-progress',
    statusLabel: 'In Progress',
    line: 'Line B',
  },
  {
    id: 'WO-2026-0003',
    product: 'Turmeric Powder Sachet 3g',
    qty: '20,000 pcs',
    progress: 100,
    status: 'qc-pending',
    statusLabel: 'QC Pending',
    line: 'Line C',
  },
  {
    id: 'WO-2026-0004',
    product: 'Ginger Lozenge Pack',
    qty: '8,000 packs',
    progress: 12,
    status: 'released',
    statusLabel: 'Released',
    line: 'Line A',
  },
];

const WAREHOUSES = [
  { type: 'Raw', label: 'Raw Material', count: 384, value: '฿2.4M', icon: FlaskConical, accent: 'emerald' },
  { type: 'WIP', label: 'Work in Progress', count: 67, value: '฿890K', icon: Factory, accent: 'amber' },
  { type: 'Finished', label: 'Finished Goods', count: 512, value: '฿4.1M', icon: Package, accent: 'sky' },
  { type: 'Quarantine', label: 'Quarantine', count: 5, value: '฿120K', icon: ShieldAlert, accent: 'orange' },
  { type: 'Rejected', label: 'Rejected', count: 2, value: '฿45K', icon: XCircle, accent: 'rose' },
  { type: 'Cold', label: 'Cold Storage', count: 264, value: '฿1.8M', icon: Snowflake, accent: 'cyan' },
];

// ============================================================================
// STYLE A — STRIPE PREMIUM
// ============================================================================
function StyleA_StripePremium() {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white py-3 z-10 border-b border-slate-100">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Style A</div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">Stripe Premium</h2>
            <p className="text-sm text-slate-600 mt-1">Crisp white surfaces, generous spacing, single accent. Confident and editorial.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition">
            เลือก style นี้
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 lg:p-8">
          {/* Hero */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Inventory Dashboard</div>
              <h3 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Welcome back, Manoi</h3>
              <p className="text-slate-600 mt-1">5 items need your attention today.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition">
              New Receipt
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[
              { label: 'Total Items', value: KPI_DATA.totalItems.toLocaleString(), color: 'text-indigo-600', icon: Boxes, change: '+12%' },
              { label: 'Active WO', value: KPI_DATA.activeWO, color: 'text-emerald-600', icon: Factory, change: '+3' },
              { label: 'Open Deviations', value: KPI_DATA.openDeviations, color: 'text-rose-600', icon: AlertTriangle, change: '-1' },
              { label: 'Expiring Soon', value: KPI_DATA.expiringSoon, color: 'text-amber-600', icon: Clock, change: '+2' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white rounded-xl shadow-sm p-6 relative">
                  <Icon className="w-5 h-5 text-slate-300 absolute top-6 right-6" />
                  <div className="text-sm font-medium text-slate-500">{kpi.label}</div>
                  <div className={`text-3xl font-bold tracking-tight tabular-nums mt-2 ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="tabular-nums">{kpi.change}</span> from last week
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent WOs */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-base font-semibold tracking-tight text-slate-900">Recent Work Orders</h4>
              <a className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all</a>
            </div>
            <div className="divide-y divide-slate-100">
              {WORK_ORDERS.map((wo) => (
                <div key={wo.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-slate-900">{wo.id}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        wo.status === 'released' ? 'bg-emerald-100 text-emerald-700' :
                        wo.status === 'qc-pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {wo.statusLabel}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{wo.product}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900 tabular-nums">{wo.qty}</div>
                    <div className="text-xs text-slate-500 tabular-nums">{wo.progress}% complete</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouse cards */}
          <div>
            <h4 className="text-base font-semibold tracking-tight text-slate-900 mb-4">Inventory by Warehouse Type</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WAREHOUSES.map((wh) => {
                const Icon = wh.icon;
                return (
                  <div key={wh.type} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <Icon className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-mono text-slate-400 uppercase">{wh.type}</span>
                    </div>
                    <div className="text-2xl font-bold tracking-tight tabular-nums text-slate-900 mt-3">{wh.count}</div>
                    <div className="text-sm text-slate-600">{wh.label}</div>
                    <div className="text-xs text-slate-500 mt-2 tabular-nums">{wh.value} value</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STYLE B — LINEAR ELECTRIC
// ============================================================================
function StyleB_LinearElectric() {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white py-3 z-10 border-b border-slate-100">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Style B</div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">Linear Electric</h2>
            <p className="text-sm text-slate-600 mt-1">Dark slate, electric violet/cyan accents, monospace IDs. Cool and futuristic.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-4 py-2 text-sm font-mono font-semibold text-white shadow-lg shadow-violet-500/30 hover:bg-violet-400 transition">
            เลือก style นี้
            <Zap className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 lg:p-8 text-slate-100">
          {/* Hero */}
          <div className="bg-slate-800/50 ring-1 ring-violet-500/20 rounded-md p-5 mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-violet-400 uppercase tracking-wider">// Inventory.dashboard</div>
              <h3 className="text-2xl font-bold tracking-tight text-white mt-1">Production overview</h3>
              <p className="text-sm text-slate-400 mt-1 font-mono">5 alerts · 12 active processes</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3 py-1.5 text-sm font-mono font-semibold text-slate-900 hover:bg-cyan-300 transition">
              + new_receipt
            </button>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'TOTAL_ITEMS', value: KPI_DATA.totalItems.toLocaleString(), accent: 'violet', icon: Boxes },
              { label: 'ACTIVE_WO', value: KPI_DATA.activeWO, accent: 'cyan', icon: Factory },
              { label: 'OPEN_DEV', value: KPI_DATA.openDeviations, accent: 'fuchsia', icon: AlertTriangle },
              { label: 'EXPIRE_SOON', value: KPI_DATA.expiringSoon, accent: 'violet', icon: Clock },
            ].map((kpi) => {
              const Icon = kpi.icon;
              const accentColor =
                kpi.accent === 'violet' ? 'text-violet-400 ring-violet-500/30' :
                kpi.accent === 'cyan' ? 'text-cyan-400 ring-cyan-400/30' :
                'text-fuchsia-400 ring-fuchsia-500/30';
              return (
                <div key={kpi.label} className={`bg-slate-800/50 ring-1 ${accentColor} rounded-md p-4 relative`}>
                  <Icon className={`w-4 h-4 absolute top-3 right-3 ${accentColor.split(' ')[0]}`} />
                  <div className="text-[10px] font-mono text-slate-500 tracking-widest">{kpi.label}</div>
                  <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${accentColor.split(' ')[0]}`}>{kpi.value}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-2">↑ +12% w/w</div>
                </div>
              );
            })}
          </div>

          {/* Recent WOs */}
          <div className="bg-slate-800/50 ring-1 ring-slate-700 rounded-md overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h4 className="text-sm font-mono font-semibold text-slate-200">work_orders.recent</h4>
              <a className="text-xs font-mono text-cyan-400 hover:text-cyan-300">view_all →</a>
            </div>
            <div className="divide-y divide-slate-700/50">
              {WORK_ORDERS.map((wo) => (
                <div key={wo.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-violet-400">{wo.id}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono ring-1 ${
                        wo.status === 'released' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' :
                        wo.status === 'qc-pending' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/30' :
                        'bg-violet-500/10 text-violet-400 ring-violet-500/30'
                      }`}>
                        {wo.statusLabel.toLowerCase().replace(' ', '_')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">{wo.product}</div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-xs font-mono text-slate-300 tabular-nums">{wo.qty}</div>
                    <div className="text-[10px] font-mono text-cyan-400 tabular-nums">{wo.progress}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouse cards */}
          <div>
            <h4 className="text-sm font-mono font-semibold text-slate-300 mb-3">warehouses.by_type</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {WAREHOUSES.map((wh) => {
                const Icon = wh.icon;
                return (
                  <div key={wh.type} className="bg-slate-800/50 ring-1 ring-slate-700 rounded-md p-3 hover:ring-violet-500/40 transition">
                    <Icon className="w-4 h-4 text-violet-400 mb-2" />
                    <div className="text-[10px] font-mono text-slate-500 uppercase">{wh.type}</div>
                    <div className="text-lg font-mono font-bold text-white tabular-nums">{wh.count}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">{wh.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STYLE C — NOTION MINIMAL
// ============================================================================
function StyleC_NotionMinimal() {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white py-3 z-10 border-b border-slate-100">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Style C</div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">Notion Minimal</h2>
            <p className="text-sm text-slate-600 mt-1">Pure white, generous whitespace, minimal color. Calm and focused.</p>
          </div>
          <button className="inline-flex items-center gap-2 border border-slate-900 text-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-900 hover:text-white transition">
            เลือก style นี้
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-2xl p-8 lg:p-12 border border-slate-100">
          {/* Hero */}
          <div className="mb-12">
            <h3 className="text-4xl font-bold tracking-tight text-slate-900">Inventory</h3>
            <p className="text-slate-500 mt-2 text-lg">A quiet overview of what's in motion.</p>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {[
              { label: 'Total Items', value: KPI_DATA.totalItems.toLocaleString() },
              { label: 'Active Work Orders', value: KPI_DATA.activeWO },
              { label: 'Open Deviations', value: KPI_DATA.openDeviations },
              { label: 'Expiring Soon', value: KPI_DATA.expiringSoon },
            ].map((kpi) => (
              <div key={kpi.label}>
                <div className="text-sm text-slate-500">{kpi.label}</div>
                <div className="text-4xl font-bold tracking-tight tabular-nums text-slate-900 mt-2">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-8 mb-12">
            <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-6">Recent work orders</h4>
            <div>
              {WORK_ORDERS.map((wo) => (
                <div key={wo.id} className="py-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50/50 -mx-2 px-2 transition">
                  <div className="flex-1 flex items-center gap-4">
                    <span className={`w-2 h-2 rounded-full ${
                      wo.status === 'released' ? 'bg-emerald-500' :
                      wo.status === 'qc-pending' ? 'bg-amber-500' :
                      'bg-blue-500'
                    }`} />
                    <span className="text-sm text-slate-900 font-medium">{wo.id}</span>
                    <span className="text-sm text-slate-500">{wo.product}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-slate-500 tabular-nums">{wo.qty}</span>
                    <span className={`text-sm ${
                      wo.status === 'released' ? 'text-emerald-700' :
                      wo.status === 'qc-pending' ? 'text-amber-700' :
                      'text-blue-700'
                    }`}>
                      {wo.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouse cards */}
          <div className="border-t border-slate-100 pt-8">
            <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-6">Inventory by warehouse type</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
              {WAREHOUSES.map((wh) => (
                <div key={wh.type}>
                  <div className="text-xs uppercase tracking-wider text-slate-400">{wh.type}</div>
                  <div className="text-2xl font-bold tracking-tight tabular-nums text-slate-900 mt-1">{wh.count}</div>
                  <div className="text-xs text-slate-500 mt-1">{wh.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STYLE D — MATERIAL YOU BOLD
// ============================================================================
function StyleD_MaterialYouBold() {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white py-3 z-10 border-b border-slate-100">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Style D</div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">Material You Bold</h2>
            <p className="text-sm text-slate-600 mt-1">Expressive colors, very rounded surfaces, bold filled buttons. Playful and energetic.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-300 hover:bg-pink-700 transition">
            เลือก style นี้
            <Heart className="w-4 h-4 fill-current" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-pink-50 via-indigo-50 to-teal-50 rounded-3xl p-6 lg:p-8">
          {/* Hero */}
          <div className="bg-indigo-600 rounded-3xl p-8 mb-6 shadow-xl shadow-indigo-300/40 text-white relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-pink-500/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-teal-400/30 rounded-full blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Inventory Hub</div>
                <h3 className="text-3xl font-bold tracking-tight mt-2">Hello, Manoi! 🌿</h3>
                <p className="text-indigo-100 mt-1">Things are looking great today.</p>
              </div>
              <button className="rounded-full bg-white text-indigo-700 px-5 py-2.5 text-sm font-bold shadow-lg hover:scale-105 transition">
                + New Receipt
              </button>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Items', value: KPI_DATA.totalItems.toLocaleString(), bg: 'bg-indigo-500', icon: Boxes },
              { label: 'Active WO', value: KPI_DATA.activeWO, bg: 'bg-teal-500', icon: Factory },
              { label: 'Open Deviations', value: KPI_DATA.openDeviations, bg: 'bg-pink-500', icon: AlertTriangle },
              { label: 'Expiring Soon', value: KPI_DATA.expiringSoon, bg: 'bg-amber-500', icon: Clock },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className={`${kpi.bg} rounded-3xl p-6 shadow-lg shadow-slate-300/40 text-white relative overflow-hidden`}>
                  <Icon className="w-12 h-12 absolute -top-2 -right-2 text-white/20" />
                  <div className="text-sm font-bold uppercase tracking-wider opacity-90">{kpi.label}</div>
                  <div className="text-4xl font-bold tracking-tight tabular-nums mt-2">{kpi.value}</div>
                  <div className="text-xs mt-2 opacity-90">↑ +12% from last week</div>
                </div>
              );
            })}
          </div>

          {/* Recent WOs */}
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-300/40 overflow-hidden mb-6">
            <div className="px-6 py-4 bg-gradient-to-r from-pink-100 to-indigo-100 flex items-center justify-between">
              <h4 className="text-base font-bold tracking-tight text-slate-900">Recent Work Orders</h4>
              <button className="rounded-full bg-white px-3 py-1 text-xs font-bold text-pink-700 shadow-sm">View All</button>
            </div>
            <div>
              {WORK_ORDERS.map((wo) => (
                <div key={wo.id} className="px-6 py-4 flex items-center justify-between hover:bg-pink-50/50 transition border-b border-slate-100 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-900">{wo.id}</span>
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold ${
                        wo.status === 'released' ? 'bg-teal-500 text-white' :
                        wo.status === 'qc-pending' ? 'bg-amber-500 text-white' :
                        'bg-indigo-500 text-white'
                      }`}>
                        {wo.statusLabel}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{wo.product}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">{wo.qty}</div>
                    <div className="text-xs text-pink-600 font-bold tabular-nums">{wo.progress}% done</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouse cards */}
          <div>
            <h4 className="text-base font-bold tracking-tight text-slate-900 mb-4">Inventory by Warehouse</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WAREHOUSES.map((wh, i) => {
                const Icon = wh.icon;
                const palette = [
                  'bg-indigo-100 text-indigo-700',
                  'bg-pink-100 text-pink-700',
                  'bg-teal-100 text-teal-700',
                  'bg-amber-100 text-amber-700',
                  'bg-rose-100 text-rose-700',
                  'bg-cyan-100 text-cyan-700',
                ][i % 6];
                return (
                  <div key={wh.type} className={`${palette} rounded-3xl p-5 shadow-md shadow-slate-300/30 hover:scale-105 transition`}>
                    <div className="flex items-center justify-between">
                      <Icon className="w-6 h-6" />
                      <span className="text-xs font-bold uppercase tracking-wider">{wh.type}</span>
                    </div>
                    <div className="text-3xl font-bold tracking-tight tabular-nums mt-3">{wh.count}</div>
                    <div className="text-sm font-medium">{wh.label}</div>
                    <div className="text-xs mt-1 tabular-nums opacity-75">{wh.value} value</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STYLE E — PHARMA PRO (MEDICAL-GRADE)
// ============================================================================
function StyleE_PharmaPro() {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white py-3 z-10 border-b border-slate-100">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Style E</div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">Pharma Pro</h2>
            <p className="text-sm text-slate-600 mt-1">Clinical white, sky-600 accents, structured grids and clinical badges. Trustworthy and audit-ready.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md border-2 border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 hover:border-sky-700 transition">
            เลือก style นี้
            <ClipboardCheck className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-md p-6 lg:p-8 border-2 border-sky-100">
          {/* Hero */}
          <div className="border-l-4 border-sky-600 bg-sky-50 rounded-r-md p-5 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-md bg-sky-600 flex items-center justify-center">
                <Pill className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Pharmaceutical Inventory · GMP-Audit-Ready</div>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">Inventory Control System</h3>
                <p className="text-sm text-slate-600 mt-0.5">Last sync: 14:32 · 3 items pending QA review</p>
              </div>
            </div>
            <button className="rounded-md bg-white border-2 border-sky-600 text-sky-700 px-4 py-2 text-sm font-semibold hover:bg-sky-50 transition">
              + Goods Receipt
            </button>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total SKUs', value: KPI_DATA.totalItems.toLocaleString(), icon: Beaker, accent: 'sky' },
              { label: 'Active Batches', value: KPI_DATA.activeWO, icon: Factory, accent: 'emerald' },
              { label: 'Open Deviations', value: KPI_DATA.openDeviations, icon: AlertTriangle, accent: 'rose' },
              { label: 'Expiry Alerts', value: KPI_DATA.expiringSoon, icon: Clock, accent: 'amber' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              const colors =
                kpi.accent === 'sky' ? 'border-sky-200 bg-sky-50/50' :
                kpi.accent === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' :
                kpi.accent === 'rose' ? 'border-rose-200 bg-rose-50/50' :
                'border-amber-200 bg-amber-50/50';
              const iconColor =
                kpi.accent === 'sky' ? 'text-sky-600' :
                kpi.accent === 'emerald' ? 'text-emerald-600' :
                kpi.accent === 'rose' ? 'text-rose-600' :
                'text-amber-600';
              return (
                <div key={kpi.label} className={`bg-white rounded-md border-2 ${colors} p-4`}>
                  <div className="flex items-start justify-between mb-3 pb-2 border-b border-slate-200">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{kpi.label}</div>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Current</div>
                      <div className={`text-2xl font-bold tabular-nums ${iconColor}`}>{kpi.value}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Δ Week</div>
                      <div className="text-sm font-semibold text-slate-700 tabular-nums">+3.2%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent WOs (data table style) */}
          <div className="bg-white rounded-md border-2 border-slate-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-sky-50 border-b-2 border-sky-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Microscope className="w-4 h-4 text-sky-700" />
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Active Production Batches</h4>
              </div>
              <a className="text-xs font-semibold text-sky-700 hover:underline">View all →</a>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Batch No.</th>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Product</th>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Line</th>
                  <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Qty</th>
                  <th className="text-center px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Progress</th>
                  <th className="text-center px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {WORK_ORDERS.map((wo) => (
                  <tr key={wo.id} className="border-b border-slate-100 hover:bg-sky-50/30 transition">
                    <td className="px-4 py-2.5 text-sm font-mono font-semibold text-sky-700">{wo.id}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{wo.product}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{wo.line}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-slate-700 tabular-nums font-medium">{wo.qty}</td>
                    <td className="px-4 py-2.5 text-xs text-center text-slate-700 tabular-nums">{wo.progress}%</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${
                        wo.status === 'released' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' :
                        wo.status === 'qc-pending' ? 'border-amber-300 bg-amber-50 text-amber-800' :
                        'border-sky-300 bg-sky-50 text-sky-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          wo.status === 'released' ? 'bg-emerald-500' :
                          wo.status === 'qc-pending' ? 'bg-amber-500' :
                          'bg-sky-500'
                        }`} />
                        {wo.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warehouse cards */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-sky-700" />
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Warehouse Allocation</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {WAREHOUSES.map((wh) => {
                const Icon = wh.icon;
                return (
                  <div key={wh.type} className="bg-white rounded-md border-2 border-slate-200 p-3 hover:border-sky-400 transition">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                      <Icon className="w-4 h-4 text-sky-700" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{wh.type}</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 tabular-nums">{wh.count}</div>
                    <div className="text-[10px] text-slate-500 truncate">{wh.label}</div>
                    <div className="text-[10px] text-sky-700 font-semibold mt-1 tabular-nums">{wh.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// STYLE F — GLASSMORPHIC MODERN
// ============================================================================
function StyleF_Glassmorphic() {
  return (
    <section className="border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-white py-3 z-10 border-b border-slate-100">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">Style F</div>
            <h2 className="text-2xl font-bold mt-1 tracking-tight">Glassmorphic Modern</h2>
            <p className="text-sm text-slate-600 mt-1">Frosted glass cards over pastel gradients. Modern Apple/iOS 17 vibes — premium and soft.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl backdrop-blur-md bg-white/70 ring-1 ring-white/40 shadow-lg shadow-violet-200/50 px-5 py-2 text-sm font-semibold text-violet-700 hover:bg-white/80 transition">
            เลือก style นี้
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        <div className="relative rounded-3xl overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-violet-200 via-pink-100 to-cyan-200">
          {/* decorative blobs */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-pink-300/40 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-300/40 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/2 w-64 h-64 bg-cyan-300/30 rounded-full blur-3xl" />

          <div className="relative">
            {/* Hero */}
            <div className="backdrop-blur-md bg-white/60 ring-1 ring-white/40 rounded-2xl p-6 mb-6 flex items-center justify-between shadow-xl shadow-violet-200/30">
              <div>
                <div className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Inventory · Spring 2026</div>
                <h3 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Good afternoon ✨</h3>
                <p className="text-slate-700 mt-1">Everything is gently in flow today.</p>
              </div>
              <button className="rounded-2xl backdrop-blur-md bg-violet-500/90 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-300/50 hover:bg-violet-600 transition">
                + New Receipt
              </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Items', value: KPI_DATA.totalItems.toLocaleString(), icon: Boxes, tint: 'text-violet-700' },
                { label: 'Active WO', value: KPI_DATA.activeWO, icon: Factory, tint: 'text-cyan-700' },
                { label: 'Open Deviations', value: KPI_DATA.openDeviations, icon: AlertTriangle, tint: 'text-rose-700' },
                { label: 'Expiring Soon', value: KPI_DATA.expiringSoon, icon: Clock, tint: 'text-amber-700' },
              ].map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div key={kpi.label} className="backdrop-blur-md bg-white/70 ring-1 ring-white/50 rounded-2xl p-5 shadow-lg shadow-violet-200/20 relative">
                    <Icon className={`w-5 h-5 absolute top-5 right-5 ${kpi.tint} opacity-80`} />
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{kpi.label}</div>
                    <div className={`text-3xl font-bold tracking-tight tabular-nums mt-2 ${kpi.tint}`}>{kpi.value}</div>
                    <div className="text-xs text-slate-600 mt-2">↑ 12% this week</div>
                  </div>
                );
              })}
            </div>

            {/* Recent WOs */}
            <div className="backdrop-blur-md bg-white/70 ring-1 ring-white/50 rounded-2xl shadow-lg shadow-violet-200/20 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
                <h4 className="text-base font-bold tracking-tight text-slate-900">Recent Work Orders</h4>
                <a className="text-sm font-semibold text-violet-700 hover:text-violet-900">View all →</a>
              </div>
              <div className="divide-y divide-white/60">
                {WORK_ORDERS.map((wo) => (
                  <div key={wo.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/40 transition">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{wo.id}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium backdrop-blur ring-1 ${
                          wo.status === 'released' ? 'bg-emerald-200/60 text-emerald-800 ring-emerald-300/50' :
                          wo.status === 'qc-pending' ? 'bg-amber-200/60 text-amber-800 ring-amber-300/50' :
                          'bg-violet-200/60 text-violet-800 ring-violet-300/50'
                        }`}>
                          {wo.statusLabel}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 mt-0.5">{wo.product}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">{wo.qty}</div>
                      <div className="text-xs text-violet-700 tabular-nums">{wo.progress}% complete</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warehouse cards */}
            <div>
              <h4 className="text-base font-bold tracking-tight text-slate-900 mb-4">Inventory by Warehouse Type</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {WAREHOUSES.map((wh) => {
                  const Icon = wh.icon;
                  return (
                    <div key={wh.type} className="backdrop-blur-md bg-white/70 ring-1 ring-white/50 rounded-2xl p-5 shadow-lg shadow-violet-200/20 hover:bg-white/80 transition">
                      <div className="flex items-center justify-between">
                        <Icon className="w-5 h-5 text-violet-700" />
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{wh.type}</span>
                      </div>
                      <div className="text-3xl font-bold tracking-tight tabular-nums text-slate-900 mt-3">{wh.count}</div>
                      <div className="text-sm text-slate-700">{wh.label}</div>
                      <div className="text-xs text-violet-700 mt-2 tabular-nums font-medium">{wh.value} value</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function DesignsPreviewPage() {
  const styles = [
    { letter: 'A', name: 'Stripe Premium' },
    { letter: 'B', name: 'Linear Electric' },
    { letter: 'C', name: 'Notion Minimal' },
    { letter: 'D', name: 'Material You Bold' },
    { letter: 'E', name: 'Pharma Pro' },
    { letter: 'F', name: 'Glassmorphic Modern' },
  ];

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto -m-4 md:-m-4 lg:-m-6 bg-white">
        {/* Page hero */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 uppercase tracking-wider mb-3">
              <CircleDashed className="w-3.5 h-3.5" />
              Internal · Design Preview
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">Design System Showcase</h1>
            <p className="mt-3 text-lg text-slate-600 max-w-3xl">
              เลือก style ที่ชอบ ผมจะ apply ทั้ง 6 หน้า inventory + dashboard
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {styles.map((s) => (
                <a
                  key={s.letter}
                  href={`#style-${s.letter.toLowerCase()}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition"
                >
                  <span className="font-mono text-emerald-700">{s.letter}</span>
                  <span>{s.name}</span>
                  <ChevronRight className="w-3 h-3" />
                </a>
              ))}
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <Activity className="w-3.5 h-3.5" />
              ข้อมูลในหน้านี้เป็น mock data ทั้งหมด · ไม่ได้ดึงจาก database จริง
            </div>
          </div>
        </div>

        <div id="style-a"><StyleA_StripePremium /></div>
        <div id="style-b"><StyleB_LinearElectric /></div>
        <div id="style-c"><StyleC_NotionMinimal /></div>
        <div id="style-d"><StyleD_MaterialYouBold /></div>
        <div id="style-e"><StyleE_PharmaPro /></div>
        <div id="style-f"><StyleF_Glassmorphic /></div>

        {/* Footer prompt */}
        <div className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <Sparkles className="w-6 h-6 text-emerald-600 mx-auto" />
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-3">เลือก style ไหนดี?</h3>
            <p className="text-slate-600 mt-2">
              บอกตัวอักษร (A–F) ของ style ที่ชอบมาได้เลย ผมจะ apply ให้ทั้ง 6 หน้า inventory + dashboard
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {styles.map((s) => (
                <span
                  key={s.letter}
                  className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2 text-sm"
                >
                  <span className="font-mono font-bold text-emerald-700">{s.letter}</span>
                  <span className="text-slate-700">{s.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
