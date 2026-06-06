import type {
  PowerPlant, GeneratorUnit, Busbar, TransmissionLine, Substation,
  InspectionTeam, RepairTeam, GenerationPlan, InspectionWorkOrder,
  RepairWorkOrder, Alert, SettlementData, TopologyData
} from '../types';
import { mockInvoke } from './mock';

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}

const hasElectron = typeof window !== 'undefined' && !!window.electronAPI;

const invoke = async (channel: string, ...args: any[]): Promise<any> => {
  if (hasElectron && window.electronAPI) {
    return window.electronAPI.invoke(channel, ...args);
  }
  return mockInvoke(channel, ...args);
};

export const api = {
  getAll: <T>(table: string): Promise<T[]> => invoke('db:getAll', table),
  getById: <T>(table: string, id: string): Promise<T | null> => invoke('db:getById', table, id),
  create: <T>(table: string, data: any): Promise<T> => invoke('db:create', table, data),
  update: <T>(table: string, id: string, data: any): Promise<T | null> => invoke('db:update', table, id, data),
  remove: <T>(table: string, id: string): Promise<T | null> => invoke('db:delete', table, id),

  getPlants: (): Promise<PowerPlant[]> => invoke('db:getAll', 'powerPlants'),
  getUnits: (): Promise<GeneratorUnit[]> => invoke('db:getAll', 'generatorUnits'),
  getBusbars: (): Promise<Busbar[]> => invoke('db:getAll', 'busbars'),
  getLines: (): Promise<TransmissionLine[]> => invoke('db:getAll', 'transmissionLines'),
  getSubstations: (): Promise<Substation[]> => invoke('db:getAll', 'substations'),
  getInspectionTeams: (): Promise<InspectionTeam[]> => invoke('db:getAll', 'inspectionTeams'),
  getRepairTeams: (): Promise<RepairTeam[]> => invoke('db:getAll', 'repairTeams'),
  getPlans: (): Promise<GenerationPlan[]> => invoke('db:getAll', 'generationPlans'),
  getInspectionOrders: (): Promise<InspectionWorkOrder[]> => invoke('db:getAll', 'inspectionWorkOrders'),
  getRepairOrders: (): Promise<RepairWorkOrder[]> => invoke('db:getAll', 'repairWorkOrders'),
  getAlerts: (): Promise<Alert[]> => invoke('db:getAll', 'alerts'),
  getSettlementData: (): Promise<SettlementData[]> => invoke('db:getAll', 'settlementData'),
  getTopology: (): Promise<TopologyData> => invoke('db:getAll', 'topologyData').then(r => (Array.isArray(r) ? r[0] : r)),

  generatePlan: (params: { date: string; loadForecast: number[]; reserveMargin: number; emissionLimit: number }) =>
    invoke('plan:generate', params),
  approvePlan: (planId: string) => invoke('plan:approve', planId),
  confirmPlan: (planId: string, unitId: string) => invoke('plan:confirm', planId, unitId),

  autoGenerateInspection: () => invoke('inspection:autoGenerate'),
  dispatchRepair: (params: { substationId: string; deviceId: string; faultType: string; affectedLoad: number }) =>
    invoke('fault:dispatchRepair', params),

  exportReport: (month: string) => invoke('report:exportExcel', { month }),
  simulateTick: () => invoke('rt:simulateTick'),

  isElectron: hasElectron,
};
