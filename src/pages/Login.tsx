import { useState } from 'react';
import { Leaf, MapPin, Shield, Factory, Building2, ChevronDown } from 'lucide-react';
import { useApp } from '@/store';
import { OFFICER } from '@/lib/seed';
import type { Role } from '@/types';

export default function Login() {
  const { login, data } = useApp();
  const [tab, setTab] = useState<Role>('officer');
  const [id, setId] = useState<string>(OFFICER.id); const [code, setCode] = useState<string>(OFFICER.code);
  const [err, setErr] = useState<string | null>(null); const [open, setOpen] = useState(true);
  const demoF = data.factories.filter((f) => /^DEMO0\d$/.test(f.accessCode));
  const demoW = data.facilities.slice(0, 3);
  const tabs: { r: Role; label: string; icon: typeof Shield }[] = [{ r: 'officer', label: 'Government', icon: Shield }, { r: 'factory', label: 'Factory', icon: Factory }, { r: 'facility', label: 'Facility', icon: Building2 }];
  const fill = (i: string, c: string, r: Role) => { setTab(r); setId(i); setCode(c); setErr(null); };
  return (
    <div className="h-full grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-brand-800 via-brand-700 to-emerald-600">
        <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><Leaf /></div><b className="text-lg tracking-wide">INDUSTRIAL WASTE INTELLIGENCE</b></div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Missing reports create a data gap.<br />The data gap creates an infrastructure gap.</h1>
          <p className="mt-5 text-brand-100 text-lg max-w-lg">We estimate what non-reporting factories generate, make reporting a one-minute task, and show where Andhra Pradesh lacks treatment capacity — updating live with every report.</p>
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg text-sm">
            {['Monitor reporting', 'Estimate the gap', 'Plan infrastructure'].map((t, i) => <div key={t} className="bg-white/10 rounded-xl p-3"><p className="text-2xl font-bold">{i + 1}</p>{t}</div>)}
          </div>
        </div>
        <p className="text-sm text-brand-100 flex items-center gap-2"><MapPin size={15} /> Pilot region: Andhra Pradesh · Track: Waste &amp; Energy</p>
      </div>
      <div className="flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
          <p className="text-sm text-gray-500 mt-1">Use the ID and access code issued by the pollution control board. No sign-up needed.</p>
          <div className="flex gap-2 mt-6">{tabs.map(({ r, label, icon: I }) => <button key={r} onClick={() => { setTab(r); setErr(null); setId(''); setCode(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition ${tab === r ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}><I size={15} />{label}</button>)}</div>
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(login(id, code)); }}>
            <div><label className="text-xs font-semibold text-gray-600">{tab === 'officer' ? 'Officer ID' : tab === 'factory' ? 'Factory ID' : 'Facility ID'}</label>
              <input value={id} onChange={(e) => setId(e.target.value)} placeholder={tab === 'factory' ? 'AP-F-001' : tab === 'facility' ? 'AP-W-01' : 'APPCB-OFFICER'} className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" /></div>
            <div><label className="text-xs font-semibold text-gray-600">Access code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} type="password" className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" /></div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition">Sign in</button>
          </form>
          <div className="mt-6 border border-gray-200 rounded-xl">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700">Demo access (click to fill)<ChevronDown size={16} className={open ? 'rotate-180' : ''} /></button>
            {open && <div className="px-4 pb-4 space-y-1.5 text-xs">
              <button onClick={() => fill(OFFICER.id, OFFICER.code, 'officer')} className="w-full text-left p-2 rounded-lg hover:bg-gray-50"><b>Officer</b> · {OFFICER.id} / {OFFICER.code}</button>
              {demoF.map((f) => <button key={f.id} onClick={() => fill(f.id, f.accessCode, 'factory')} className="w-full text-left p-2 rounded-lg hover:bg-gray-50"><b>Factory</b> · {f.id} / {f.accessCode} <span className="text-gray-400">— {f.reportStatus === 'reported' ? 'already reported' : 'not reported (Parawada)'}</span></button>)}
              {demoW.map((w) => <button key={w.id} onClick={() => fill(w.id, w.accessCode, 'facility')} className="w-full text-left p-2 rounded-lg hover:bg-gray-50"><b>Facility</b> · {w.id} / {w.accessCode}</button>)}
              <p className="text-[11px] text-gray-400 pt-1">Demo-only login. A production version would use Cognito/OTP and server-side checks.</p>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
