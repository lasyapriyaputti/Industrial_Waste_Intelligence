import { X } from 'lucide-react';
import { useApp } from '@/store';
import type { Selection } from '@/components/MapView';
import { INDUSTRY_LABEL, WASTE_LABEL, authState, availableTpa, daysToExpiry, effectiveEntries, matchesForFactory, priorityScore } from '@/lib/analysis';
import { FACILITY_LABEL } from '@/lib/seed';
import { Badge, Bar, EstBadge, StatusBadge, fmt, statusColor } from '@/components/ui';

export default function EntityDrawer({ sel, onClose }: { sel: NonNullable<Selection>; onClose: () => void }) {
  const { data, clusters } = useApp();
  const factory = sel.type === 'factory' ? data.factories.find((f) => f.id === sel.id) : undefined;
  const facility = sel.type === 'facility' ? data.facilities.find((f) => f.id === sel.id) : undefined;
  const cluster = sel.type === 'cluster' ? clusters.find((c) => c.cluster.id === sel.id) : undefined;
  return (
    <div className="absolute top-3 right-3 bottom-3 w-[360px] glass rounded-2xl shadow-2xl border border-gray-200 z-[1000] overflow-y-auto iwi-slide">
      <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
      <div className="p-5 space-y-4 text-sm">
        {factory && (() => {
          const cr = clusters.find((c) => c.cluster.id === factory.clusterId); const pr = priorityScore(factory, cr);
          const eff = effectiveEntries(factory); const ms = matchesForFactory(factory, data.facilities).slice(0, 3);
          return <>
            <div className="pr-8"><p className="text-[11px] text-gray-400">{factory.id}</p><h3 className="text-base font-bold text-gray-900">{factory.name}</h3>
              <div className="flex gap-1.5 mt-2 flex-wrap"><StatusBadge s={factory.reportStatus} /><Badge tone="blue">{INDUSTRY_LABEL[factory.industry]}</Badge><Badge>{factory.size}</Badge></div>
              <p className="text-xs text-gray-500 mt-2">{cr?.cluster.name} · {factory.district} · {factory.employees} employees</p></div>
            <div><p className="font-semibold text-gray-700 mb-2">Waste profile</p>
              {eff.map((e) => <div key={e.wasteType} className="flex items-center justify-between py-1.5 border-b border-gray-100 gap-2"><span className="text-gray-600 text-xs">{WASTE_LABEL[e.wasteType]}</span><span className="flex items-center gap-2"><b>{fmt(e.quantityTpa)} t/yr</b><EstBadge estimated={e.estimated} confidence={e.confidence} /></span></div>)}
              {factory.reportStatus !== 'reported' && <p className="text-[11px] text-amber-700 mt-2">No report on file — figures are peer-average estimates, not measured data.</p>}</div>
            {factory.reportStatus !== 'reported' && <div><p className="font-semibold text-gray-700 mb-1">Inspection priority: {pr.score}/100</p>
              {pr.parts.filter((x) => x.points > 0).map((x) => <div key={x.label} className="flex justify-between text-xs text-gray-600"><span>{x.label}</span><span>+{x.points}</span></div>)}</div>}
            <div><p className="font-semibold text-gray-700 mb-2">Recommended facilities</p>
              {ms.length === 0 && <p className="text-xs text-red-600">No authorized facility within 250 km accepts this waste.</p>}
              {ms.map((m) => <div key={m.facility.id} className="mb-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100"><div className="flex justify-between"><b className="text-xs">{m.facility.name}</b><Badge tone="brand">{m.score}</Badge></div><p className="text-[11px] text-gray-500 mt-1">{m.why}</p></div>)}</div>
          </>;
        })()}
        {facility && (() => {
          const st = authState(facility); const linked = data.factories.filter((f) => f.linkedFacilityId === facility.id).length;
          return <>
            <div className="pr-8"><p className="text-[11px] text-gray-400">{facility.id}</p><h3 className="text-base font-bold text-gray-900">{facility.name}</h3>
              <div className="flex gap-1.5 mt-2 flex-wrap"><Badge tone="blue">{FACILITY_LABEL[facility.type]}</Badge>
                {facility.utilizationPct >= 90 && <Badge tone="red">Near capacity</Badge>}{facility.utilizationPct < 20 && <Badge tone="amber">Under-used</Badge>}
                {st !== 'valid' && <Badge tone={st === 'expired' ? 'red' : 'amber'}>Auth {st}</Badge>}</div></div>
            <div><div className="flex justify-between text-xs mb-1"><span>Utilisation</span><b>{facility.utilizationPct}%</b></div>
              <Bar value={facility.utilizationPct} color={facility.utilizationPct >= 90 ? '#dc2626' : '#2563eb'} />
              <p className="text-[11px] text-gray-500 mt-1">{fmt(facility.capacityTpa)} t/yr capacity · {fmt(availableTpa(facility))} t/yr spare</p></div>
            <div><p className="font-semibold text-gray-700 mb-1.5">Accepts</p><div className="flex flex-wrap gap-1">{facility.accepted.map((w) => <Badge key={w} tone="gray">{WASTE_LABEL[w]}</Badge>)}</div></div>
            <p className="text-xs text-gray-600">Authorization valid till <b>{facility.authValidTill}</b> ({daysToExpiry(facility)} days) · {linked} linked factories</p>
          </>;
        })()}
        {cluster && <>
          <div className="pr-8"><p className="text-[11px] text-gray-400">Cluster · {cluster.cluster.district}</p><h3 className="text-base font-bold text-gray-900">{cluster.cluster.name}</h3></div>
          <div className="flex items-end gap-3"><span className="text-4xl font-bold" style={{ color: statusColor[cluster.status] }}>{cluster.score}%</span><span className="text-xs text-gray-500 pb-1.5">overall coverage</span></div>
          <div className="text-xs text-gray-600 space-y-1"><p>{cluster.reportedCount}/{cluster.factoriesCount} factories reported</p>
            <p>Data confidence: <b>{cluster.confidencePct}%</b> reported · {100 - cluster.confidencePct}% estimated</p></div>
          <div>{(Object.keys(cluster.demand) as (keyof typeof WASTE_LABEL)[]).map((w) => <div key={w} className="mb-2"><div className="flex justify-between text-[11px]"><span>{WASTE_LABEL[w]}</span><span>{fmt(cluster.demand[w] ?? 0)} t/yr · <b>{Math.round(cluster.coverage[w] ?? 0)}%</b></span></div>
            <Bar value={cluster.coverage[w] ?? 0} height={6} color={statusColor[(cluster.coverage[w] ?? 0) >= 80 ? 'green' : (cluster.coverage[w] ?? 0) >= 40 ? 'amber' : 'red']} /></div>)}</div>
        </>}
      </div>
    </div>
  );
}
