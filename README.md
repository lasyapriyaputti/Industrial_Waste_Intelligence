# IndustrialWasteIntelligence — Andhra Pradesh prototype

**Missing reports → data gap → infrastructure gap.** The platform estimates what non-reporting factories generate,
lets factories report in a minute, lets facilities declare capacity, matches waste to facilities and shows where
treatment infrastructure is missing — recalculating live with every report.

Track: **Waste & Energy** · Pilot region: **Andhra Pradesh** (13 real industrial hubs).

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
```

## Deploy on AWS (the one AWS tool: AWS Amplify Hosting)
1. Push this folder to a GitHub repo.
2. AWS Console → **AWS Amplify** → *Create new app* → *Host web app* → connect the repo/branch.
3. Amplify auto-detects `amplify.yml` (included). Click *Save and deploy*.
4. Open the generated `https://<branch>.<id>.amplifyapp.com` URL. **Show this URL and the Amplify console in your demo video.**

(Alternative without GitHub: `npm run build`, zip the contents of `dist/`, and use Amplify → *Deploy without Git*.)

## Demo access (login with ID + code, no sign-up)
| Role | ID | Code | Notes |
|---|---|---|---|
| Officer | APPCB-OFFICER | GOV2026 | Full map, gap analysis, scenario, compliance |
| Factory | AP-F-001 / 002 / 003 | DEMO01 / 02 / 03 | In the red Parawada cluster, **not reported** |
| Factory | shown on login page | DEMO04 | Already reported (Vijayawada), has a pending request |
| Facility | AP-W-01 … | FAC01 … | e.g. AP-W-08 / FAC08 (TSDF + incinerator) |

## 3-minute demo script
1. **Problem (20s):** "Authorities know which factories exist, but 56% haven't filed proper waste reports."
2. **Overview map (30s):** dashed/faded markers = estimates, solid green = reported. KPI: 57% of waste data is estimated.
3. **Story mode (40s):** click *Story mode* → Parawada is a red gap: no incinerator within reach, 1% of data reported.
4. **Live loop (50s):** keep the officer tab open. In a **second browser tab** log in as `AP-F-001 / DEMO01` →
   *Submit Annual Report* → *Start from the estimate* → change a quantity → Submit. The factory sees coverage `27% → 30%`;
   the officer tab updates by itself (marker turns solid, "% reported" rises, pulse ring).
5. **Plan (30s):** *Add-a-Facility Scenario* → *Try Parawada* → coverage jumps (Parawada 30% → 100%).
6. **AWS + impact (10s):** show the Amplify URL; "every report makes the infrastructure picture more accurate."
Use *Settings → Reset data* (officer) before recording.

## What is built
- ID + access-code login with 3 roles (officer / factory / facility); each role sees only its own pages.
- 90 simulated factories in 13 real AP clusters; 19 simulated authorized facilities; ~56% factories not reporting.
- **Estimation engine** (industry × size peer averages, confidence label) — Estimated vs Reported badges everywhere.
- **Gap analysis**: cluster coverage = shared spare capacity of compatible facilities within a radius ÷ demand. Radius slider 25–250 km.
- **Live recalculation**: reports/capacity updates change the map; open tabs sync automatically.
- **Matching** with explainable "why" text; factories can request collection, facilities accept/decline (utilisation updates).
- **Compliance**: transparent inspection-priority score with breakdown, reminders (mock), CSV export. Alerts feed.
- **Add-a-Facility scenario** with before/after coverage. **Story mode** guided camera tour.
- Map: 3 basemaps, cluster zones (pulsing when red), utilisation rings, animated match lines, filters, search, fly-to.

## Honest limitations / roadmap
- **Data is simulated.** Cluster centres are real hubs (approximate); all company/facility names are fictional.
  Replace with APPCB consent & annual-return records, CPCB authorized TSDF/recycler lists, APIIC park lists, OpenStreetMap.
- Data lives in the browser (`localStorage`), so "live sync" works across tabs of the same browser — not between different users/devices.
  Next step: API Gateway + Lambda + DynamoDB (schema mirrors `src/types.ts`).
- Login is demo-only (codes are in the client). Production: Cognito/OTP and server-side authorization.
- Roadmap: manifest tracking, satellite/sensor verification, anomaly detection, forecasting, Strands Agents Q&A assistant.
