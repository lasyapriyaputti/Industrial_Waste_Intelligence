import { useEffect, useMemo, useState } from 'react';
import { Factory as FactoryIcon, Recycle, Percent, ShieldAlert, Gauge, AlertTriangle, Play, Search, ChevronRight, Download, Send } from 'lucide-react';
import { useApp } from '@/store';
import MapView, { BASEMAPS, type BaseKey, type Selection } from '@/components/MapView';
import EntityDrawer from '@/components/EntityDrawer';
import { Badge, Bar, Card, Kpi, PageHeader, StatusBadge, downloadCsv, fmt, statusColor } from '@/components/ui';
import { CLUSTERS, FACILITY_LABEL } from '@/lib/seed';
import { INDUSTRY_LABEL, PRIORITY_TYPES, WASTE_LABEL, WASTE_TYPES, authState, availableTpa, buildAlerts, computeClusters, computeKpis, daysToExpiry, effectiveEntries, priorityScore, statusOf } from '@/lib/analysis';
import type { Facility, Industry, WasteType } from '@/types';

type FocusState = { lat: number; lng: number; zoom: number; key: number };
const STORY = [
  { cap: 'Every faded, dashed marker is a factory with no report on file — its waste is only an estimate. Solid green = reported.', lat: 15.9, lng: 79.7, zoom: 7 },
  { cap: 'Parawada Pharma City: a red infrastructure gap. Incinerable pharma waste has no authorized facility within reach, and almost none of its data is reported.', lat: 17.6, lng: 83.07, zoom: 10, sel: { type: 'cluster', id: 'PW' } },
  { cap: 'A factory here (AP-F-001) has never filed. Log in as that factory (code DEMO01) in another tab and submit a report…', lat: 17.6, lng: 83.07, zoom: 12, sel: { type: 'factory', id: 'AP-F-001' } },
  { cap: '…and watch this map: the marker turns solid, the cluster score recalculates and data confidence rises — live.', lat: 17.6, lng: 83.07, zoom: 10, sel: { type: 'cluster', id: 'PW' } },
] as const;

export function Overview() {
  const { data, clusters, radius, setRadius, pendingFocus, clearFocus } = useApp();
  const [sel, setSel] = useState<Selection>(null);
  const [base, setBase] = useState<BaseKey>('light');
  const [layers, setLayers] = useState({ factories: true, facilities: true, zones: true });
  const [fStatus, setFStatus] = useState('all'); const [fInd, setFInd] = useState('all'); const [fDist, setFDist] = useState('all'); const [fWaste, setFWaste] = useState('all');
  const [focus, setFocus] = useState<FocusState | undefined>();
  const [story, setStory] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const kpis = computeKpis(data.factories, data.facilities, clusters);
  const cm = useMemo(() => new Map(clusters.map((c) => [c.cluster.id, c])), [clusters]);

  useEffect(() => { if (pendingFocus) { setFocus({ ...pendingFocus, key: Date.now() }); if (pendingFocus.select) setSel(pendingFocus.select); clearFocus(); } }, [pendingFocus]); // eslint-disable-line
  useEffect(() => { if (data.lastReport) { setFlash(data.lastReport.factoryId); const t = setTimeout(() => setFlash(null), 6000); return () => clearTimeout(t); } }, [data.lastReport?.at]); // eslint-disable-line

  const factories = data.factories.filter((f) => (fStatus === 'all' || (fStatus === 'reported' ? f.reportStatus === 'reported' : f.reportStatus !== 'reported')) &&
    (fInd === 'all' || f.industry === fInd) && (fDist === 'all' || f.district === fDist) && (fWaste === 'all' || effectiveEntries(f).some((e) => e.wasteType === fWaste)));
  const urgent = useMemo(() => new Set(data.factories.filter((f) => f.reportStatus !== 'reported' && priorityScore(f, cm.get(f.clusterId)).score >= 60).map((f) => f.id)), [data.factories, cm]);
  const districts = [...new Set(CLUSTERS.map((c) => c.district))];

  const go = (lat: number, lng: number, zoom: number) => setFocus({ lat, lng, zoom, key: Date.now() });
  const runStory = (i: number | null) => { setStory(i); if (i === null) return; const s = STORY[i]; go(s.lat, s.lng, s.zoom); setSel('sel' in s ? (s.sel as Selection) : null); };
  const search = () => {
    const t = q.trim().toLowerCase(); if (!t) return;
    const f = data.factories.find((x) => x.id.toLowerCase() === t || x.name.toLowerCase().includes(t)); if (f) { go(f.lat, f.lng, 13); setSel({ type: 'factory', id: f.id }); return; }
    const w = data.facilities.find((x) => x.id.toLowerCase() === t || x.name.toLowerCase().includes(t)); if (w) { go(w.lat, w.lng, 12); setSel({ type: 'facility', id: w.id }); }
  };
  const sk = 'px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white outline-none';

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Overview & Map" sub="Statewide view of reporting, estimated waste and treatment coverage. Faded markers are estimates — they turn solid when a factory reports." />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Factories in registry" value={kpis.factories} icon={<FactoryIcon size={18} />} />
        <Kpi label="Filed annual report" value={`${kpis.reportedPct}%`} sub={`${kpis.followUps} need follow-up`} icon={<Percent size={18} />} tone={kpis.reportedPct < 50 ? 'amber' : 'green'} />
        <Kpi label="Waste data is estimated" value={`${kpis.estimatedPct}%`} sub={`${kpis.confidencePct}% data confidence`} icon={<Gauge size={18} />} tone="amber" />
        <Kpi label="Red coverage clusters" value={kpis.redClusters} sub={`of ${clusters.length} clusters`} icon={<ShieldAlert size={18} />} tone="red" />
        <Kpi label="Facilities ≥90% full" value={kpis.nearCapacity} sub={`${data.facilities.length} authorized facilities`} icon={<Recycle size={18} />} tone="blue" />
        <Kpi label="Authorizations at risk" value={kpis.expiring} sub="expiring ≤30 days / expired" icon={<AlertTriangle size={18} />} tone="amber" />
      </div>
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={13} className="absolute left-2.5 top-2 text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search factory / facility…" className={`${sk} pl-8 w-48`} /></div>
        <select className={sk} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All reporting</option><option value="reported">Reported</option><option value="est">Estimated only</option></select>
        <select className={sk} value={fInd} onChange={(e) => setFInd(e.target.value)}><option value="all">All industries</option>{(Object.keys(INDUSTRY_LABEL) as Industry[]).map((i) => <option key={i} value={i}>{INDUSTRY_LABEL[i]}</option>)}</select>
        <select className={sk} value={fDist} onChange={(e) => setFDist(e.target.value)}><option value="all">All districts</option>{districts.map((d) => <option key={d}>{d}</option>)}</select>
        <select className={sk} value={fWaste} onChange={(e) => setFWaste(e.target.value)}><option value="all">All waste types</option>{WASTE_TYPES.map((w) => <option key={w} value={w}>{WASTE_LABEL[w]}</option>)}</select>
        <label className="flex items-center gap-2 text-xs text-gray-600 ml-1">Radius <input type="range" min={25} max={250} step={5} value={radius} onChange={(e) => setRadius(+e.target.value)} /> <b>{radius} km</b></label>
        <div className="flex gap-1 ml-auto">{(['factories', 'facilities', 'zones'] as const).map((k) => <button key={k} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} className={`px-2.5 py-1.5 text-xs rounded-lg border capitalize ${layers[k] ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-500 border-gray-200'}`}>{k}</button>)}</div>
        <select className={sk} value={base} onChange={(e) => setBase(e.target.value as BaseKey)}>{(Object.keys(BASEMAPS) as BaseKey[]).map((b) => <option key={b} value={b}>{BASEMAPS[b].name}</option>)}</select>
        <button onClick={() => runStory(story === null ? 0 : null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white"><Play size={12} />{story === null ? 'Story mode' : 'Exit story'}</button>
      </Card>
      <Card className="relative overflow-hidden" >
        <div style={{ height: 560 }} className="relative">
          <MapView factories={factories} facilities={data.facilities} clusters={clusters} urgentIds={urgent} layers={layers} selected={sel} onSelect={setSel}
            focus={focus} radiusKm={radius} flashId={flash} base={base} />
          {sel && <EntityDrawer sel={sel} onClose={() => setSel(null)} />}
          <div className="absolute bottom-4 left-4 glass rounded-xl border border-gray-200 p-3 text-[11px] z-[1000] space-y-1">
            <p className="font-semibold text-gray-700 mb-1">Legend</p>
            <p className="flex items-center gap-2"><span className="iwi-f iwi-f--reported inline-block" style={{ transform: 'none' }} /> Reported (actual data)</p>
            <p className="flex items-center gap-2"><span className="iwi-f iwi-f--estimated inline-block" /> Estimated (no report)</p>
            <p className="flex items-center gap-2"><span className="iwi-f iwi-f--urgent inline-block" /> Estimated · high inspection priority</p>
            <p className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-blue-800" /> Facility (ring = utilisation)</p>
            <p className="flex items-center gap-2">Zones: <span style={{ color: statusColor.green }}>●</span> ≥80% <span style={{ color: statusColor.amber }}>●</span> 40–79% <span style={{ color: statusColor.red }}>●</span> &lt;40%</p>
          </div>
          {story !== null && (
            <div className="absolute top-3 left-3 max-w-md glass rounded-xl border border-violet-200 shadow-xl p-4 z-[1000]">
              <p className="text-[11px] font-semibold text-violet-600 mb-1">STORY · step {story + 1} of {STORY.length}</p>
              <p className="text-sm text-gray-800">{STORY[story].cap}</p>
              <div className="flex gap-2 mt-3"><button disabled={story === 0} onClick={() => runStory(story - 1)} className="px-3 py-1 text-xs rounded-lg border disabled:opacity-40">Back</button>
                <button onClick={() => (story + 1 < STORY.length ? runStory(story + 1) : runStory(null))} className="px-3 py-1 text-xs rounded-lg bg-violet-600 text-white">{story + 1 < STORY.length ? 'Next' : 'Finish'}</button></div>
            </div>)}
        </div>
      </Card>
    </div>
  );
}

export function GapAnalysis() {
  const { clusters, radius, setRadius, nav } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...clusters].sort((a, b) => a.score - b.score);
  const cnt = (s: string) => clusters.filter((c) => c.status === s).length;
  const maxT = Math.max(...clusters.map((c) => c.reportedTpa + c.estimatedTpa), 1);
  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Infrastructure Gap Analysis" sub="For each industrial cluster we compare the waste generated (reported where available, estimated otherwise) with the spare capacity of authorized facilities within the radius. A facility's spare capacity is shared between all clusters in reach, in proportion to demand." />
      <div className="grid md:grid-cols-4 gap-3">
        {(['red', 'amber', 'green'] as const).map((s) => <Card key={s} className="p-4"><p className="text-3xl font-bold" style={{ color: statusColor[s] }}>{cnt(s)}</p><p className="text-xs text-gray-500 mt-1">{s === 'red' ? 'Critical gap (<40%)' : s === 'amber' ? 'Partial coverage (40–79%)' : 'Adequately covered (≥80%)'}</p></Card>)}
        <Card className="p-4"><p className="text-xs font-semibold text-gray-600 mb-2">Facility reach radius: {radius} km</p><input type="range" min={25} max={250} step={5} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-full" /><p className="text-[11px] text-gray-400 mt-1">Longer reach = more facilities count.</p></Card>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>
          <th className="text-left p-3">Cluster</th><th className="p-3">Factories</th><th className="p-3 text-left w-56">Waste: reported vs estimated</th><th className="p-3 text-left">Weakest priority stream</th><th className="p-3 text-left w-48">Coverage score</th><th className="p-3" /></tr></thead>
          <tbody>{sorted.map((c) => (<>
            <tr key={c.cluster.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(open === c.cluster.id ? null : c.cluster.id)}>
              <td className="p-3"><b>{c.cluster.name}</b><p className="text-[11px] text-gray-400">{c.cluster.district}</p></td>
              <td className="p-3 text-center">{c.reportedCount}/{c.factoriesCount}</td>
              <td className="p-3"><div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100" style={{ width: `${((c.reportedTpa + c.estimatedTpa) / maxT) * 100}%`, minWidth: 30 }}><div style={{ width: `${c.confidencePct}%`, background: '#059669' }} /><div style={{ flex: 1, background: '#f59e0b' }} /></div>
                <p className="text-[11px] text-gray-500 mt-1">{fmt(c.reportedTpa + c.estimatedTpa)} t/yr · {c.confidencePct}% reported</p></td>
              <td className="p-3 text-xs">{c.weakest ? <>{WASTE_LABEL[c.weakest]} <b>{Math.round(c.coverage[c.weakest] ?? 0)}%</b></> : '—'}</td>
              <td className="p-3"><div className="flex items-center gap-2"><div className="flex-1"><Bar value={c.score} color={statusColor[c.status]} /></div><b style={{ color: statusColor[c.status] }}>{c.score}%</b></div></td>
              <td className="p-3"><ChevronRight size={15} className={`transition ${open === c.cluster.id ? 'rotate-90' : ''}`} /></td></tr>
            {open === c.cluster.id && <tr key={c.cluster.id + 'd'} className="bg-gray-50/60"><td colSpan={6} className="p-4">
              <div className="grid md:grid-cols-3 gap-x-8 gap-y-3">{(Object.keys(c.demand) as WasteType[]).map((w) => { const cv = c.coverage[w] ?? 0; return (
                <div key={w}><div className="flex justify-between text-xs"><span>{WASTE_LABEL[w]}{PRIORITY_TYPES.has(w) && <span className="text-red-500"> ★</span>}</span><b>{Math.round(cv)}%</b></div><Bar height={6} value={cv} color={statusColor[statusOf(cv)]} />
                  <p className="text-[11px] text-gray-500">demand {fmt(c.demand[w] ?? 0)} t/yr · supply {fmt(c.supply[w] ?? 0)} t/yr</p></div>); })}</div>
              <button onClick={() => nav('overview', { lat: c.cluster.lat, lng: c.cluster.lng, zoom: 10, select: { type: 'cluster', id: c.cluster.id } })} className="mt-3 text-xs font-semibold text-brand-700">Show on map →</button>
              <span className="text-[11px] text-gray-400 ml-4">★ = hazardous / e-waste, weighted 5× in the score</span></td></tr>}
          </>))}</tbody></table>
      </Card>
    </div>
  );
}

const PRESETS: Record<string, { label: string; accepted: WasteType[]; cap: number }> = {
  incin: { label: 'Hazardous TSDF + incinerator', accepted: ['haz_incinerable', 'haz_chemical', 'metallic_sludge'], cap: 15000 },
  ewaste: { label: 'E-waste recycler', accepted: ['e_waste', 'plastic'], cap: 6000 },
  coproc: { label: 'Co-processing unit', accepted: ['general_solid', 'plastic', 'organic', 'fly_ash'], cap: 20000 },
};
export function Scenario() {
  const { data, clusters, radius, setRadius } = useApp();
  const [ghost, setGhost] = useState<{ lat: number; lng: number } | null>(null);
  const [preset, setPreset] = useState('incin'); const [accepted, setAccepted] = useState<WasteType[]>(PRESETS.incin.accepted); const [cap, setCap] = useState(PRESETS.incin.cap);
  const [focus, setFocus] = useState<FocusState | undefined>();
  const choose = (k: string) => { setPreset(k); setAccepted(PRESETS[k].accepted); setCap(PRESETS[k].cap); };
  const after = useMemo(() => {
    if (!ghost) return null;
    const fc: Facility = { id: 'SCENARIO', name: 'Proposed facility', type: 'tsdf_incinerator', lat: ghost.lat, lng: ghost.lng, district: '', accepted, capacityTpa: cap, utilizationPct: 0, authValidTill: '2099-01-01', contact: '', accessCode: '', source: 'simulated' };
    return computeClusters(data.factories, [...data.facilities, fc], CLUSTERS, radius);
  }, [ghost, accepted, cap, radius, data]);
  const rows = after ? clusters.map((b, i) => ({ b, a: after[i] })).filter((r) => r.a.score !== r.b.score).sort((x, y) => y.a.score - y.b.score - (x.b.score - x.a.score)) : [];
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Add-a-Facility Scenario" sub="Click anywhere on the map to place a proposed facility and see how coverage changes — before committing to the investment." />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card className="p-4 space-y-3 text-sm">
            <p className="font-semibold">1. Facility type</p>
            <div className="flex flex-wrap gap-2">{Object.entries(PRESETS).map(([k, v]) => <button key={k} onClick={() => choose(k)} className={`px-3 py-1.5 rounded-lg border text-xs ${preset === k ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200'}`}>{v.label}</button>)}</div>
            <p className="font-semibold pt-1">2. Accepted waste</p>
            <div className="flex flex-wrap gap-1.5">{WASTE_TYPES.map((w) => <button key={w} onClick={() => setAccepted(accepted.includes(w) ? accepted.filter((x) => x !== w) : [...accepted, w])} className={`px-2 py-1 rounded-full text-[11px] border ${accepted.includes(w) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-400'}`}>{WASTE_LABEL[w]}</button>)}</div>
            <p className="font-semibold pt-1">3. Capacity: {fmt(cap)} t/yr</p><input type="range" min={1000} max={50000} step={1000} value={cap} onChange={(e) => setCap(+e.target.value)} className="w-full" />
            <p className="text-xs text-gray-600">Reach radius: <b>{radius} km</b></p><input type="range" min={25} max={250} step={5} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-full" />
            <p className="font-semibold pt-1">4. Place it</p>
            <div className="flex gap-2"><button onClick={() => { choose('incin'); setGhost({ lat: 17.62, lng: 83.0 }); setFocus({ lat: 17.62, lng: 83.0, zoom: 9, key: Date.now() }); }} className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white">Try Parawada</button>
              <button onClick={() => { choose('ewaste'); setGhost({ lat: 14.68, lng: 77.62 }); setFocus({ lat: 14.68, lng: 77.62, zoom: 9, key: Date.now() }); }} className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white">Try Anantapur</button></div>
          </Card>
          <Card className="p-4"><p className="font-semibold text-sm mb-3">Impact on coverage</p>
            {!ghost && <p className="text-xs text-gray-400">Click the map to place a facility.</p>}
            {ghost && rows.length === 0 && <p className="text-xs text-amber-700">No cluster is in reach of this location for the selected waste types.</p>}
            {rows.map(({ b, a }) => <div key={b.cluster.id} className="mb-3"><div className="flex justify-between text-xs"><b>{b.cluster.name}</b><span><span className="text-gray-400">{b.score}%</span> → <b style={{ color: statusColor[a.status] }}>{a.score}%</b></span></div><Bar value={a.score} color={statusColor[a.status]} /></div>)}</Card>
        </div>
        <Card className="lg:col-span-2 overflow-hidden"><div style={{ height: 640 }}><MapView factories={data.factories} facilities={data.facilities} clusters={after ?? clusters} onMapClick={(lat, lng) => setGhost({ lat, lng })} ghost={ghost} radiusKm={radius} focus={focus} /></div></Card>
      </div>
    </div>
  );
}

export function Compliance() {
  const { data, clusters, showToast, nav } = useApp();
  const [st, setSt] = useState('pending'); const [dist, setDist] = useState('all'); const [sent, setSent] = useState<Set<string>>(new Set());
  const cm = new Map(clusters.map((c) => [c.cluster.id, c]));
  const rows = data.factories.filter((f) => (st === 'all' || (st === 'pending' ? f.reportStatus !== 'reported' : f.reportStatus === st)) && (dist === 'all' || f.district === dist))
    .map((f) => ({ f, p: priorityScore(f, cm.get(f.clusterId)) })).sort((a, b) => b.p.score - a.p.score);
  const sk = 'px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white';
  return (
    <div className="p-6">
      <PageHeader title="Compliance & Inspection Priority" sub="Factories ranked by a transparent priority score: reporting status, size, hazardous share of waste and how poorly the surrounding cluster is covered. Hover a score for the breakdown."
        right={<button onClick={() => downloadCsv('compliance_priority.csv', [['ID', 'Factory', 'District', 'Industry', 'Size', 'Status', 'Priority'], ...rows.map(({ f, p }) => [f.id, f.name, f.district, INDUSTRY_LABEL[f.industry], f.size, f.reportStatus, p.score])])} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white border border-gray-200 font-semibold"><Download size={14} />Export CSV</button>} />
      <div className="flex gap-2 mb-3"><select className={sk} value={st} onChange={(e) => setSt(e.target.value)}><option value="pending">Not reported</option><option value="never_filed">Never filed</option><option value="overdue">Overdue</option><option value="reported">Reported</option><option value="all">All</option></select>
        <select className={sk} value={dist} onChange={(e) => setDist(e.target.value)}><option value="all">All districts</option>{[...new Set(CLUSTERS.map((c) => c.district))].map((d) => <option key={d}>{d}</option>)}</select><span className="text-xs text-gray-500 self-center">{rows.length} factories</span></div>
      <Card className="overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="text-left p-3">Factory</th><th className="p-3 text-left">Industry</th><th className="p-3">Size</th><th className="p-3">Status</th><th className="p-3 text-right">Est. waste</th><th className="p-3">Priority</th><th className="p-3" /></tr></thead>
        <tbody>{rows.slice(0, 60).map(({ f, p }) => (<tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50">
          <td className="p-3"><button className="text-left" onClick={() => nav('overview', { lat: f.lat, lng: f.lng, zoom: 13, select: { type: 'factory', id: f.id } })}><b>{f.name}</b><p className="text-[11px] text-gray-400">{f.id} · {f.district}</p></button></td>
          <td className="p-3 text-xs">{INDUSTRY_LABEL[f.industry]}</td><td className="p-3 text-center text-xs">{f.size}</td><td className="p-3 text-center"><StatusBadge s={f.reportStatus} /></td>
          <td className="p-3 text-right text-xs">{fmt(effectiveEntries(f).reduce((s, e) => s + e.quantityTpa, 0))} t/yr</td>
          <td className="p-3 text-center"><span title={p.parts.filter((x) => x.points).map((x) => `${x.label}: +${x.points}`).join('\n')} className="inline-block px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: p.score >= 60 ? '#fee2e2' : p.score >= 35 ? '#fef3c7' : '#dcfce7', color: p.score >= 60 ? '#b91c1c' : p.score >= 35 ? '#b45309' : '#15803d' }}>{p.score}</span></td>
          <td className="p-3 text-right">{f.reportStatus !== 'reported' && <button disabled={sent.has(f.id)} onClick={() => { setSent(new Set(sent).add(f.id)); showToast(`Reminder sent to ${f.contactEmail} (mock)`); }} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 disabled:text-gray-300 hover:bg-gray-50"><Send size={11} />{sent.has(f.id) ? 'Sent' : 'Remind'}</button>}</td></tr>))}</tbody></table></Card>
      {rows.length > 60 && <p className="text-xs text-gray-400 mt-2">Showing top 60 of {rows.length}. Export CSV for the full list.</p>}
    </div>
  );
}

export function FacilitiesPage() {
  const { data, nav } = useApp();
  return (
    <div className="p-6"><PageHeader title="Authorized Facilities" sub="Capacity and utilisation as declared by each facility. Facilities update their own capacity, which feeds the gap analysis." />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{data.facilities.map((f) => { const st = authState(f); const linked = data.factories.filter((x) => x.linkedFacilityId === f.id).length; return (
        <Card key={f.id} className="p-4"><div className="flex justify-between gap-2"><div><p className="text-[11px] text-gray-400">{f.id} · {f.district}</p><b className="text-sm">{f.name}</b></div><Badge tone="blue">{FACILITY_LABEL[f.type]}</Badge></div>
          <div className="mt-3 flex justify-between text-xs"><span>Utilisation</span><b>{f.utilizationPct}%</b></div><Bar value={f.utilizationPct} color={f.utilizationPct >= 90 ? '#dc2626' : f.utilizationPct < 20 ? '#d97706' : '#2563eb'} />
          <p className="text-[11px] text-gray-500 mt-1">{fmt(f.capacityTpa)} t/yr · {fmt(availableTpa(f))} spare · {linked} linked factories</p>
          <div className="flex flex-wrap gap-1 mt-3">{f.accepted.map((w) => <Badge key={w}>{WASTE_LABEL[w]}</Badge>)}</div>
          <div className="flex items-center justify-between mt-3">{st === 'valid' ? <span className="text-[11px] text-gray-500">Auth. till {f.authValidTill}</span> : <Badge tone={st === 'expired' ? 'red' : 'amber'}>Auth {st} · {daysToExpiry(f)}d</Badge>}
            <button onClick={() => nav('overview', { lat: f.lat, lng: f.lng, zoom: 11, select: { type: 'facility', id: f.id } })} className="text-xs font-semibold text-brand-700">Map →</button></div></Card>); })}</div></div>
  );
}

export function Alerts() {
  const { data, clusters, nav } = useApp();
  const alerts = buildAlerts(data.factories, data.facilities, clusters);
  return (
    <div className="p-6 max-w-4xl"><PageHeader title="Alerts" sub={`${alerts.length} issues detected automatically from reports, capacity and authorizations.`} />
      <div className="space-y-2">{alerts.map((a) => (<Card key={a.id} className="p-4 flex items-start gap-3"><span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${a.severity === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
        <div className="flex-1"><b className="text-sm">{a.title}</b><p className="text-xs text-gray-500 mt-0.5">{a.detail}</p></div>
        <button onClick={() => nav('overview', { lat: a.lat, lng: a.lng, zoom: a.zoom })} className="text-xs font-semibold text-brand-700 whitespace-nowrap">Show on map →</button></Card>))}</div></div>
  );
}
