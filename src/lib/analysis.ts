import type { Cluster, Disposal, Facility, Factory, Industry, Size, WasteEntry, WasteType } from '@/types';

export const REPORT_YEAR = 2025;
export const WASTE_TYPES: WasteType[] = ['haz_incinerable', 'haz_chemical', 'metallic_sludge', 'used_oil', 'e_waste', 'plastic', 'fly_ash', 'organic', 'general_solid'];
export const WASTE_LABEL: Record<WasteType, string> = {
  haz_incinerable: 'Incinerable hazardous', haz_chemical: 'Chemical hazardous / sludge', metallic_sludge: 'Metallic sludge',
  used_oil: 'Used oil', e_waste: 'E-waste', plastic: 'Plastic', fly_ash: 'Fly ash', organic: 'Organic', general_solid: 'General solid',
};
/** Streams that count 5x when computing a cluster's overall score (hazardous + e-waste). */
export const PRIORITY_TYPES = new Set<WasteType>(['haz_incinerable', 'haz_chemical', 'metallic_sludge', 'used_oil', 'e_waste']);
export const INDUSTRY_LABEL: Record<Industry, string> = {
  pharma: 'Pharma', bulk_drugs: 'Bulk drugs', chemicals: 'Chemicals', fertilizer: 'Fertilizer', steel: 'Steel', cement: 'Cement',
  textile: 'Textile', food: 'Food processing', paper: 'Paper', electronics: 'Electronics', automobile: 'Automobile', power: 'Power', mining: 'Mining', refinery: 'Refinery / petrochem',
};
export const DISPOSAL_LABEL: Record<Disposal, string> = {
  landfill: 'Landfill', incineration: 'Incineration', co_processing: 'Co-processing', recycling: 'Recycling', reuse: 'Reuse', stored_onsite: 'Stored on site', unknown: 'Unknown',
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- Estimation: indicative peer averages (tonnes/year for a MEDIUM unit). NOT official figures. ---------- */
export const SIZE_MULT: Record<Size, number> = { small: 0.3, medium: 1, large: 3.2 };
export const ESTIMATION_BASE: Record<Industry, Partial<Record<WasteType, number>>> = {
  pharma: { haz_incinerable: 320, haz_chemical: 180, organic: 90 },
  bulk_drugs: { haz_incinerable: 260, haz_chemical: 300, organic: 60 },
  chemicals: { haz_chemical: 400, metallic_sludge: 60, used_oil: 20 },
  fertilizer: { haz_chemical: 120, general_solid: 300 },
  steel: { metallic_sludge: 500, used_oil: 40, general_solid: 800, fly_ash: 200 },
  cement: { fly_ash: 150, general_solid: 300, used_oil: 15 },
  textile: { haz_chemical: 60, plastic: 40, general_solid: 120 },
  food: { organic: 400, plastic: 30 },
  paper: { general_solid: 500, haz_chemical: 30, organic: 100 },
  electronics: { e_waste: 80, plastic: 40, metallic_sludge: 25 },
  automobile: { metallic_sludge: 90, used_oil: 35, e_waste: 10, plastic: 30 },
  power: { fly_ash: 2500, used_oil: 20, general_solid: 100 },
  mining: { general_solid: 900, used_oil: 30 },
  refinery: { haz_chemical: 900, used_oil: 200, metallic_sludge: 150 },
};

export interface EffEntry { wasteType: WasteType; quantityTpa: number; estimated: boolean; confidence?: 'low' | 'medium'; disposal?: Disposal }

export function estimateEntries(industry: Industry, size: Size): EffEntry[] {
  const base = ESTIMATION_BASE[industry];
  return (Object.keys(base) as WasteType[]).map((w) => ({
    wasteType: w, quantityTpa: Math.round((base[w] ?? 0) * SIZE_MULT[size]), estimated: true, confidence: size === 'medium' ? 'medium' : 'low',
  }));
}
export function latestReport(f: Factory) {
  return f.reportStatus === 'reported' && f.reports.length ? f.reports[f.reports.length - 1] : undefined;
}
export function effectiveEntries(f: Factory): EffEntry[] {
  const r = latestReport(f);
  if (r) return r.entries.map((e: WasteEntry) => ({ wasteType: e.wasteType, quantityTpa: e.quantityTpa, estimated: false, disposal: e.disposal }));
  return estimateEntries(f.industry, f.size);
}
export const totalTpa = (f: Factory) => effectiveEntries(f).reduce((s, e) => s + e.quantityTpa, 0);

/* ---------- Facility helpers ---------- */
export const availableTpa = (fc: Facility) => Math.max(0, fc.capacityTpa * (1 - fc.utilizationPct / 100));
export function daysToExpiry(fc: Facility, today = new Date()) {
  return Math.round((new Date(fc.authValidTill).getTime() - today.getTime()) / 86400000);
}
export function authState(fc: Facility, today = new Date()): 'valid' | 'expiring' | 'expired' {
  const d = daysToExpiry(fc, today);
  return d < 0 ? 'expired' : d <= 30 ? 'expiring' : 'valid';
}

/* ---------- Cluster coverage (the gap analysis) ---------- */
export type Status = 'green' | 'amber' | 'red';
export const statusOf = (score: number): Status => (score >= 80 ? 'green' : score >= 40 ? 'amber' : 'red');

export interface ClusterResult {
  cluster: Cluster; factoriesCount: number; reportedCount: number;
  demand: Partial<Record<WasteType, number>>; supply: Partial<Record<WasteType, number>>; coverage: Partial<Record<WasteType, number>>;
  score: number; status: Status; reportedTpa: number; estimatedTpa: number; confidencePct: number; weakest?: WasteType;
}

/**
 * For each waste type, each compatible facility's SPARE capacity is shared between all clusters within
 * radiusKm in proportion to their demand (so one facility is never counted in full by many clusters).
 * coverage = min(100, supply / demand). Cluster score = demand-weighted average, hazardous/e-waste weighted 5x.
 */
export function computeClusters(factories: Factory[], facilities: Facility[], clusters: Cluster[], radiusKm: number, today = new Date()): ClusterResult[] {
  const res: ClusterResult[] = clusters.map((cluster) => ({
    cluster, factoriesCount: 0, reportedCount: 0, demand: {}, supply: {}, coverage: {}, score: 100, status: 'green', reportedTpa: 0, estimatedTpa: 0, confidencePct: 0,
  }));
  const byId = new Map(res.map((r) => [r.cluster.id, r]));
  for (const f of factories) {
    const r = byId.get(f.clusterId); if (!r) continue;
    r.factoriesCount++; if (f.reportStatus === 'reported') r.reportedCount++;
    for (const e of effectiveEntries(f)) {
      r.demand[e.wasteType] = (r.demand[e.wasteType] ?? 0) + e.quantityTpa;
      if (e.estimated) r.estimatedTpa += e.quantityTpa; else r.reportedTpa += e.quantityTpa;
    }
  }
  for (const w of WASTE_TYPES) {
    for (const fc of facilities) {
      if (!fc.accepted.includes(w) || authState(fc, today) === 'expired') continue;
      const avail = availableTpa(fc); if (avail <= 0) continue;
      const reach = res.filter((r) => (r.demand[w] ?? 0) > 0 && haversineKm(r.cluster.lat, r.cluster.lng, fc.lat, fc.lng) <= radiusKm);
      const tot = reach.reduce((s, r) => s + (r.demand[w] ?? 0), 0); if (!tot) continue;
      for (const r of reach) r.supply[w] = (r.supply[w] ?? 0) + (avail * (r.demand[w] ?? 0)) / tot;
    }
  }
  for (const r of res) {
    let num = 0, den = 0, worst = 101;
    for (const w of WASTE_TYPES) {
      const d = r.demand[w] ?? 0; if (d <= 0) continue;
      const cov = Math.min(100, ((r.supply[w] ?? 0) / d) * 100);
      r.coverage[w] = cov;
      const wt = d * (PRIORITY_TYPES.has(w) ? 5 : 1);
      num += cov * wt; den += wt;
      if (PRIORITY_TYPES.has(w) && cov < worst) { worst = cov; r.weakest = w; }
    }
    r.score = den ? Math.round(num / den) : 100;
    r.status = statusOf(r.score);
    const t = r.reportedTpa + r.estimatedTpa;
    r.confidencePct = t ? Math.round((r.reportedTpa / t) * 100) : 0;
  }
  return res;
}

/* ---------- Matching ---------- */
export interface Match { facility: Facility; distanceKm: number; score: number; accepts: WasteType[]; availableTpa: number; why: string }
export function matchesForFactory(f: Factory, facilities: Facility[], maxKm = 250, today = new Date()): Match[] {
  const eff = effectiveEntries(f); const total = eff.reduce((s, e) => s + e.quantityTpa, 0) || 1;
  const out: Match[] = [];
  for (const fc of facilities) {
    const st = authState(fc, today); if (st === 'expired') continue;
    const covered = eff.filter((e) => fc.accepted.includes(e.wasteType)); if (!covered.length) continue;
    const dist = haversineKm(f.lat, f.lng, fc.lat, fc.lng); if (dist > maxKm) continue;
    const covQty = covered.reduce((s, e) => s + e.quantityTpa, 0);
    const avail = availableTpa(fc);
    const compat = covQty / total, distS = Math.max(0, 1 - dist / maxKm), capS = Math.min(1, avail / (covQty * 2 || 1)), authS = st === 'valid' ? 1 : 0.5;
    const score = Math.round((0.4 * compat + 0.3 * distS + 0.2 * capS + 0.1 * authS) * 100);
    const names = covered.map((e) => WASTE_LABEL[e.wasteType]).join(', ');
    out.push({ facility: fc, distanceKm: Math.round(dist), score, accepts: covered.map((e) => e.wasteType), availableTpa: Math.round(avail),
      why: `Accepts ${covered.length} of ${eff.length} waste streams (${names}); ${Math.round(dist)} km away; ${Math.round(avail).toLocaleString()} t/yr spare capacity${st === 'expiring' ? '; authorization expiring soon' : ''}.` });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ---------- Inspection priority (transparent) ---------- */
export function priorityScore(f: Factory, cr?: ClusterResult) {
  const parts: { label: string; points: number }[] = [];
  parts.push({ label: f.reportStatus === 'never_filed' ? 'Never filed a report' : f.reportStatus === 'overdue' ? 'Report overdue' : 'Report filed', points: f.reportStatus === 'never_filed' ? 35 : f.reportStatus === 'overdue' ? 25 : 0 });
  parts.push({ label: `${f.size} unit`, points: f.size === 'large' ? 20 : f.size === 'medium' ? 10 : 3 });
  const eff = effectiveEntries(f); const tot = eff.reduce((s, e) => s + e.quantityTpa, 0) || 1;
  const hz = eff.filter((e) => PRIORITY_TYPES.has(e.wasteType)).reduce((s, e) => s + e.quantityTpa, 0) / tot;
  parts.push({ label: `Hazardous/e-waste share ${Math.round(hz * 100)}%`, points: Math.round(20 * hz) });
  const cs = cr ? cr.score : 100;
  parts.push({ label: `Poor nearby coverage (${cs}%)`, points: Math.round(25 * (1 - cs / 100)) });
  if (!f.consentValid) parts.push({ label: 'Consent expired', points: 5 });
  const score = Math.min(100, parts.reduce((s, p) => s + p.points, 0));
  return { score, parts };
}

/* ---------- KPIs and alerts ---------- */
export function computeKpis(factories: Factory[], facilities: Facility[], clusters: ClusterResult[], today = new Date()) {
  const reported = factories.filter((f) => f.reportStatus === 'reported').length;
  const rep = clusters.reduce((s, c) => s + c.reportedTpa, 0), est = clusters.reduce((s, c) => s + c.estimatedTpa, 0);
  return {
    factories: factories.length, facilities: facilities.length, reportedPct: Math.round((reported / (factories.length || 1)) * 100),
    estimatedPct: Math.round((est / (rep + est || 1)) * 100), confidencePct: Math.round((rep / (rep + est || 1)) * 100),
    totalTpa: Math.round(rep + est), redClusters: clusters.filter((c) => c.status === 'red').length,
    nearCapacity: facilities.filter((f) => f.utilizationPct >= 90).length,
    expiring: facilities.filter((f) => authState(f, today) !== 'valid').length,
    followUps: factories.length - reported,
  };
}

export interface AlertItem { id: string; severity: 'red' | 'amber'; title: string; detail: string; lat: number; lng: number; zoom: number }
export function buildAlerts(factories: Factory[], facilities: Facility[], clusters: ClusterResult[], today = new Date()): AlertItem[] {
  const a: AlertItem[] = [];
  for (const c of clusters.filter((c) => c.status === 'red').sort((x, y) => x.score - y.score))
    a.push({ id: 'c' + c.cluster.id, severity: 'red', title: `Infrastructure gap: ${c.cluster.name}`, detail: `Coverage ${c.score}%${c.weakest ? ` — weakest stream: ${WASTE_LABEL[c.weakest]} (${Math.round(c.coverage[c.weakest] ?? 0)}%)` : ''}; only ${c.confidencePct}% of waste data is reported.`, lat: c.cluster.lat, lng: c.cluster.lng, zoom: 10 });
  for (const fc of facilities) {
    const st = authState(fc, today), d = daysToExpiry(fc, today);
    if (fc.utilizationPct >= 90) a.push({ id: 'u' + fc.id, severity: 'red', title: `Near capacity: ${fc.name}`, detail: `${fc.utilizationPct}% utilised — only ${Math.round(availableTpa(fc)).toLocaleString()} t/yr spare.`, lat: fc.lat, lng: fc.lng, zoom: 11 });
    if (st !== 'valid') a.push({ id: 'a' + fc.id, severity: st === 'expired' ? 'red' : 'amber', title: `Authorization ${st === 'expired' ? 'expired' : 'expiring'}: ${fc.name}`, detail: st === 'expired' ? 'Facility is excluded from coverage until renewed.' : `Expires in ${d} day(s).`, lat: fc.lat, lng: fc.lng, zoom: 11 });
    if (fc.utilizationPct < 20) a.push({ id: 'i' + fc.id, severity: 'amber', title: `Under-used facility: ${fc.name}`, detail: `Only ${fc.utilizationPct}% utilised while other regions lack capacity — promote matching.`, lat: fc.lat, lng: fc.lng, zoom: 11 });
  }
  const cm = new Map(clusters.map((c) => [c.cluster.id, c]));
  factories.filter((f) => f.reportStatus !== 'reported')
    .map((f) => ({ f, p: priorityScore(f, cm.get(f.clusterId)).score })).sort((x, y) => y.p - x.p).slice(0, 5)
    .forEach(({ f, p }) => a.push({ id: 'f' + f.id, severity: 'amber', title: `High-priority follow-up: ${f.name}`, detail: `Priority ${p}/100 — ${f.reportStatus === 'never_filed' ? 'never filed' : 'report overdue'}.`, lat: f.lat, lng: f.lng, zoom: 12 }));
  return a;
}
