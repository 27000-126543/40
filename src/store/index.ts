import { create } from 'zustand';
import type {
  PowerPlant, GeneratorUnit, Busbar, TransmissionLine, Substation,
  InspectionTeam, RepairTeam, GenerationPlan, InspectionWorkOrder,
  RepairWorkOrder, Alert, SettlementData, TopologyData
} from '../types';
import { api } from '../api';

interface SystemState {
  plants: PowerPlant[];
  units: GeneratorUnit[];
  busbars: Busbar[];
  lines: TransmissionLine[];
  substations: Substation[];
  inspectionTeams: InspectionTeam[];
  repairTeams: RepairTeam[];
  plans: GenerationPlan[];
  inspectionOrders: InspectionWorkOrder[];
  repairOrders: RepairWorkOrder[];
  alerts: Alert[];
  settlements: SettlementData[];
  topology: TopologyData | null;
  currentUser: { name: string; role: string };
  loading: boolean;
  agcEnabled: boolean;
  soundEnabled: boolean;
  setLoading: (v: boolean) => void;
  setData: (key: string, data: any) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  toggleAGC: () => void;
  toggleSound: () => void;
  refreshAll: () => Promise<void>;
}

export const useStore = create<SystemState>((set, get) => ({
  plants: [],
  units: [],
  busbars: [],
  lines: [],
  substations: [],
  inspectionTeams: [],
  repairTeams: [],
  plans: [],
  inspectionOrders: [],
  repairOrders: [],
  alerts: [],
  settlements: [],
  topology: null,
  currentUser: { name: '调度长', role: 'admin' },
  loading: false,
  agcEnabled: true,
  soundEnabled: true,

  setLoading: (v) => set({ loading: v }),
  setData: (key, data) => set({ [key]: data } as any),
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 500) })),
  acknowledgeAlert: (id) => set((s) => ({
    alerts: s.alerts.map((a) => a.id === id ? { ...a, acknowledged: true } : a),
  })),
  toggleAGC: () => set((s) => ({ agcEnabled: !s.agcEnabled })),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  refreshAll: async () => {
    set({ loading: true });
    try {
      const [plants, units, busbars, lines, substations, teams, rteams, plans, iorders, rorders, alerts, settlements, topology] = await Promise.all([
        api.getPlants(),
        api.getUnits(),
        api.getBusbars(),
        api.getLines(),
        api.getSubstations(),
        api.getInspectionTeams(),
        api.getRepairTeams(),
        api.getPlans(),
        api.getInspectionOrders(),
        api.getRepairOrders(),
        api.getAlerts(),
        api.getSettlementData(),
        api.getTopology(),
      ]);
      set({
        plants, units, busbars, lines, substations,
        inspectionTeams: teams, repairTeams: rteams,
        plans, inspectionOrders: iorders, repairOrders: rorders,
        alerts, settlements, topology, loading: false,
      });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
}));
