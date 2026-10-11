
import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Flame,
  Recycle,
  Droplets,
  Cpu,
  Factory as FactoryIcon,
  Layers,
  Fuel,
  ShieldAlert,
} from 'lucide-react';
import type { Facility, FacilityType, Factory } from '@/types';
import { authState, type ClusterResult } from '@/lib/analysis';
import { statusColor } from '@/components/ui';

export type Selection =
  | { type: 'factory' | 'facility' | 'cluster'; id: string }
  | null;

export const BASEMAPS = {
  light: {
    name: 'Light',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri',
  },
} as const;

export type BaseKey = keyof typeof BASEMAPS;

const FAC_ICON: Record<FacilityType, JSX.Element> = {
  tsdf: <ShieldAlert size={15} />,
  tsdf_incinerator: <Flame size={15} />,
  co_processing: <FactoryIcon size={15} />,
  recycler_e_waste: <Cpu size={15} />,
  recycler_plastic: <Recycle size={15} />,
  used_oil_recycler: <Fuel size={15} />,
  cetp: <Droplets size={15} />,
  fly_ash_unit: <Layers size={15} />,
};

const iconCache = new Map<string, L.DivIcon>();

function factoryIcon(
  kind: 'reported' | 'estimated' | 'urgent',
  sel: boolean,
  flash: boolean,
) {
  const key = `f${kind}${sel}${flash}`;

  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: 'iwi-m',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        html: `<div class="iwi-f iwi-f--${kind}${sel ? ' iwi-f--sel' : ''}${flash ? ' iwi-f--flash' : ''}"></div>`,
      }),
    );
  }

  return iconCache.get(key)!;
}

function facilityIcon(fc: Facility, sel: boolean) {
  const warn = fc.utilizationPct >= 90;
  const exp = authState(fc) !== 'valid';
  const key = `w${fc.type}${Math.round(fc.utilizationPct)}${warn}${exp}${sel}`;

  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: 'iwi-m',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div class="iwi-w${warn ? ' iwi-w--warn' : ''}${exp ? ' iwi-w--exp' : ''}${sel ? ' iwi-w--sel' : ''}" style="--p:${fc.utilizationPct};--c:${warn ? '#dc2626' : '#3b82f6'}"><div class="iwi-w-in">${renderToStaticMarkup(FAC_ICON[fc.type])}</div></div>`,
      }),
    );
  }

  return iconCache.get(key)!;
}

const ghostIcon = L.divIcon({
  className: 'iwi-m',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  html: '<div class="iwi-w" style="--p:100;--c:#7c3aed"><div class="iwi-w-in" style="background:#7c3aed">+</div></div>',
});

function Fly({
  focus,
}: {
  focus?: { lat: number; lng: number; zoom: number; key: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], focus.zoom, {
        duration: 1.4,
      });
    }
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function Clicks({
  onClick,
}: {
  onClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => onClick?.(e.latlng.lat, e.latlng.lng),
  });

  return null;
}

export interface MapViewProps {
  factories: Factory[];
  facilities: Facility[];
  clusters?: ClusterResult[];
  urgentIds?: Set<string>;
  layers?: {
    factories: boolean;
    facilities: boolean;
    zones: boolean;
  };
  selected?: Selection;
  onSelect?: (s: Selection) => void;
  focus?: { lat: number; lng: number; zoom: number; key: number };
  lines?: {
    from: [number, number];
    to: [number, number];
    label: string;
  }[];
  radiusKm?: number;
  flashId?: string | null;
  onMapClick?: (lat: number, lng: number) => void;
  ghost?: { lat: number; lng: number } | null;
  base?: BaseKey;
  height?: string | number;
  center?: [number, number];
  zoom?: number;
}

export default function MapView(p: MapViewProps) {
  const layers = p.layers ?? {
    factories: true,
    facilities: true,
    zones: true,
  };

  const base = BASEMAPS[p.base ?? 'light'];

  const selFacility =
    p.selected?.type === 'facility'
      ? p.facilities.find((f) => f.id === p.selected!.id)
      : undefined;

  const facilityReach = useMemo(
    () =>
      selFacility && p.radiusKm
        ? p.factories
            .filter(
              (f) =>
                L.latLng(f.lat, f.lng).distanceTo([
                  selFacility.lat,
                  selFacility.lng,
                ]) <=
                p.radiusKm! * 1000,
            )
            .map((f) => f.id)
        : [],
    [selFacility, p.radiusKm, p.factories],
  );

  const reach = new Set(facilityReach);

  return (
    <MapContainer
      center={p.center ?? [15.9, 79.7]}
      zoom={p.zoom ?? 7}
      minZoom={6}
      maxBounds={[
        [11.5, 75.5],
        [20, 86.5],
      ]}
      style={{
        height: p.height ?? '100%',
        width: '100%',
      }}
      zoomControl
      scrollWheelZoom
    >
      <TileLayer
        key={p.base ?? 'light'}
        url={base.url}
        attribution={base.attr}
        maxZoom={p.base === 'satellite' ? 19 : 19}
      />

      <Fly focus={p.focus} />
      <Clicks onClick={p.onMapClick} />

      {layers.zones &&
        p.clusters?.map((c) => (
          <Circle
            key={c.cluster.id}
            center={[c.cluster.lat, c.cluster.lng]}
            radius={13000}
            pathOptions={{
              color: statusColor[c.status],
              weight:
                p.selected?.type === 'cluster' &&
                p.selected.id === c.cluster.id
                  ? 3
                  : 1.5,
              fillColor: statusColor[c.status],
              fillOpacity: 0.2,
              className: c.status === 'red' ? 'iwi-zone-red' : '',
            }}
            eventHandlers={{
              click: () =>
                p.onSelect?.({
                  type: 'cluster',
                  id: c.cluster.id,
                }),
            }}
          >
            <Tooltip sticky className="iwi-tip">
              {c.cluster.name} · coverage {c.score}%
            </Tooltip>
          </Circle>
        ))}

      {selFacility && p.radiusKm && (
        <Circle
          center={[selFacility.lat, selFacility.lng]}
          radius={p.radiusKm * 1000}
          pathOptions={{
            color: '#2563eb',
            weight: 1.5,
            dashArray: '6 6',
            fillOpacity: 0.05,
          }}
        />
      )}

      {layers.factories &&
        p.factories.map((f) => {
          const kind =
            f.reportStatus === 'reported'
              ? 'reported'
              : p.urgentIds?.has(f.id)
                ? 'urgent'
                : 'estimated';

          const sel =
            p.selected?.type === 'factory' &&
            p.selected.id === f.id;

          return (
            <Marker
              key={f.id}
              position={[f.lat, f.lng]}
              icon={factoryIcon(
                kind,
                sel || reach.has(f.id),
                p.flashId === f.id,
              )}
              zIndexOffset={sel ? 1000 : 0}
              eventHandlers={{
                click: () =>
                  p.onSelect?.({
                    type: 'factory',
                    id: f.id,
                  }),
              }}
            >
              <Tooltip
                className="iwi-tip"
                direction="top"
                offset={[0, -8]}
              >
                {f.name} ·{' '}
                {f.reportStatus === 'reported'
                  ? 'reported'
                  : 'estimated'}
              </Tooltip>
            </Marker>
          );
        })}

      {layers.facilities &&
        p.facilities.map((fc) => (
          <Marker
            key={fc.id}
            position={[fc.lat, fc.lng]}
            icon={facilityIcon(
              fc,
              p.selected?.type === 'facility' &&
                p.selected.id === fc.id,
            )}
            zIndexOffset={500}
            eventHandlers={{
              click: () =>
                p.onSelect?.({
                  type: 'facility',
                  id: fc.id,
                }),
            }}
          >
            <Tooltip
              className="iwi-tip"
              direction="top"
              offset={[0, -14]}
            >
              {fc.name} · {fc.utilizationPct}% used
            </Tooltip>
          </Marker>
        ))}

      {p.lines?.map((l, i) => (
        <Polyline
          key={i}
          positions={[l.from, l.to]}
          pathOptions={{
            color: '#7c3aed',
            weight: 3,
            className: 'iwi-dash',
          }}
        >
          <Tooltip permanent direction="center" className="iwi-tip">
            {l.label}
          </Tooltip>
        </Polyline>
      ))}

      {p.ghost && (
        <Marker
          position={[p.ghost.lat, p.ghost.lng]}
          icon={ghostIcon}
          zIndexOffset={2000}
        />
      )}
    </MapContainer>
  );
}
