export interface PowerPlant {
  id: string;
  name: string;
  region: string;
  capacity: number;
  type: 'thermal' | 'hydro' | 'wind' | 'solar' | 'nuclear';
}

export interface GeneratorUnit {
  id: string;
  plantId: string;
  name: string;
  type: 'thermal' | 'hydro' | 'wind' | 'solar' | 'nuclear';
  ratedCapacity: number;
  currentOutput: number;
  reactiveOutput: number;
  rampRate: number;
  minUpTime: number;
  status: 'running' | 'stopped' | 'maintenance' | 'fault';
  maintenanceSchedule: {
    startDate: string;
    endDate: string;
    type: string;
  } | null;
  emissionRate: number;
  startCost: number;
}

export interface Busbar {
  id: string;
  name: string;
  voltage: number;
  voltageLimit: { min: number; max: number };
  frequency: number;
}

export interface TransmissionLine {
  id: string;
  name: string;
  from: string;
  to: string;
  voltage: number;
  length: number;
  loadRate: number;
  failureRate: number;
  lastInspection: string;
  weatherRisk: 'low' | 'medium' | 'high';
  status: 'normal' | 'warning' | 'fault';
}

export interface SubstationDevice {
  id: string;
  type: 'circuitBreaker' | 'transformer' | 'disconnector' | 'arrester';
  name: string;
  status: string;
  lastCheck?: string;
  capacity?: number;
  loadRate?: number;
  temperature?: number;
}

export interface Substation {
  id: string;
  name: string;
  busbarId: string;
  location: { lat: number; lng: number };
  devices: SubstationDevice[];
}

export interface InspectionTeam {
  id: string;
  name: string;
  region: string;
  members: number;
  hasDrone: boolean;
  status: 'available' | 'onDuty' | 'offDuty';
}

export interface RepairTeam {
  id: string;
  name: string;
  region: string;
  members: number;
  location: { lat: number; lng: number };
  vehicleCount: number;
  status: 'standby' | 'onMission' | 'maintenance';
}

export interface UnitSchedule {
  unitId: string;
  hour0?: number;
  hour1?: number;
  hour2?: number;
  hour3?: number;
  hour4?: number;
  hour5?: number;
  hour6?: number;
  hour7?: number;
  hour8?: number;
  hour9?: number;
  hour10?: number;
  hour11?: number;
  hour12?: number;
  hour13?: number;
  hour14?: number;
  hour15?: number;
  hour16?: number;
  hour17?: number;
  hour18?: number;
  hour19?: number;
  hour20?: number;
  hour21?: number;
  hour22?: number;
  hour23?: number;
  [hour: string]: number | string | boolean | undefined;
  status: string;
  confirmed?: boolean;
  confirmedAt?: string;
}

export interface GenerationPlan {
  id: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'distributed';
  createdAt: string;
  approvedAt?: string;
  totalLoadForecast: number;
  reserveMargin: number;
  emissionLimit: number;
  totalEmission?: number;
  totalStartCost?: number;
  schedules: UnitSchedule[];
  distributed?: boolean;
}

export interface InspectionFinding {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface InspectionWorkOrder {
  id: string;
  lineId: string;
  teamId: string;
  type: 'routine' | 'urgent' | 'special';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'inProgress' | 'completed' | 'cancelled';
  scheduledDate: string;
  createdAt: string;
  completedDate?: string;
  findings: InspectionFinding[];
  hasDroneImagery: boolean;
}

export interface RepairWorkOrder {
  id: string;
  substationId: string;
  deviceId: string;
  faultType: string;
  affectedLoad: number;
  teamId: string;
  status: 'pending' | 'dispatched' | 'inProgress' | 'completed';
  priority: 'medium' | 'high' | 'critical';
  createdAt: string;
  spareParts: string[];
  estimatedArrival: number;
  completedAt?: string;
}

export interface Alert {
  id: string;
  type: 'voltage' | 'frequency' | 'output' | 'temperature' | 'equipment';
  level: 'info' | 'warning' | 'critical';
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface SettlementData {
  id: string;
  month: string;
  plantId: string;
  gridEnergy: number;
  tradeVolume: number;
  deviationFee: number;
  settlementAmount: number;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: 'plant' | 'busbar' | 'substation' | 'load';
  x: number;
  y: number;
  voltage?: number;
}

export interface TopologyLink {
  source: string;
  target: string;
  lineId?: string;
  loadRate?: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
}
