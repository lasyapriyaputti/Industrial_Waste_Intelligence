import { Provider, useApp } from '@/store';
import Shell from '@/components/Shell';
import Login from '@/pages/Login';
import Settings from '@/pages/Settings';
import { Alerts, Compliance, FacilitiesPage, GapAnalysis, Overview, Scenario } from '@/pages/Officer';
import { FactoryDashboard, FindFacilities, ReportForm } from '@/pages/Factory';
import { FacilityProfile, FacilityRequests } from '@/pages/Facility';

function Router() {
  const { session, page } = useApp();
  if (!session) return <Login />;
  const pages = {
    overview: <Overview />, gap: <GapAnalysis />, scenario: <Scenario />, compliance: <Compliance />, facilities: <FacilitiesPage />, alerts: <Alerts />, settings: <Settings />,
    'f-dashboard': <FactoryDashboard />, 'f-report': <ReportForm />, 'f-find': <FindFacilities />, 'w-profile': <FacilityProfile />, 'w-requests': <FacilityRequests />,
  } as const;
  return <Shell>{pages[page]}</Shell>;
}
export default function App() { return <Provider><Router /></Provider>; }
