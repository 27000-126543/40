import { IpcMain, Dialog } from 'electron';
import { getDatabase, persist } from './database';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { generateUnitCommitment, type GenerationParams } from '../shared/scheduling';

export function registerIpcHandlers(ipcMain: IpcMain, dialog: Dialog) {
  const db = () => getDatabase();

  ipcMain.handle('db:getAll', async (_event, tableName: string) => {
    const database = db();
    return database[tableName] || [];
  });

  ipcMain.handle('db:getById', async (_event, tableName: string, id: string) => {
    const database = db();
    const table = database[tableName] || [];
    return table.find((item: any) => item.id === id) || null;
  });

  ipcMain.handle('db:create', async (_event, tableName: string, data: any) => {
    const database = db();
    if (!database[tableName]) database[tableName] = [];
    database[tableName].push(data);
    persist();
    return data;
  });

  ipcMain.handle('db:update', async (_event, tableName: string, id: string, data: any) => {
    const database = db();
    const table = database[tableName] || [];
    const idx = table.findIndex((item: any) => item.id === id);
    if (idx !== -1) {
      table[idx] = { ...table[idx], ...data };
      persist();
      return table[idx];
    }
    return null;
  });

  ipcMain.handle('db:delete', async (_event, tableName: string, id: string) => {
    const database = db();
    const table = database[tableName] || [];
    const idx = table.findIndex((item: any) => item.id === id);
    if (idx !== -1) {
      const deleted = table.splice(idx, 1)[0];
      persist();
      return deleted;
    }
    return null;
  });

  ipcMain.handle('plan:generate', async (_event, params: GenerationParams) => {
    const database = db();
    const units = database.generatorUnits.filter((u: any) => u.status !== 'maintenance');
    const { schedules, totalEmission, totalStartCost } = generateUnitCommitment(units, params);

    const plan = {
      id: `GP${params.date.replace(/-/g, '')}`,
      date: params.date,
      status: 'pending',
      createdAt: new Date().toISOString(),
      totalLoadForecast: params.loadForecast.reduce((a, b) => a + b, 0) / 24,
      reserveMargin: params.reserveMargin,
      emissionLimit: params.emissionLimit,
      totalEmission,
      totalStartCost,
      schedules,
    };

    if (!database.generationPlans) database.generationPlans = [];
    database.generationPlans.push(plan);
    persist();
    return plan;
  });

  ipcMain.handle('plan:approve', async (_event, planId: string) => {
    const database = db();
    const plan = database.generationPlans?.find((p: any) => p.id === planId);
    if (plan) {
      plan.status = 'approved';
      plan.approvedAt = new Date().toISOString();
      plan.distributed = true;
      persist();
      return plan;
    }
    return null;
  });

  ipcMain.handle('plan:confirm', async (_event, planId: string, unitId: string) => {
    const database = db();
    const plan = database.generationPlans?.find((p: any) => p.id === planId);
    if (plan) {
      const schedule = plan.schedules.find((s: any) => s.unitId === unitId);
      if (schedule) {
        schedule.confirmed = true;
        schedule.confirmedAt = new Date().toISOString();
        persist();
      }
    }
    return plan;
  });

  ipcMain.handle('inspection:autoGenerate', async () => {
    const database = db();
    const orders: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    database.transmissionLines?.forEach((line: any) => {
      const riskScore = line.failureRate * 10 + (line.weatherRisk === 'high' ? 3 : line.weatherRisk === 'medium' ? 1 : 0);
      const lastDate = new Date(line.lastInspection);
      const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      if (riskScore > 1.5 || daysSince > 30) {
        const availableTeam = database.inspectionTeams?.find((t: any) => t.status === 'available');
        if (availableTeam) {
          const order = {
            id: `WO${Date.now()}${Math.floor(Math.random() * 1000)}`,
            lineId: line.id,
            teamId: availableTeam.id,
            type: riskScore > 3 ? 'urgent' : 'routine',
            priority: riskScore > 3 ? 'high' : riskScore > 1.5 ? 'medium' : 'low',
            status: 'pending',
            scheduledDate: today,
            createdAt: new Date().toISOString(),
            findings: [],
            hasDroneImagery: false,
          };
          if (!database.inspectionWorkOrders) database.inspectionWorkOrders = [];
          database.inspectionWorkOrders.push(order);
          orders.push(order);
        }
      }
    });

    persist();
    return orders;
  });

  ipcMain.handle('fault:dispatchRepair', async (_event, params: {
    substationId: string;
    deviceId: string;
    faultType: string;
    affectedLoad: number;
  }) => {
    const database = db();
    const substation = database.substations?.find((s: any) => s.id === params.substationId);
    if (!substation) return null;

    let nearestTeam: any = null;
    let minDistance = Infinity;

    database.repairTeams?.forEach((team: any) => {
      if (team.status === 'standby') {
        const dist = Math.sqrt(
          Math.pow(team.location.lat - substation.location.lat, 2) +
          Math.pow(team.location.lng - substation.location.lng, 2)
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestTeam = team;
        }
      }
    });

    if (!nearestTeam) return null;

    const order = {
      id: `RWO${Date.now()}`,
      substationId: params.substationId,
      deviceId: params.deviceId,
      faultType: params.faultType,
      affectedLoad: params.affectedLoad,
      teamId: nearestTeam.id,
      status: 'dispatched',
      priority: params.affectedLoad > 100 ? 'critical' : params.affectedLoad > 50 ? 'high' : 'medium',
      createdAt: new Date().toISOString(),
      spareParts: [],
      estimatedArrival: Math.round(minDistance * 10),
    };

    if (!database.repairWorkOrders) database.repairWorkOrders = [];
    database.repairWorkOrders.push(order);

    nearestTeam.status = 'onMission';
    persist();
    return order;
  });

  ipcMain.handle('report:exportExcel', async (_event, params: { month: string }) => {
    const database = db();
    const result = await dialog.showSaveDialog({
      title: '导出月度运营报告',
      defaultPath: `电网运营报告_${params.month}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });

    if (result.canceled || !result.filePath) return null;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '电网调度系统';
    workbook.created = new Date();

    const ws1 = workbook.addWorksheet('发电量统计');
    ws1.columns = [
      { header: '发电厂', key: 'plant', width: 25 },
      { header: '区域', key: 'region', width: 15 },
      { header: '发电量(MWh)', key: 'generation', width: 18 },
      { header: '负荷率(%)', key: 'loadRate', width: 15 },
    ];

    database.powerPlants?.forEach((plant: any) => {
      const plantUnits = database.generatorUnits?.filter((u: any) => u.plantId === plant.id) || [];
      const totalCapacity = plantUnits.reduce((sum: number, u: any) => sum + u.ratedCapacity, 0);
      const totalOutput = plantUnits.reduce((sum: number, u: any) => sum + u.currentOutput, 0);
      ws1.addRow({
        plant: plant.name,
        region: plant.region,
        generation: Math.round(totalOutput * 24 * 30),
        loadRate: totalCapacity > 0 ? Math.round((totalOutput / totalCapacity) * 10000) / 100 : 0,
      });
    });

    const ws2 = workbook.addWorksheet('电量结算');
    ws2.columns = [
      { header: '月份', key: 'month', width: 12 },
      { header: '发电厂', key: 'plant', width: 25 },
      { header: '上网电量(MWh)', key: 'gridEnergy', width: 18 },
      { header: '发电权交易(MWh)', key: 'tradeVolume', width: 18 },
      { header: '偏差考核(元)', key: 'deviationFee', width: 15 },
      { header: '结算金额(元)', key: 'settlementAmount', width: 18 },
    ];

    database.settlementData?.forEach((item: any) => {
      const plant = database.powerPlants?.find((p: any) => p.id === item.plantId);
      ws2.addRow({
        month: item.month,
        plant: plant?.name || item.plantId,
        gridEnergy: item.gridEnergy,
        tradeVolume: item.tradeVolume,
        deviationFee: item.deviationFee,
        settlementAmount: item.settlementAmount,
      });
    });

    const ws3 = workbook.addWorksheet('运维统计');
    ws3.columns = [
      { header: '指标', key: 'metric', width: 25 },
      { header: '数值', key: 'value', width: 20 },
      { header: '单位', key: 'unit', width: 10 },
    ];

    const lineLoss = 3.5 + Math.random() * 1.5;
    const mttr = 2.5 + Math.random() * 2;
    ws3.addRow({ metric: '综合线损率', value: Math.round(lineLoss * 100) / 100, unit: '%' });
    ws3.addRow({ metric: '故障平均修复时间(MTTR)', value: Math.round(mttr * 10) / 10, unit: '小时' });
    ws3.addRow({ metric: '巡检完成工单', value: database.inspectionWorkOrders?.filter((w: any) => w.status === 'completed').length || 0, unit: '个' });
    ws3.addRow({ metric: '抢修完成工单', value: database.repairWorkOrders?.filter((w: any) => w.status === 'completed').length || 0, unit: '个' });
    ws3.addRow({ metric: '节能降耗分析', value: '同比下降2.3%', unit: '' });

    await workbook.xlsx.writeFile(result.filePath);
    return result.filePath;
  });

  ipcMain.handle('rt:simulateTick', async () => {
    const database = db();
    const events: any[] = [];

    database.generatorUnits?.forEach((unit: any) => {
      if (unit.status === 'running') {
        const delta = (Math.random() - 0.5) * unit.rampRate * 0.5;
        unit.currentOutput = Math.max(unit.ratedCapacity * 0.2, Math.min(unit.ratedCapacity, unit.currentOutput + delta));
        unit.currentOutput = Math.round(unit.currentOutput * 10) / 10;
        unit.reactiveOutput = Math.round((unit.currentOutput * 0.2 + (Math.random() - 0.5) * 20) * 10) / 10;
      }
    });

    database.busbars?.forEach((bus: any) => {
      const baseFreq = 50;
      const freqDelta = (Math.random() - 0.5) * 0.1;
      bus.frequency = Math.round((baseFreq + freqDelta) * 100) / 100;
      const baseVolt = bus.voltageLimit.max - (bus.voltageLimit.max - bus.voltageLimit.min) * 0.4;
      const voltDelta = (Math.random() - 0.5) * 5;
      bus.voltage = Math.round((baseVolt + voltDelta) * 10) / 10;

      if (bus.voltage < bus.voltageLimit.min || bus.voltage > bus.voltageLimit.max) {
        events.push({
          id: `AL${Date.now()}${Math.random()}`,
          type: 'voltage',
          level: bus.voltage < bus.voltageLimit.min - 3 || bus.voltage > bus.voltageLimit.max + 3 ? 'critical' : 'warning',
          message: `${bus.name}电压越限: ${bus.voltage}kV`,
          source: bus.id,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }
      if (Math.abs(bus.frequency - 50) > 0.2) {
        events.push({
          id: `AL${Date.now()}${Math.random()}`,
          type: 'frequency',
          level: Math.abs(bus.frequency - 50) > 0.5 ? 'critical' : 'warning',
          message: `${bus.name}频率异常: ${bus.frequency}Hz`,
          source: bus.id,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        });
      }
    });

    database.transmissionLines?.forEach((line: any) => {
      line.loadRate = Math.max(0.1, Math.min(0.98, line.loadRate + (Math.random() - 0.5) * 0.05));
      line.loadRate = Math.round(line.loadRate * 1000) / 1000;
    });

    if (events.length > 0) {
      if (!database.alerts) database.alerts = [];
      database.alerts.unshift(...events);
      if (database.alerts.length > 500) database.alerts.length = 500;
    }

    persist();
    return { events };
  });
}
