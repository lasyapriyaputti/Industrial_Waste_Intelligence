import type { AppData, Cluster, Disposal, Facility, FacilityType, Factory, Industry, Report, Size, WasteType } from '@/types';
import { REPORT_YEAR, estimateEntries, matchesForFactory } from '@/lib/analysis';

/* All factories, facilities and numbers below are SIMULATED. Cluster centres are real industrial hubs (approximate coordinates);
   every company/facility name is fictional. Replace with APPCB / CPCB / APIIC records for real analysis. */

export const CLUSTERS: (Cluster & { code: string; count: number; reportedRate: number; mix: Industry[] })[] = [
  { id: 'PW', code: 'PW', name: 'Parawada Pharma City', district: 'Anakapalli', lat: 17.60, lng: 83.07, count: 12, reportedRate: 0.25, mix: ['pharma', 'bulk_drugs', 'pharma', 'chemicals', 'bulk_drugs'] },
  { id: 'GJ', code: 'GJ', name: 'Gajuwaka – Autonagar', district: 'Visakhapatnam', lat: 17.69, lng: 83.20, count: 8, reportedRate: 0.4, mix: ['steel', 'refinery', 'chemicals', 'automobile'] },
  { id: 'AT', code: 'AT', name: 'Atchutapuram SEZ', district: 'Anakapalli', lat: 17.55, lng: 82.93, count: 8, reportedRate: 0.4, mix: ['pharma', 'chemicals', 'textile', 'bulk_drugs'] },
  { id: 'KK', code: 'KK', name: 'Kakinada – Surampalem', district: 'Kakinada', lat: 16.99, lng: 82.25, count: 7, reportedRate: 0.45, mix: ['fertilizer', 'chemicals', 'food'] },
  { id: 'RJ', code: 'RJ', name: 'Rajahmundry belt', district: 'East Godavari', lat: 17.00, lng: 81.78, count: 5, reportedRate: 0.4, mix: ['paper', 'food'] },
  { id: 'VJ', code: 'VJ', name: 'Vijayawada – Gannavaram', district: 'NTR', lat: 16.52, lng: 80.65, count: 8, reportedRate: 0.4, mix: ['automobile', 'power', 'steel', 'electronics'] },
  { id: 'GN', code: 'GN', name: 'Guntur – Mangalagiri', district: 'Guntur', lat: 16.35, lng: 80.45, count: 6, reportedRate: 0.4, mix: ['textile', 'food'] },
  { id: 'ON', code: 'ON', name: 'Ongole – Prakasam', district: 'Prakasam', lat: 15.50, lng: 80.05, count: 4, reportedRate: 0.4, mix: ['mining', 'cement', 'food'] },
  { id: 'NL', code: 'NL', name: 'Nellore – Krishnapatnam', district: 'SPSR Nellore', lat: 14.40, lng: 80.02, count: 7, reportedRate: 0.45, mix: ['power', 'chemicals', 'cement', 'food'] },
  { id: 'ST', code: 'ST', name: 'Sri City – Tirupati', district: 'Tirupati', lat: 13.55, lng: 79.95, count: 8, reportedRate: 0.65, mix: ['electronics', 'automobile', 'food', 'electronics'] },
  { id: 'KR', code: 'KR', name: 'Kurnool – Nandyal', district: 'Kurnool', lat: 15.83, lng: 78.04, count: 5, reportedRate: 0.4, mix: ['cement', 'textile', 'food'] },
  { id: 'AN', code: 'AN', name: 'Anantapur – Penukonda', district: 'Sri Sathya Sai', lat: 14.68, lng: 77.60, count: 7, reportedRate: 0.3, mix: ['automobile', 'electronics', 'textile', 'electronics'] },
  { id: 'KD', code: 'KD', name: 'Kadapa – Yerraguntla', district: 'YSR Kadapa', lat: 14.47, lng: 78.82, count: 5, reportedRate: 0.4, mix: ['cement', 'mining', 'power'] },
];

const PREFIX = ['Sri Sai', 'Andhra', 'Godavari', 'Krishna', 'Coastal', 'Deccan', 'Vijaya', 'Lakshmi', 'Venkata', 'Bharat', 'Rayalaseema', 'Pennar', 'Amaravati', 'Navya', 'Surya', 'Tulasi', 'Padma', 'Kalyani', 'Ganga', 'Eastern', 'Southern', 'Hari', 'Mahalakshmi', 'Vishnu', 'Anjaneya', 'Sagar', 'Trinetra', 'Kaveri', 'Sunrise', 'Orion'];
const SUFFIX: Record<Industry, string[]> = {
  pharma: ['Pharma Labs', 'Pharmaceuticals', 'Formulations'], bulk_drugs: ['Bulk Drugs', 'Drugs & Intermediates', 'Active Ingredients'],
  chemicals: ['Chemicals', 'Specialty Chemicals', 'Organics'], fertilizer: ['Fertilizers', 'Agro Chemicals'], steel: ['Steel Works', 'Alloys', 'Rolling Mills'],
  cement: ['Cement', 'Cement Works'], textile: ['Textiles', 'Spinning Mills', 'Processing Mills'], food: ['Foods', 'Agro Foods', 'Oils & Foods'],
  paper: ['Paper Mills', 'Papers & Boards'], electronics: ['Electronics', 'Components', 'Devices'], automobile: ['Auto Components', 'Motors', 'Engineering'],
  power: ['Thermal Power', 'Power Plant'], mining: ['Minerals', 'Granites', 'Mining Co'], refinery: ['Petrochem', 'Refining'],
};
const DISPOSALS: Record<WasteType, Disposal[]> = {
  haz_incinerable: ['incineration', 'co_processing', 'stored_onsite', 'unknown'], haz_chemical: ['landfill', 'co_processing', 'stored_onsite'],
  metallic_sludge: ['landfill', 'recycling', 'stored_onsite'], used_oil: ['recycling', 'reuse'], e_waste: ['recycling', 'stored_onsite'],
  plastic: ['recycling', 'co_processing'], fly_ash: ['reuse', 'landfill'], organic: ['reuse', 'recycling', 'landfill'], general_solid: ['landfill', 'reuse', 'recycling'],
};

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const OFFICER = { id: 'APPCB-OFFICER', code: 'GOV2026', name: 'APPCB Regional Officer (demo)' };

function addDays(d: number) { return new Date(Date.now() + d * 86400000).toISOString().slice(0, 10); }

export function generateSeed(): AppData {
  const r = rng(2026);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const used = new Set<string>();
  const factories: Factory[] = [];
  let n = 0;
  for (const c of CLUSTERS) {
    for (let i = 0; i < c.count; i++) {
      n++;
      const demo = c.id === 'PW' && i < 3;
      const industry: Industry = demo ? (i === 1 ? 'bulk_drugs' : 'pharma') : c.mix[i % c.mix.length];
      const size: Size = demo ? (i === 2 ? 'medium' : 'large') : (['small', 'medium', 'medium', 'large'] as Size[])[Math.floor(r() * 4)];
      let name = '';
      do { name = `${pick(PREFIX)} ${pick(SUFFIX[industry])} (${c.code}-${String(i + 1).padStart(2, '0')})`; } while (used.has(name));
      used.add(name);
      const reported = !demo && r() < c.reportedRate;
      const status = reported ? 'reported' : r() < 0.55 ? 'never_filed' : 'overdue';
      const emp = size === 'small' ? 20 + Math.floor(r() * 70) : size === 'medium' ? 100 + Math.floor(r() * 300) : 500 + Math.floor(r() * 2000);
      const reports: Report[] = reported ? [{
        year: REPORT_YEAR, submittedAt: `2026-0${1 + Math.floor(r() * 6)}-${10 + Math.floor(r() * 18)}`,
        entries: estimateEntries(industry, size).map((e) => ({ wasteType: e.wasteType, quantityTpa: Math.max(1, Math.round(e.quantityTpa * (0.7 + r() * 0.7))), disposal: pick(DISPOSALS[e.wasteType]) })),
      }] : [];
      factories.push({
        id: `AP-F-${String(n).padStart(3, '0')}`, name, industry, size, employees: emp,
        lat: +(c.lat + (r() - 0.5) * 0.12).toFixed(4), lng: +(c.lng + (r() - 0.5) * 0.12).toFixed(4),
        clusterId: c.id, district: c.district, consentValid: r() > 0.12, reportStatus: status,
        lastReportYear: reported ? REPORT_YEAR : status === 'overdue' ? 2023 + Math.floor(r() * 2) : null,
        accessCode: demo ? `DEMO0${i + 1}` : Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(r() * CODE_CHARS.length)]).join(''),
        reports, contactEmail: `compliance@${c.code.toLowerCase()}${n}.example`, source: 'simulated',
      });
    }
  }
  // 4th demo login: a factory that has already reported
  const demoReported = factories.find((f) => f.reportStatus === 'reported' && f.clusterId === 'VJ') ?? factories.find((f) => f.reportStatus === 'reported')!;
  demoReported.accessCode = 'DEMO04';

  const F = (id: string, name: string, type: FacilityType, lat: number, lng: number, district: string, accepted: WasteType[], cap: number, util: number, authDays = 400): Facility => ({
    id, name: `${name} (simulated)`, type, lat, lng, district, accepted, capacityTpa: cap, utilizationPct: util, authValidTill: addDays(authDays),
    contact: `ops@${id.toLowerCase()}.example · +91 00000 00${id.slice(-2)}`, accessCode: `FAC${id.slice(-2)}`, source: 'simulated',
  });
  const facilities: Facility[] = [
    F('AP-W-01', 'Visakhapatnam Common Hazardous Waste TSDF', 'tsdf', 17.66, 83.15, 'Visakhapatnam', ['haz_chemical', 'metallic_sludge', 'used_oil'], 40000, 95),
    F('AP-W-02', 'Atchutapuram Common Effluent Treatment Plant', 'cetp', 17.56, 82.96, 'Anakapalli', ['haz_chemical', 'organic'], 9000, 55),
    F('AP-W-03', 'Vizag Fly Ash Brick Unit', 'fly_ash_unit', 17.72, 83.10, 'Visakhapatnam', ['fly_ash'], 60000, 50),
    F('AP-W-04', 'Vizag Used Oil Recycler', 'used_oil_recycler', 17.70, 83.25, 'Visakhapatnam', ['used_oil'], 5000, 70),
    F('AP-W-05', 'Kakinada Cement Co-processing Unit', 'co_processing', 17.05, 82.28, 'Kakinada', ['general_solid', 'plastic', 'organic'], 25000, 60),
    F('AP-W-06', 'Rajahmundry Plastic Recycler', 'recycler_plastic', 17.03, 81.80, 'East Godavari', ['plastic'], 6000, 45, 21),
    F('AP-W-07', 'Vijayawada E-Waste Recycler', 'recycler_e_waste', 16.55, 80.62, 'NTR', ['e_waste'], 4000, 15),
    F('AP-W-08', 'Vijayawada TSDF & Incinerator', 'tsdf_incinerator', 16.60, 80.70, 'NTR', ['haz_chemical', 'haz_incinerable', 'metallic_sludge'], 30000, 62),
    F('AP-W-09', 'Guntur Textile Effluent & Sludge Facility', 'cetp', 16.28, 80.40, 'Guntur', ['haz_chemical', 'organic', 'plastic'], 12000, 50),
    F('AP-W-10', 'Ongole Co-processing Unit', 'co_processing', 15.52, 80.05, 'Prakasam', ['general_solid', 'fly_ash', 'plastic'], 20000, 40),
    F('AP-W-11', 'Nellore Fly Ash Brick Unit', 'fly_ash_unit', 14.50, 79.97, 'SPSR Nellore', ['fly_ash'], 70000, 45),
    F('AP-W-12', 'Krishnapatnam TSDF & Incinerator', 'tsdf_incinerator', 14.30, 80.10, 'SPSR Nellore', ['haz_chemical', 'haz_incinerable', 'metallic_sludge', 'used_oil'], 35000, 55),
    F('AP-W-13', 'Sri City E-Waste Recycler', 'recycler_e_waste', 13.58, 79.97, 'Tirupati', ['e_waste', 'plastic'], 8000, 40),
    F('AP-W-14', 'Tirupati Metal & Plastic Recycler', 'recycler_plastic', 13.65, 79.45, 'Tirupati', ['plastic', 'metallic_sludge'], 10000, 50),
    F('AP-W-15', 'Kurnool Co-processing Unit', 'co_processing', 15.80, 78.10, 'Kurnool', ['general_solid', 'plastic', 'fly_ash', 'used_oil', 'organic'], 20000, 50),
    F('AP-W-16', 'Kadapa Fly Ash & Cement Co-processing', 'co_processing', 14.50, 78.78, 'YSR Kadapa', ['fly_ash', 'general_solid', 'haz_chemical'], 40000, 45),
    F('AP-W-17', 'Anantapur Plastic & Used Oil Recycler', 'used_oil_recycler', 14.70, 77.62, 'Sri Sathya Sai', ['plastic', 'used_oil'], 3000, 30),
    F('AP-W-18', 'Vijayawada Thermal Fly Ash Utilisation', 'fly_ash_unit', 16.58, 80.55, 'NTR', ['fly_ash'], 80000, 70),
    F('AP-W-19', 'Nellore Organic & General Waste Plant', 'co_processing', 14.45, 79.99, 'SPSR Nellore', ['organic', 'general_solid'], 20000, 40),
  ];

  const data: AppData = { factories, facilities, requests: [], lastReport: null, version: 1 };
  const top = matchesForFactory(demoReported, facilities)[0];
  if (top) data.requests.push({ id: 'REQ-0001', factoryId: demoReported.id, facilityId: top.facility.id, wasteType: top.accepts[0], quantityTpa: 120, distanceKm: top.distanceKm, status: 'pending', createdAt: new Date().toISOString() });
  return data;
}
export const FACILITY_LABEL: Record<FacilityType, string> = {
  tsdf: 'TSDF (landfill)', tsdf_incinerator: 'TSDF + incinerator', co_processing: 'Co-processing', recycler_e_waste: 'E-waste recycler',
  recycler_plastic: 'Plastic recycler', used_oil_recycler: 'Used-oil recycler', cetp: 'Effluent treatment', fly_ash_unit: 'Fly-ash utilisation',
};
