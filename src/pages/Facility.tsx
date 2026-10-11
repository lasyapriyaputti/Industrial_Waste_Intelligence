import { useState } from 'react';
import { useApp } from '@/store';
import { Badge, Card, PageHeader, fmt, statusColor } from '@/components/ui';
import { CLUSTERS, FACILITY_LABEL } from '@/lib/seed';
import { INDUSTRY_LABEL, WASTE_LABEL, WASTE_TYPES, computeClusters, haversineKm } from '@/lib/analysis';
import type { Facility } from '@/types';

function useMe(): Facility { const { data, session } = useApp(); return data.facilities.find((f) => f.id === session!.id)!; }

export function FacilityProfile() {
  const me = useMe(); const { data, radius, updateFacility, showToast } = useApp();
  const [cap, setCap] = useState(String(me.capacityTpa)); const [util, setUtil] = useState(String(me.utilizationPct)); const [auth, setAuth] = useState(me.authValidTill);
  const [contact, setContact] = useState(me.contact); const [acc, setAcc] = useState(me.accepted); const [impact, setImpact] = useState<string | null>(null);
  const sk = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:border-brand-500';
  const save = () => {
    const c = Number(cap), u = Number(util);
    if (!(c > 0) || !(u >= 0 && u <= 100) || !acc.length) { showToast('Check capacity (>0), utilisation (0–100) and at least one waste type'); return; }
    const patch = { capacityTpa: c, utilizationPct: u, authValidTill: auth, contact, accepted: acc };
    const nearest = [...CLUSTERS].sort((a, b) => haversineKm(a.lat, a.lng, me.lat, me.lng) - haversineKm(b.lat, b.lng, me.lat, me.lng))[0];
    const get = (fs: Facility[]) => computeClusters(data.factories, fs, CLUSTERS, radius).find((x) => x.cluster.id === nearest.id)!.score;
    const b = get(data.facilities), a = get(data.facilities.map((f) => (f.id === me.id ? { ...f, ...patch } : f)));
    updateFacility(me.id, patch); setImpact(`${nearest.name}: coverage ${b}% → ${a}%`); showToast('Facility profile saved');
  };
  const linked = data.factories.filter((f) => f.linkedFacilityId === me.id);
  return (
    <div className="p-6 max-w-4xl"><PageHeader title={me.name} sub={`${me.id} · ${FACILITY_LABEL[me.type]} · ${me.district}`} />
      <div className="grid md:grid-cols-3 gap-4"><Card className="p-5 md:col-span-2 space-y-4">
        <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-semibold text-gray-600">Capacity (t/yr)</label><input className={sk} type="number" value={cap} onChange={(e) => setCap(e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-gray-600">Current utilisation (%)</label><input className={sk} type="number" value={util} onChange={(e) => setUtil(e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-gray-600">Authorization valid till</label><input className={sk} type="date" value={auth} onChange={(e) => setAuth(e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-gray-600">Contact</label><input className={sk} value={contact} onChange={(e) => setContact(e.target.value)} /></div></div>
        <div><label className="text-xs font-semibold text-gray-600">Accepted waste types</label><div className="flex flex-wrap gap-2 mt-2">{WASTE_TYPES.map((w) => <button key={w} onClick={() => setAcc(acc.includes(w) ? acc.filter((x) => x !== w) : [...acc, w])} className={`px-3 py-1.5 rounded-full text-xs border ${acc.includes(w) ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>{WASTE_LABEL[w]}</button>)}</div></div>
        <button onClick={save} className="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold">Save changes</button>
        {impact && <p className="text-sm p-3 rounded-lg bg-green-50 text-green-800">Your update changed the regional picture — <b>{impact}</b></p>}</Card>
        <Card className="p-5"><p className="font-semibold text-sm mb-3">Linked factories</p><p className="text-3xl font-bold">{linked.length}</p><p className="text-xs text-gray-500 mb-3">Names are hidden for confidentiality.</p>
          {linked.map((f) => <p key={f.id} className="text-xs text-gray-600 py-1 border-t border-gray-100">Factory {f.id.slice(-3)} · {INDUSTRY_LABEL[f.industry]} · {f.size}</p>)}</Card></div></div>
  );
}

export function FacilityRequests() {
  const me = useMe(); const { data, respondRequest, showToast } = useApp();
  const reqs = data.requests.filter((r) => r.facilityId === me.id).slice().reverse();
  return (
    <div className="p-6 max-w-3xl"><PageHeader title="Incoming Requests" sub="Factories that ask to send waste to your facility. Accepting reserves capacity (utilisation rises)." />
      {reqs.length === 0 && <Card className="p-6 text-sm text-gray-500">No requests yet.</Card>}
      <div className="space-y-3">{reqs.map((r) => { const f = data.factories.find((x) => x.id === r.factoryId)!; return (
        <Card key={r.id} className="p-4 flex items-center gap-4"><div className="flex-1"><b className="text-sm">Factory {f.id.slice(-3)} · {INDUSTRY_LABEL[f.industry]} ({f.size})</b>
          <p className="text-xs text-gray-500 mt-0.5">{WASTE_LABEL[r.wasteType]} · {fmt(r.quantityTpa)} t/yr · {r.distanceKm} km away · {f.district}</p></div>
          {r.status === 'pending' ? <div className="flex gap-2"><button onClick={() => { respondRequest(r.id, 'accepted'); showToast('Request accepted — utilisation updated'); }} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold">Accept</button>
            <button onClick={() => respondRequest(r.id, 'rejected')} className="px-3 py-1.5 rounded-lg border text-xs">Decline</button></div>
            : <Badge tone={r.status === 'accepted' ? 'green' : 'red'}>{r.status}</Badge>}</Card>); })}</div></div>
  );
}
