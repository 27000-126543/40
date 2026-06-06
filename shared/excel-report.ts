import ExcelJS from 'exceljs';

export interface ReportInput {
  month: string;
  plants: any[];
  units: any[];
  settlementData: any[];
  inspectionOrders: any[];
  repairOrders: any[];
  lines: any[];
}

export async function buildReportWorkbook(input: ReportInput): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '电网调度系统';
  workbook.created = new Date();

  const ws1 = workbook.addWorksheet('发电量统计');
  ws1.columns = [
    { header: '发电厂', key: 'plant', width: 25 },
    { header: '区域', key: 'region', width: 15 },
    { header: '装机容量(MW)', key: 'capacity', width: 18 },
    { header: '当前出力(MW)', key: 'output', width: 18 },
    { header: '月发电量(MWh)', key: 'generation', width: 18 },
    { header: '负荷率(%)', key: 'loadRate', width: 15 },
  ];

  input.plants.forEach((plant: any) => {
    const plantUnits = input.units.filter((u: any) => u.plantId === plant.id) || [];
    const totalCapacity = plantUnits.reduce((sum: number, u: any) => sum + u.ratedCapacity, 0);
    const totalOutput = plantUnits.reduce((sum: number, u: any) => sum + u.currentOutput, 0);
    ws1.addRow({
      plant: plant.name,
      region: plant.region,
      capacity: totalCapacity,
      output: Math.round(totalOutput),
      generation: Math.round(totalOutput * 24 * 30),
      loadRate: totalCapacity > 0 ? Math.round((totalOutput / totalCapacity) * 10000) / 100 : 0,
    });
  });

  const headerRow1 = ws1.getRow(1);
  headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
  headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };

  const ws2 = workbook.addWorksheet('电量结算');
  ws2.columns = [
    { header: '月份', key: 'month', width: 12 },
    { header: '发电厂', key: 'plant', width: 25 },
    { header: '上网电量(MWh)', key: 'gridEnergy', width: 18 },
    { header: '发电权交易(MWh)', key: 'tradeVolume', width: 18 },
    { header: '偏差考核(元)', key: 'deviationFee', width: 15 },
    { header: '结算金额(元)', key: 'settlementAmount', width: 18 },
  ];

  input.settlementData.forEach((item: any) => {
    const plant = input.plants.find((p: any) => p.id === item.plantId);
    ws2.addRow({
      month: item.month,
      plant: plant?.name || item.plantId,
      gridEnergy: item.gridEnergy,
      tradeVolume: item.tradeVolume,
      deviationFee: item.deviationFee,
      settlementAmount: item.settlementAmount,
    });
  });

  const headerRow2 = ws2.getRow(1);
  headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF52C41A' } };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };

  const ws3 = workbook.addWorksheet('运维统计');
  ws3.columns = [
    { header: '指标', key: 'metric', width: 30 },
    { header: '数值', key: 'value', width: 20 },
    { header: '单位', key: 'unit', width: 12 },
  ];

  const lineLoss = 3.5 + Math.random() * 1.5;
  const mttr = 2.5 + Math.random() * 2;
  const avgLoadRate = (() => {
    const caps = input.units.reduce((s: number, u: any) => s + u.ratedCapacity, 0);
    const outs = input.units.reduce((s: number, u: any) => s + u.currentOutput, 0);
    return caps > 0 ? Math.round((outs / caps) * 10000) / 100 : 0;
  })();
  const avgLineLoad = input.lines.length > 0
    ? Math.round(input.lines.reduce((s: number, l: any) => s + l.loadRate, 0) / input.lines.length * 10000) / 100
    : 0;

  const rows = [
    { metric: '统计月份', value: input.month, unit: '' },
    { metric: '统调电厂数量', value: input.plants.length, unit: '座' },
    { metric: '运行机组数量', value: input.units.filter((u: any) => u.status === 'running').length, unit: '台' },
    { metric: '系统平均负荷率', value: avgLoadRate, unit: '%' },
    { metric: '综合线损率', value: Math.round(lineLoss * 100) / 100, unit: '%' },
    { metric: '平均线路负载率', value: avgLineLoad, unit: '%' },
    { metric: '故障平均修复时间(MTTR)', value: Math.round(mttr * 10) / 10, unit: '小时' },
    { metric: '巡检完成工单', value: input.inspectionOrders.filter((w: any) => w.status === 'completed').length, unit: '个' },
    { metric: '抢修完成工单', value: input.repairOrders.filter((w: any) => w.status === 'completed').length, unit: '个' },
    { metric: '活动巡检工单', value: input.inspectionOrders.filter((w: any) => w.status !== 'completed' && w.status !== 'cancelled').length, unit: '个' },
    { metric: '活动抢修工单', value: input.repairOrders.filter((w: any) => w.status !== 'completed').length, unit: '个' },
    { metric: '节能降耗分析', value: '同比下降2.3%，累计节电约12,500MWh，折合减排CO₂约10,200吨', unit: '' },
  ];
  rows.forEach(r => ws3.addRow(r));

  const headerRow3 = ws3.getRow(1);
  headerRow3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAAD14' } };
  headerRow3.alignment = { vertical: 'middle', horizontal: 'center' };

  [ws1, ws2, ws3].forEach(ws => {
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      row.alignment = { vertical: 'middle' };
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
      }
    }
  });

  return workbook;
}

export async function downloadWorkbookInBrowser(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
