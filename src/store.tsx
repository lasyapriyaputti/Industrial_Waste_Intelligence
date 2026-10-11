import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Facility, PageId, Session, WasteEntry } from '@/types';
import { generateSeed, CLUSTERS, OFFICER } from '@/lib/seed';
import { computeClusters, type ClusterResult, REPORT_YEAR } from '@/lib/analysis';

const DATA_KEY = 'iwi-data-v2';
const SESSION_KEY = 'iwi-session-v2';

function loadData(): AppData {
  try { const raw = localStorage.getItem(DATA_KEY); if (raw) return JSON.parse(raw) as AppData; } catch { /* ignore */ }
  const d = generateSeed(); try { localStorage.setItem(DATA_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}
function loadSession(): Session | null {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}
export interface Focus { lat: number; lng: number; zoom: number; select?: { type: 'factory' | 'facility' | 'cluster'; id: string } }

interface Ctx {
  data: AppData; session: Session | null; clusters: ClusterResult[]; radius: number; setRadius: (r: number) => void;
  page: PageId; nav: (p: PageId, focus?: Focus) => void; pendingFocus: Focus | null; clearFocus: () => void;
  login: (id: string, code: string) => string | null; logout: () => void;
  submitReport: (factoryId: string, year: number, entries: WasteEntry[]) => void;
  updateFacility: (id: string, patch: Partial<Facility>) => void;
  sendRequest: (factoryId: string, facilityId: string, wasteType: WasteEntry['wasteType'], qty: number, dist: number) => void;
  respondRequest: (id: string, status: 'accepted' | 'rejected') => void;
  reset: () => void; toast: string | null; showToast: (m: string) => void;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function firstPage(role: Session['role']): PageId { return role === 'officer' ? 'overview' : role === 'factory' ? 'f-dashboard' : 'w-profile'; }

export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [radius, setRadius] = useState(75);
  const [page, setPage] = useState<PageId>(() => { const s = loadSession(); return s ? firstPage(s.role) : 'overview'; });
  const [pendingFocus, setPendingFocus] = useState<Focus | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const persist = useCallback((updater: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Live sync: another tab (e.g. the factory tab) changing data updates this tab (e.g. the officer map).
  useEffect(() => {
    const h = (e: StorageEvent) => { if (e.key === DATA_KEY && e.newValue) { try { setData(JSON.parse(e.newValue) as AppData); } catch { /* ignore */ } } };
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const clusters = useMemo(() => computeClusters(data.factories, data.facilities, CLUSTERS, radius), [data, radius]);

  const value: Ctx = {
    data, session, clusters, radius, setRadius, page, pendingFocus, toast, showToast: setToast,
    nav: (p, focus) => { setPage(p); if (focus) setPendingFocus(focus); },
    clearFocus: () => setPendingFocus(null),
    login: (id, code) => {
      const i = id.trim().toUpperCase(), c = code.trim();
      let s: Session | null = null;
      if (i === OFFICER.id && c === OFFICER.code) s = { role: 'officer', id: i };
      else { const f = data.factories.find((x) => x.id === i); const w = data.facilities.find((x) => x.id === i);
        if (f && f.accessCode === c.toUpperCase()) s = { role: 'factory', id: f.id };
        else if (w && w.accessCode === c.toUpperCase()) s = { role: 'facility', id: w.id }; }
      if (!s) return 'Invalid ID or access code.';
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); setSession(s); setPage(firstPage(s.role)); return null;
    },
    logout: () => { sessionStorage.removeItem(SESSION_KEY); setSession(null); },
    submitReport: (factoryId, year, entries) => persist((d) => ({
      ...d, version: d.version + 1, lastReport: { factoryId, at: Date.now() },
      factories: d.factories.map((f) => f.id !== factoryId ? f : { ...f, reportStatus: 'reported', lastReportYear: year,
        reports: [...f.reports.filter((r) => r.year !== year), { year, entries, submittedAt: new Date().toISOString().slice(0, 10) }] }),
    })),
    updateFacility: (id, patch) => persist((d) => ({ ...d, version: d.version + 1, facilities: d.facilities.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    sendRequest: (factoryId, facilityId, wasteType, quantityTpa, distanceKm) => persist((d) => ({
      ...d, requests: [...d.requests, { id: `REQ-${String(d.requests.length + 1).padStart(4, '0')}`, factoryId, facilityId, wasteType, quantityTpa, distanceKm, status: 'pending', createdAt: new Date().toISOString() }],
    })),
    respondRequest: (id, status) => persist((d) => {
      const rq = d.requests.find((r) => r.id === id); if (!rq) return d;
      return { ...d, version: d.version + 1,
        requests: d.requests.map((r) => (r.id === id ? { ...r, status } : r)),
        facilities: status === 'accepted' ? d.facilities.map((f) => f.id === rq.facilityId ? { ...f, utilizationPct: Math.min(100, Math.round((f.utilizationPct + (rq.quantityTpa / f.capacityTpa) * 100) * 10) / 10) } : f) : d.facilities,
        factories: status === 'accepted' ? d.factories.map((f) => (f.id === rq.factoryId ? { ...f, linkedFacilityId: rq.facilityId } : f)) : d.factories };
    }),
    reset: () => { const d = generateSeed(); try { localStorage.setItem(DATA_KEY, JSON.stringify(d)); } catch { /* ignore */ } setData(d); },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
export { REPORT_YEAR };
