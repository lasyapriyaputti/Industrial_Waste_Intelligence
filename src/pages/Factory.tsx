import { useState } from 'react';
import { CheckCircle2, Plus, Trash2, Wand2, AlertCircle } from 'lucide-react';
import { useApp, REPORT_YEAR } from '@/store';
import MapView from '@/components/MapView';
import { Badge, Card, EstBadge, PageHeader, StatusBadge, fmt, statusColor } from '@/components/ui';
import { CLUSTERS, FACILITY_LABEL } from '@/lib/seed';
import { DISPOSAL_LABEL, INDUSTRY_LABEL, WASTE_LABEL, WASTE_TYPES, computeClusters, effectiveEntries, estimateEntries, matchesForFactory } from '@/lib/analysis';
import type { Disposal, Factory, WasteEntry, WasteType } from '@/types';

function useMe(): Factory { const { data, session } = useApp(); return data.factories.find((f) => f.id === session!.id)!; }

export function FactoryDashboard() {
  const me = useMe(); const { data, nav, sendRequest, showToast } = useApp();
  const eff = effectiveEntries(me); const ms = matchesForFactory(me, data.facilities).slice(0, 3);
  const mine = data.requests.filter((r) => r.factoryId === me.id);
  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <PageHeader title={me.name} sub={`${me.id} · ${INDUSTRY_LABEL[me.industry]} · ${me.size} unit · ${me.district}`} />
      {me.reportStatus !== 'reported' ? (
        <Card className="p-5 border-amber-300 bg-amber-50 flex items-start gap-4"><AlertCircle className="text-amber-600 shrink-0" />
          <div className="flex-1"><b className="text-amber-900">Annual report for {REPORT_YEAR} not filed</b><p className="text-sm text-amber-800 mt-1">Authorities currently use an <u>estimate</u> of your waste based on similar units. Filing takes about a minute and corrects the planning picture for your region.</p></div>
          <button onClick={() => nav('f-report')} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold whitespace-nowrap">File report now</button></Card>
      ) : <Card className="p-5 border-green-200 bg-green-50 flex items-center gap-3"><CheckCircle2 className="text-green-600" /><p className="text-sm text-green-800"><b>Report on file</b> for {me.lastReportYear}. Thank you — your data is being used in the regional gap analysis.</p></Card>}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5"><p className="font-semibold mb-3">Registry profile <span className="text-xs font-normal text-gray-400">(read-only)</span></p>
          <dl className="text-sm space-y-2">{[['Status', <StatusBadge key="s" s={me.reportStatus} />], ['Consent', me.consentValid ? <Badge tone="green">Valid</Badge> : <Badge tone="red">Expired</Badge>], ['Employees', me.employees], ['Location', `${me.lat.toFixed(3)}, ${me.lng.toFixed(3)}`], ['Contact', me.contactEmail]].map(([k, v]) => <div key={String(k)} className="flex justify-between"><dt className="text-gray-500">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
        <Card className="p-5"><p className="font-semibold mb-3">Waste profile in the system</p>{eff.map((e) => <div key={e.wasteType} className="flex justify-between items-center py-1.5 border-b border-gray-100 text-sm gap-2"><span className="text-gray-600">{WASTE_LABEL[e.wasteType]}</span><span className="flex items-center gap-2"><b>{fmt(e.quantityTpa)} t/yr</b><EstBadge estimated={e.estimated} confidence={e.confidence} /></span></div>)}</Card>
      </div>
      <Card className="p-5"><p className="font-semibold mb-3">Best facilities for your waste</p>
        {ms.length === 0 && <p className="text-sm text-red-600">No authorized facility within 250 km accepts your waste streams. This gap is flagged to the authority.</p>}
        <div className="grid md:grid-cols-3 gap-3">{ms.map((m) => { const req = mine.find((r) => r.facilityId === m.facility.id); return (
          <div key={m.facility.id} className="p-3 rounded-xl border border-gray-200"><div className="flex justify-between"><b className="text-sm">{m.facility.name}</b><Badge tone="brand">{m.score}</Badge></div>
            <p className="text-[11px] text-gray-500 mt-1">{FACILITY_LABEL[m.facility.type]} · {m.distanceKm} km</p><p className="text-[11px] text-gray-500 mt-1">{m.why}</p>
            {req ? <div className="mt-3"><Badge tone={req.status === 'accepted' ? 'green' : req.status === 'rejected' ? 'red' : 'amber'}>Request {req.status}</Badge></div>
              : <button onClick={() => { const e = eff.find((x) => m.accepts.includes(x.wasteType))!; sendRequest(me.id, m.facility.id, e.wasteType, e.quantityTpa, m.distanceKm); showToast(`Request sent to ${m.facility.name}`); }} className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold">Request collection</button>}</div>); })}</div></Card>
    </div>
  );
}

interface Row { wasteType: WasteType | ''; qty: string; disposal: Disposal }
export function ReportForm() {
  const me = useMe(); const { data, radius, submitReport, nav, showToast } = useApp();
  const [year, setYear] = useState(REPORT_YEAR);
  const [rows, setRows] = useState<Row[]>([{ wasteType: '', qty: '', disposal: 'unknown' }]);
  const [errs, setErrs] = useState<string[]>([]); const [done, setDone] = useState<null | { before: number; after: number; conf: number; name: string }>(null);
  const sk = 'px-2.5 py-2 text-sm rounded-lg border border-gray-300 bg-white outline-none focus:border-brand-500';
  const cluster = CLUSTERS.find((c) => c.id === me.clusterId)!;
  const prefill = () => setRows(estimateEntries(me.industry, me.size).map((e) => ({ wasteType: e.wasteType, qty: String(e.quantityTpa), disposal: 'unknown' as Disposal })));

  const submit = () => {
    const e: string[] = []; const seen = new Set<string>(); const entries: WasteEntry[] = [];
    rows.forEach((r, i) => { if (!r.wasteType) e.push(`Row ${i + 1}: choose a waste type`); else if (seen.has(r.wasteType)) e.push(`Row ${i + 1}: ${WASTE_LABEL[r.wasteType]} is listed twice`); seen.add(r.wasteType);
      const q = Number(r.qty); if (!(q > 0) || q > 1e6) e.push(`Row ${i + 1}: enter a quantity between 0 and 1,000,000 t/yr`);
      if (r.wasteType && q > 0) entries.push({ wasteType: r.wasteType, quantityTpa: q, disposal: r.disposal }); });
    setErrs(e); if (e.length) return;
    const get = (fs: Factory[]) => computeClusters(fs, data.facilities, CLUSTERS, radius).find((c) => c.cluster.id === me.clusterId)!;
    const before = get(data.factories);
    const sim = data.factories.map((f) => (f.id === me.id ? { ...f, reportStatus: 'reported' as const, reports: [{ year, entries, submittedAt: '' }] } : f));
    const after = get(sim);
    submitReport(me.id, year, entries); showToast('Report submitted — the regional map has been updated');
    setDone({ before: before.score, after: after.score, conf: after.confidencePct, name: cluster.name });
  };
  if (done) return (
    <div className="p-6 max-w-2xl"><Card className="p-8 text-center"><CheckCircle2 size={56} className="mx-auto text-green-500" /><h2 className="text-2xl font-bold mt-4">Report submitted</h2>
      <p className="text-gray-500 mt-2">Your actual figures replaced the estimate. Here is what changed for <b>{done.name}</b>:</p>
      <div className="grid grid-cols-2 gap-4 mt-6"><div className="p-4 rounded-xl bg-gray-50"><p className="text-xs text-gray-500">Coverage score</p><p className="text-2xl font-bold"><span className="text-gray-400">{done.before}%</span> → <span style={{ color: statusColor[done.after >= 80 ? 'green' : done.after >= 40 ? 'amber' : 'red'] }}>{done.after}%</span></p></div>
        <div className="p-4 rounded-xl bg-gray-50"><p className="text-xs text-gray-500">Cluster data confidence</p><p className="text-2xl font-bold text-green-600">{done.conf}% reported</p></div></div>
      <div className="flex gap-3 justify-center mt-6"><button onClick={() => nav('f-find')} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold">See recommended facilities</button><button onClick={() => nav('f-dashboard')} className="px-4 py-2 rounded-lg border text-sm">Back to my factory</button></div></Card></div>);
  return (
    <div className="p-6 max-w-3xl"><PageHeader title="Annual Waste Report" sub={`${me.name} — your registry details are pre-filled. Add each waste stream you generated.`} />
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3"><label className="text-sm font-semibold">Reporting year</label><select className={sk} value={year} onChange={(e) => setYear(+e.target.value)}>{[REPORT_YEAR, REPORT_YEAR - 1].map((y) => <option key={y}>{y}</option>)}</select>
          <button onClick={prefill} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-violet-700 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200"><Wand2 size={13} />Start from the estimate for similar units</button></div>
        <div className="space-y-2">{rows.map((r, i) => (<div key={i} className="grid grid-cols-[1.6fr_1fr_1.2fr_auto] gap-2 items-center">
          <select className={sk} value={r.wasteType} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, wasteType: e.target.value as WasteType } : x)))}><option value="">Waste type…</option>{WASTE_TYPES.map((w) => <option key={w} value={w}>{WASTE_LABEL[w]}</option>)}</select>
          <input className={sk} type="number" min="0" placeholder="tonnes / year" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
          <select className={sk} value={r.disposal} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, disposal: e.target.value as Disposal } : x)))}>{(Object.keys(DISPOSAL_LABEL) as Disposal[]).map((d) => <option key={d} value={d}>{DISPOSAL_LABEL[d]}</option>)}</select>
          <button disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30"><Trash2 size={16} /></button></div>))}</div>
        <button onClick={() => setRows([...rows, { wasteType: '', qty: '', disposal: 'unknown' }])} className="flex items-center gap-1.5 text-sm font-semibold text-brand-700"><Plus size={15} />Add waste stream</button>
        {errs.length > 0 && <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700 space-y-0.5">{errs.map((e) => <p key={e}>{e}</p>)}</div>}
        <button onClick={submit} className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold">Submit report</button></Card></div>
  );
}

export function FindFacilities() {
  const me = useMe(); const { data, sendRequest, showToast } = useApp();
  const eff = effectiveEntries(me); const ms = matchesForFactory(me, data.facilities).slice(0, 5);
  const mine = data.requests.filter((r) => r.factoryId === me.id);
  const top = ms.slice(0, 3);
  return (
    <div className="p-6"><PageHeader title="Find Facilities" sub="Authorized facilities that accept your waste, ranked by compatibility, distance, spare capacity and authorization." />
      <div className="grid lg:grid-cols-5 gap-4"><div className="lg:col-span-3"><Card className="overflow-hidden"><div style={{ height: 520 }}>
        <MapView factories={[me]} facilities={ms.map((m) => m.facility)} layers={{ factories: true, facilities: true, zones: false }} center={[me.lat, me.lng]} zoom={8}
          focus={{ lat: me.lat, lng: me.lng, zoom: 8, key: 1 }} lines={top.map((m) => ({ from: [me.lat, me.lng], to: [m.facility.lat, m.facility.lng], label: `${m.distanceKm} km` }))} /></div></Card></div>
        <div className="lg:col-span-2 space-y-3">{ms.length === 0 && <Card className="p-4 text-sm text-red-600">No authorized facility within 250 km accepts your waste streams.</Card>}
          {ms.map((m, i) => { const req = mine.find((r) => r.facilityId === m.facility.id); return (<Card key={m.facility.id} className="p-4"><div className="flex justify-between"><b className="text-sm">{i + 1}. {m.facility.name}</b><Badge tone="brand">{m.score}</Badge></div>
            <p className="text-xs text-gray-500 mt-1">{m.why}</p>
            {req ? <Badge tone={req.status === 'accepted' ? 'green' : req.status === 'rejected' ? 'red' : 'amber'}>Request {req.status}</Badge> : <button onClick={() => { const e = eff.find((x) => m.accepts.includes(x.wasteType))!; sendRequest(me.id, m.facility.id, e.wasteType, e.quantityTpa, m.distanceKm); showToast('Request sent'); }} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold">Request collection</button>}</Card>); })}</div></div></div>
  );
}
