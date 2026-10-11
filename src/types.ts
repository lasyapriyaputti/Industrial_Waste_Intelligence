export type Role = 'officer' | 'factory' | 'facility';
export type WasteType =
  | 'haz_incinerable' | 'haz_chemical' | 'metallic_sludge' | 'used_oil'
  | 'e_waste' | 'plastic' | 'fly_ash' | 'organic' | 'general_solid';
export type Industry =
  | 'pharma' | 'bulk_drugs' | 'chemicals' | 'fertilizer' | 'steel' | 'cement' | 'textile'
  | 'food' | 'paper' | 'electronics' | 'automobile' | 'power' | 'mining' | 'refinery';
export type Size = 'small' | 'medium' | 'large';
export type ReportStatus = 'reported' | 'overdue' | 'never_filed';
export type Disposal = 'landfill' | 'incineration' | 'co_processing' | 'recycling' | 'reuse' | 'stored_onsite' | 'unknown';
export type FacilityType = 'tsdf' | 'tsdf_incinerator' | 'co_processing' | 'recycler_e_waste' | 'recycler_plastic' | 'used_oil_recycler' | 'cetp' | 'fly_ash_unit';

export interface WasteEntry { wasteType: WasteType; quantityTpa: number; disposal: Disposal }
export interface Report { year: number; entries: WasteEntry[]; submittedAt: string }

export interface Cluster { id: string; name: string; district: string; lat: number; lng: number }

export interface Factory {
  id: string; name: string; industry: Industry; size: Size; employees: number;
  lat: number; lng: number; clusterId: string; district: string;
  consentValid: boolean; reportStatus: ReportStatus; lastReportYear: number | null;
  accessCode: string; reports: Report[]; contactEmail: string;
  linkedFacilityId?: string; source: 'simulated';
}
export interface Facility {
  id: string; name: string; type: FacilityType; lat: number; lng: number;
  district: string; accepted: WasteType[]; capacityTpa: number; utilizationPct: number;
  authValidTill: string; contact: string; accessCode: string; source: 'simulated';
}
export interface WasteRequest {
  id: string; factoryId: string; facilityId: string; wasteType: WasteType;
  quantityTpa: number; distanceKm: number; status: 'pending' | 'accepted' | 'rejected'; createdAt: string;
}
export interface AppData {
  factories: Factory[]; facilities: Facility[]; requests: WasteRequest[];
  lastReport: { factoryId: string; at: number } | null;
  version: number;
}
export interface Session { role: Role; id: string }
export type PageId =
  | 'overview' | 'gap' | 'scenario' | 'compliance' | 'facilities' | 'alerts' | 'settings'
  | 'f-dashboard' | 'f-report' | 'f-find' | 'w-profile' | 'w-requests';
