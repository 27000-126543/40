import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

let dbPath: string;
let db: any;

export function initDatabase() {
  const userData = app.getPath('userData');
  dbPath = path.join(userData, 'grid-database.json');
  loadDatabase();
}

function loadDatabase() {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8');
      db = JSON.parse(data);
    } catch (e) {
      db = createDefaultDatabase();
      saveDatabase();
    }
  } else {
    db = createDefaultDatabase();
    saveDatabase();
  }
}

function saveDatabase() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function createDefaultDatabase(): any {
  const now = new Date().toISOString();
  return {
    powerPlants: [
      { id: 'PP001', name: '华能第一火电厂', region: '华北区域', capacity: 2400, type: 'thermal' },
      { id: 'PP002', name: '三峡水力发电厂', region: '华中区域', capacity: 22500, type: 'hydro' },
      { id: 'PP003', name: '酒泉风电场', region: '西北区域', capacity: 1000, type: 'wind' },
      { id: 'PP004', name: '敦煌光伏电站', region: '西北区域', capacity: 800, type: 'solar' },
      { id: 'PP005', name: '岭澳核电站', region: '华南区域', capacity: 4000, type: 'nuclear' },
    ],
    generatorUnits: [
      { id: 'U001', plantId: 'PP001', name: '1号机组', type: 'thermal', ratedCapacity: 600, currentOutput: 480, reactiveOutput: 120, rampRate: 15, minUpTime: 8, status: 'running', maintenanceSchedule: null, emissionRate: 0.85, startCost: 50000 },
      { id: 'U002', plantId: 'PP001', name: '2号机组', type: 'thermal', ratedCapacity: 600, currentOutput: 520, reactiveOutput: 130, rampRate: 15, minUpTime: 8, status: 'running', maintenanceSchedule: null, emissionRate: 0.82, startCost: 50000 },
      { id: 'U003', plantId: 'PP001', name: '3号机组', type: 'thermal', ratedCapacity: 600, currentOutput: 0, reactiveOutput: 0, rampRate: 15, minUpTime: 8, status: 'stopped', maintenanceSchedule: { startDate: '2026-06-10', endDate: '2026-06-20', type: '大修' }, emissionRate: 0.88, startCost: 50000 },
      { id: 'U004', plantId: 'PP001', name: '4号机组', type: 'thermal', ratedCapacity: 600, currentOutput: 450, reactiveOutput: 110, rampRate: 15, minUpTime: 8, status: 'running', maintenanceSchedule: null, emissionRate: 0.80, startCost: 50000 },
      { id: 'U005', plantId: 'PP002', name: '左岸1号', type: 'hydro', ratedCapacity: 700, currentOutput: 650, reactiveOutput: 80, rampRate: 50, minUpTime: 2, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 5000 },
      { id: 'U006', plantId: 'PP002', name: '左岸2号', type: 'hydro', ratedCapacity: 700, currentOutput: 680, reactiveOutput: 85, rampRate: 50, minUpTime: 2, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 5000 },
      { id: 'U007', plantId: 'PP002', name: '右岸1号', type: 'hydro', ratedCapacity: 700, currentOutput: 620, reactiveOutput: 75, rampRate: 50, minUpTime: 2, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 5000 },
      { id: 'U008', plantId: 'PP003', name: '风机群A', type: 'wind', ratedCapacity: 500, currentOutput: 380, reactiveOutput: 50, rampRate: 100, minUpTime: 0, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 1000 },
      { id: 'U009', plantId: 'PP003', name: '风机群B', type: 'wind', ratedCapacity: 500, currentOutput: 420, reactiveOutput: 55, rampRate: 100, minUpTime: 0, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 1000 },
      { id: 'U010', plantId: 'PP004', name: '光伏阵列1区', type: 'solar', ratedCapacity: 400, currentOutput: 350, reactiveOutput: 30, rampRate: 200, minUpTime: 0, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 500 },
      { id: 'U011', plantId: 'PP004', name: '光伏阵列2区', type: 'solar', ratedCapacity: 400, currentOutput: 380, reactiveOutput: 35, rampRate: 200, minUpTime: 0, status: 'running', maintenanceSchedule: null, emissionRate: 0, startCost: 500 },
      { id: 'U012', plantId: 'PP005', name: '核电机组1号', type: 'nuclear', ratedCapacity: 1000, currentOutput: 980, reactiveOutput: 200, rampRate: 5, minUpTime: 720, status: 'running', maintenanceSchedule: null, emissionRate: 0.05, startCost: 500000 },
      { id: 'U013', plantId: 'PP005', name: '核电机组2号', type: 'nuclear', ratedCapacity: 1000, currentOutput: 990, reactiveOutput: 205, rampRate: 5, minUpTime: 720, status: 'running', maintenanceSchedule: null, emissionRate: 0.05, startCost: 500000 },
      { id: 'U014', plantId: 'PP005', name: '核电机组3号', type: 'nuclear', ratedCapacity: 1000, currentOutput: 975, reactiveOutput: 198, rampRate: 5, minUpTime: 720, status: 'running', maintenanceSchedule: null, emissionRate: 0.05, startCost: 500000 },
      { id: 'U015', plantId: 'PP005', name: '核电机组4号', type: 'nuclear', ratedCapacity: 1000, currentOutput: 0, reactiveOutput: 0, rampRate: 5, minUpTime: 720, status: 'maintenance', maintenanceSchedule: { startDate: '2026-06-01', endDate: '2026-06-15', type: '换料大修' }, emissionRate: 0.05, startCost: 500000 },
    ],
    busbars: [
      { id: 'B001', name: '华北500kV母线1', voltage: 505, voltageLimit: { min: 490, max: 525 }, frequency: 50.02 },
      { id: 'B002', name: '华中500kV母线1', voltage: 502, voltageLimit: { min: 490, max: 525 }, frequency: 49.98 },
      { id: 'B003', name: '西北330kV母线1', voltage: 335, voltageLimit: { min: 313, max: 346 }, frequency: 50.01 },
      { id: 'B004', name: '华南500kV母线1', voltage: 508, voltageLimit: { min: 490, max: 525 }, frequency: 50.00 },
    ],
    transmissionLines: [
      { id: 'L001', name: '华能-华北Ⅰ回', from: 'PP001', to: 'B001', voltage: 500, length: 150, loadRate: 0.65, failureRate: 0.02, lastInspection: '2026-05-20', weatherRisk: 'low', status: 'normal' },
      { id: 'L002', name: '三峡-华中Ⅰ回', from: 'PP002', to: 'B002', voltage: 500, length: 80, loadRate: 0.82, failureRate: 0.01, lastInspection: '2026-05-25', weatherRisk: 'medium', status: 'normal' },
      { id: 'L003', name: '酒泉-西北Ⅰ回', from: 'PP003', to: 'B003', voltage: 330, length: 220, loadRate: 0.45, failureRate: 0.05, lastInspection: '2026-04-15', weatherRisk: 'high', status: 'warning' },
      { id: 'L004', name: '敦煌-西北Ⅰ回', from: 'PP004', to: 'B003', voltage: 330, length: 180, loadRate: 0.40, failureRate: 0.03, lastInspection: '2026-05-10', weatherRisk: 'medium', status: 'normal' },
      { id: 'L005', name: '岭澳-华南Ⅰ回', from: 'PP005', to: 'B004', voltage: 500, length: 60, loadRate: 0.88, failureRate: 0.015, lastInspection: '2026-05-28', weatherRisk: 'low', status: 'normal' },
      { id: 'L006', name: '华北-华中联络线', from: 'B001', to: 'B002', voltage: 500, length: 580, loadRate: 0.55, failureRate: 0.025, lastInspection: '2026-05-05', weatherRisk: 'medium', status: 'normal' },
    ],
    substations: [
      { id: 'S001', name: '华北500kV变电站', busbarId: 'B001', location: { lat: 39.9, lng: 116.4 }, devices: [
        { id: 'CB001', type: 'circuitBreaker', name: '1号断路器', status: 'closed', lastCheck: '2026-05-15' },
        { id: 'CB002', type: 'circuitBreaker', name: '2号断路器', status: 'closed', lastCheck: '2026-05-15' },
        { id: 'TR001', type: 'transformer', name: '1号主变', capacity: 750, loadRate: 0.72, temperature: 65, status: 'normal' },
      ]},
      { id: 'S002', name: '华中500kV变电站', busbarId: 'B002', location: { lat: 30.5, lng: 114.3 }, devices: [
        { id: 'CB003', type: 'circuitBreaker', name: '1号断路器', status: 'closed', lastCheck: '2026-05-20' },
        { id: 'TR002', type: 'transformer', name: '1号主变', capacity: 750, loadRate: 0.85, temperature: 72, status: 'warning' },
      ]},
      { id: 'S003', name: '西北330kV变电站', busbarId: 'B003', location: { lat: 40.0, lng: 98.5 }, devices: [
        { id: 'CB004', type: 'circuitBreaker', name: '1号断路器', status: 'closed', lastCheck: '2026-04-20' },
        { id: 'TR003', type: 'transformer', name: '1号主变', capacity: 500, loadRate: 0.58, temperature: 58, status: 'normal' },
      ]},
      { id: 'S004', name: '华南500kV变电站', busbarId: 'B004', location: { lat: 22.5, lng: 114.1 }, devices: [
        { id: 'CB005', type: 'circuitBreaker', name: '1号断路器', status: 'closed', lastCheck: '2026-05-25' },
        { id: 'TR004', type: 'transformer', name: '1号主变', capacity: 750, loadRate: 0.78, temperature: 68, status: 'normal' },
      ]},
    ],
    inspectionTeams: [
      { id: 'T001', name: '华北巡检一班', region: '华北区域', members: 5, hasDrone: true, status: 'available' },
      { id: 'T002', name: '华中巡检一班', region: '华中区域', members: 4, hasDrone: true, status: 'available' },
      { id: 'T003', name: '西北巡检一班', region: '西北区域', members: 6, hasDrone: true, status: 'onDuty' },
      { id: 'T004', name: '华南巡检一班', region: '华南区域', members: 5, hasDrone: true, status: 'available' },
    ],
    repairTeams: [
      { id: 'RT001', name: '华北抢修一组', region: '华北区域', members: 8, location: { lat: 39.92, lng: 116.45 }, vehicleCount: 3, status: 'standby' },
      { id: 'RT002', name: '华中抢修一组', region: '华中区域', members: 7, location: { lat: 30.52, lng: 114.35 }, vehicleCount: 2, status: 'standby' },
      { id: 'RT003', name: '西北抢修一组', region: '西北区域', members: 9, location: { lat: 40.02, lng: 98.55 }, vehicleCount: 3, status: 'standby' },
      { id: 'RT004', name: '华南抢修一组', region: '华南区域', members: 8, location: { lat: 22.52, lng: 114.15 }, vehicleCount: 3, status: 'standby' },
    ],
    sparePartsInventory: [
      { id: 'SP001', name: '500kV断路器', quantity: 5, location: '华北中心库', critical: true },
      { id: 'SP002', name: '500kV变压器', quantity: 2, location: '华中中心库', critical: true },
      { id: 'SP003', name: '330kV绝缘子串', quantity: 50, location: '西北中心库', critical: false },
      { id: 'SP004', name: '避雷器', quantity: 20, location: '各区域库', critical: false },
    ],
    generationPlans: [
      {
        id: 'GP20260606',
        date: '2026-06-06',
        status: 'approved',
        createdAt: now,
        approvedAt: now,
        totalLoadForecast: 18500,
        reserveMargin: 0.15,
        emissionLimit: 5000,
        schedules: [
          { unitId: 'U001', hour0: 450, hour1: 440, hour2: 420, hour3: 400, hour4: 400, hour5: 420, hour6: 450, hour7: 480, hour8: 510, hour9: 530, hour10: 540, hour11: 550, hour12: 540, hour13: 530, hour14: 520, hour15: 520, hour16: 530, hour17: 540, hour18: 550, hour19: 560, hour20: 550, hour21: 530, hour22: 500, hour23: 470, status: 'running' },
          { unitId: 'U002', hour0: 480, hour1: 470, hour2: 450, hour3: 430, hour4: 430, hour5: 450, hour6: 480, hour7: 510, hour8: 540, hour9: 560, hour10: 570, hour11: 580, hour12: 570, hour13: 560, hour14: 550, hour15: 550, hour16: 560, hour17: 570, hour18: 580, hour19: 590, hour20: 580, hour21: 560, hour22: 530, hour23: 500, status: 'running' },
          { unitId: 'U004', hour0: 420, hour1: 410, hour2: 390, hour3: 370, hour4: 370, hour5: 390, hour6: 420, hour7: 450, hour8: 480, hour9: 500, hour10: 510, hour11: 520, hour12: 510, hour13: 500, hour14: 490, hour15: 490, hour16: 500, hour17: 510, hour18: 520, hour19: 530, hour20: 520, hour21: 500, hour22: 470, hour23: 440, status: 'running' },
          { unitId: 'U005', hour0: 600, hour1: 580, hour2: 550, hour3: 520, hour4: 520, hour5: 550, hour6: 600, hour7: 640, hour8: 670, hour9: 690, hour10: 700, hour11: 700, hour12: 690, hour13: 680, hour14: 670, hour15: 670, hour16: 680, hour17: 690, hour18: 700, hour19: 700, hour20: 690, hour21: 670, hour22: 640, hour23: 610, status: 'running' },
          { unitId: 'U006', hour0: 620, hour1: 600, hour2: 570, hour3: 540, hour4: 540, hour5: 570, hour6: 620, hour7: 660, hour8: 690, hour9: 700, hour10: 700, hour11: 700, hour12: 700, hour13: 690, hour14: 680, hour15: 680, hour16: 690, hour17: 700, hour18: 700, hour19: 700, hour20: 700, hour21: 680, hour22: 650, hour23: 630, status: 'running' },
          { unitId: 'U007', hour0: 580, hour1: 560, hour2: 530, hour3: 500, hour4: 500, hour5: 530, hour6: 580, hour7: 620, hour8: 650, hour9: 670, hour10: 680, hour11: 690, hour12: 680, hour13: 670, hour14: 660, hour15: 660, hour16: 670, hour17: 680, hour18: 690, hour19: 690, hour20: 680, hour21: 660, hour22: 630, hour23: 600, status: 'running' },
          { unitId: 'U012', hour0: 980, hour1: 980, hour2: 980, hour3: 980, hour4: 980, hour5: 980, hour6: 980, hour7: 980, hour8: 980, hour9: 980, hour10: 980, hour11: 980, hour12: 980, hour13: 980, hour14: 980, hour15: 980, hour16: 980, hour17: 980, hour18: 980, hour19: 980, hour20: 980, hour21: 980, hour22: 980, hour23: 980, status: 'running' },
          { unitId: 'U013', hour0: 990, hour1: 990, hour2: 990, hour3: 990, hour4: 990, hour5: 990, hour6: 990, hour7: 990, hour8: 990, hour9: 990, hour10: 990, hour11: 990, hour12: 990, hour13: 990, hour14: 990, hour15: 990, hour16: 990, hour17: 990, hour18: 990, hour19: 990, hour20: 990, hour21: 990, hour22: 990, hour23: 990, status: 'running' },
          { unitId: 'U014', hour0: 975, hour1: 975, hour2: 975, hour3: 975, hour4: 975, hour5: 975, hour6: 975, hour7: 975, hour8: 975, hour9: 975, hour10: 975, hour11: 975, hour12: 975, hour13: 975, hour14: 975, hour15: 975, hour16: 975, hour17: 975, hour18: 975, hour19: 975, hour20: 975, hour21: 975, hour22: 975, hour23: 975, status: 'running' },
        ]
      }
    ],
    inspectionWorkOrders: [
      { id: 'WO20260601001', lineId: 'L003', teamId: 'T003', type: 'routine', priority: 'medium', status: 'inProgress', scheduledDate: '2026-06-06', createdAt: '2026-06-01T08:00:00Z', findings: [], hasDroneImagery: false },
      { id: 'WO20260528001', lineId: 'L002', teamId: 'T002', type: 'routine', priority: 'low', status: 'completed', scheduledDate: '2026-05-28', createdAt: '2026-05-20T10:00:00Z', completedDate: '2026-05-28', findings: [{ description: '绝缘子轻微污损', severity: 'low' }], hasDroneImagery: true },
    ],
    repairWorkOrders: [],
    alerts: [
      { id: 'AL001', type: 'voltage', level: 'warning', message: '华中500kV母线1电压接近上限', source: 'B002', timestamp: now, acknowledged: false },
    ],
    settlementData: [
      { id: 'SET001', month: '2026-05', plantId: 'PP001', gridEnergy: 324000, tradeVolume: 15000, deviationFee: 2400, settlementAmount: 12960000 },
      { id: 'SET002', month: '2026-05', plantId: 'PP002', gridEnergy: 4860000, tradeVolume: 200000, deviationFee: 0, settlementAmount: 145800000 },
      { id: 'SET003', month: '2026-05', plantId: 'PP003', gridEnergy: 540000, tradeVolume: 30000, deviationFee: 8500, settlementAmount: 21600000 },
    ],
    operationLogs: [
      { id: 'LOG001', time: now, operator: '系统', action: '系统启动', result: '成功' },
    ],
    topologyData: {
      nodes: [
        { id: 'PP001', name: '华能第一火电厂', type: 'plant', x: 200, y: 300 },
        { id: 'PP002', name: '三峡水力发电厂', type: 'plant', x: 500, y: 500 },
        { id: 'PP003', name: '酒泉风电场', type: 'plant', x: 150, y: 150 },
        { id: 'PP004', name: '敦煌光伏电站', type: 'plant', x: 100, y: 250 },
        { id: 'PP005', name: '岭澳核电站', type: 'plant', x: 800, y: 600 },
        { id: 'B001', name: '华北500kV母线', type: 'busbar', x: 350, y: 250, voltage: 505 },
        { id: 'B002', name: '华中500kV母线', type: 'busbar', x: 550, y: 350, voltage: 502 },
        { id: 'B003', name: '西北330kV母线', type: 'busbar', x: 250, y: 350, voltage: 335 },
        { id: 'B004', name: '华南500kV母线', type: 'busbar', x: 700, y: 500, voltage: 508 },
        { id: 'S001', name: '华北变电站', type: 'substation', x: 400, y: 200 },
        { id: 'S002', name: '华中变电站', type: 'substation', x: 600, y: 450 },
        { id: 'S003', name: '西北变电站', type: 'substation', x: 200, y: 450 },
        { id: 'S004', name: '华南变电站', type: 'substation', x: 750, y: 400 },
      ],
      links: [
        { source: 'PP001', target: 'B001', lineId: 'L001', loadRate: 0.65 },
        { source: 'PP002', target: 'B002', lineId: 'L002', loadRate: 0.82 },
        { source: 'PP003', target: 'B003', lineId: 'L003', loadRate: 0.45 },
        { source: 'PP004', target: 'B003', lineId: 'L004', loadRate: 0.40 },
        { source: 'PP005', target: 'B004', lineId: 'L005', loadRate: 0.88 },
        { source: 'B001', target: 'B002', lineId: 'L006', loadRate: 0.55 },
        { source: 'B001', target: 'S001', loadRate: 0.72 },
        { source: 'B002', target: 'S002', loadRate: 0.85 },
        { source: 'B003', target: 'S003', loadRate: 0.58 },
        { source: 'B004', target: 'S004', loadRate: 0.78 },
      ]
    }
  };
}

export function getDatabase() {
  return db;
}

export function persist() {
  saveDatabase();
}

export function query(sql: string, params?: any[]) {
  return [];
}

export function run(sql: string, params?: any[]) {
  return { lastInsertRowid: 0, changes: 0 };
}
