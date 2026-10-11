import { LayoutDashboard, Factory, Recycle, AlertTriangle, Settings, FileText, LogOut, Leaf, Target, Gauge, Search, Inbox, Building2, ClipboardList, Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PageId, Role } from '@/types';
import { useApp } from '@/store';

const NAV: Record<Role, { id: PageId; label: string; icon: typeof Factory }[]> = {
  officer: [
    { id: 'overview', label: 'Overview & Map', icon: LayoutDashboard }, { id: 'gap', label: 'Gap Analysis', icon: Gauge },
    { id: 'scenario', label: 'Add-a-Facility Scenario', icon: Target }, { id: 'compliance', label: 'Compliance', icon: ClipboardList },
    { id: 'facilities', label: 'Facilities', icon: Recycle }, { id: 'alerts', label: 'Alerts', icon: AlertTriangle }, { id: 'settings', label: 'Settings', icon: Settings }],
  factory: [
    { id: 'f-dashboard', label: 'My Factory', icon: Factory }, { id: 'f-report', label: 'Submit Annual Report', icon: FileText },
    { id: 'f-find', label: 'Find Facilities', icon: Search }, { id: 'settings', label: 'Settings', icon: Settings }],
  facility: [
    { id: 'w-profile', label: 'Profile & Capacity', icon: Building2 }, { id: 'w-requests', label: 'Incoming Requests', icon: Inbox }, { id: 'settings', label: 'Settings', icon: Settings }],
};
const ROLE_LABEL: Record<Role, string> = { officer: 'Government Officer', factory: 'Factory', facility: 'Waste Facility' };

export default function Shell({ children }: { children: ReactNode }) {
  const { session, page, nav, logout, data, toast } = useApp();
  if (!session) return null;
  const who = session.role === 'officer' ? 'APPCB Regional Officer' : session.role === 'factory' ? data.factories.find((f) => f.id === session.id)?.name : data.facilities.find((f) => f.id === session.id)?.name;
  const pending = session.role === 'facility' ? data.requests.filter((r) => r.facilityId === session.id && r.status === 'pending').length : 0;
  return (
    <div className="h-full flex bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center"><Leaf size={22} color="#fff" /></div>
          <div><p className="text-sm font-bold text-gray-900 leading-tight">INDUSTRIAL WASTE</p><p className="text-sm font-bold text-gray-900 leading-tight">INTELLIGENCE</p></div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV[session.role].map((n) => { const I = n.icon; const on = page === n.id; return (
            <button key={n.id} onClick={() => nav(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${on ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <I size={17} /> <span className="flex-1 text-left">{n.label}</span>
              {n.id === 'w-requests' && pending > 0 && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{pending}</span>}
            </button>); })}
        </nav>
        <div className="p-4 border-t border-gray-100 text-[11px] text-gray-400">Andhra Pradesh prototype · simulated data</div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div><h1 className="text-base font-bold text-gray-900">Industrial Waste Intelligence</h1><p className="text-xs text-gray-500">Monitor · Estimate · Match · Plan</p></div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">Simulated data — pending APPCB integration</span>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center"><Shield size={17} className="text-brand-700" /></div>
              <div className="hidden md:block"><p className="text-sm font-medium text-gray-800 max-w-[220px] truncate">{who}</p><p className="text-xs text-gray-400">{ROLE_LABEL[session.role]} · {session.id}</p></div>
              <button onClick={logout} title="Log out" className="ml-2 p-2 rounded-lg text-gray-500 hover:bg-gray-100"><LogOut size={17} /></button>
            </div>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-2xl iwi-slide z-[2000]">{toast}</div>}
    </div>
  );
}
