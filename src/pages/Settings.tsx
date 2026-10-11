import { useApp } from '@/store';
import { Card, PageHeader } from '@/components/ui';

export default function Settings() {
  const { session, reset, showToast, data } = useApp();
  return (
    <div className="p-6 max-w-3xl space-y-4"><PageHeader title="Settings & About" />
      <Card className="p-5 text-sm space-y-2 text-gray-700"><p className="font-semibold text-gray-900">About the data</p>
        <p>All factories, facilities, quantities and names are <b>simulated</b>. Cluster centres are real industrial hubs of Andhra Pradesh (approximate coordinates). Waste estimates use indicative peer averages by industry and size — not official figures.</p>
        <p>For real analysis, replace the seed with APPCB consent &amp; annual-return records, CPCB authorized TSDF/recycler lists, APIIC industrial park lists and OpenStreetMap industrial land-use.</p>
        <p className="text-xs text-gray-400">Registry: {data.factories.length} factories · {data.facilities.length} facilities · data version {data.version}</p></Card>
      {session?.role === 'officer' && <Card className="p-5"><p className="font-semibold text-sm mb-1">Reset demo data</p><p className="text-xs text-gray-500 mb-3">Restores the original dataset (all submitted reports and requests are removed). Useful before recording the demo.</p>
        <button onClick={() => { reset(); showToast('Demo data reset'); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Reset data</button></Card>}
    </div>
  );
}
