import type { ReactNode } from 'react';
import type { Status } from '@/lib/analysis';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
export const statusColor: Record<Status, string> = { green: '#16a34a', amber: '#d97706', red: '#dc2626' };

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>{children}</div>;
}
const tones: Record<string, string> = {
  green: 'bg-green-50 text-green-700 border-green-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200', gray: 'bg-gray-100 text-gray-600 border-gray-200', brand: 'bg-brand-50 text-brand-700 border-brand-200',
};
export function Badge({ tone = 'gray', children, title }: { tone?: keyof typeof tones; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}
export const EstBadge = ({ estimated, confidence }: { estimated: boolean; confidence?: string }) =>
  estimated ? <Badge tone="amber" title="Estimated from industry peer averages">Estimated{confidence ? ` · ${confidence}` : ''}</Badge> : <Badge tone="green">Reported</Badge>;
export const StatusBadge = ({ s }: { s: string }) =>
  s === 'reported' ? <Badge tone="green">Reported</Badge> : s === 'overdue' ? <Badge tone="amber">Overdue</Badge> : <Badge tone="red">Never filed</Badge>;

export function Bar({ value, color = '#0d9488', height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
export function Kpi({ label, value, sub, icon, tone = 'brand' }: { label: string; value: ReactNode; sub?: string; icon: ReactNode; tone?: keyof typeof tones }) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${tones[tone]}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  );
}
export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div><h2 className="text-xl font-bold text-gray-900">{title}</h2>{sub && <p className="text-sm text-gray-500 mt-0.5 max-w-3xl">{sub}</p>}</div>
      {right}
    </div>
  );
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
}
