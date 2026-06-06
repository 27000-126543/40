import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Button, Space, Select, DatePicker, Typography,
  Tabs, Table, Tag, App as AntApp, Progress, Alert,
} from 'antd';
import {
  BarChartOutlined, ThunderboltOutlined, RiseOutlined,
  FileExcelOutlined, EnvironmentOutlined, ClockCircleOutlined,
  ToolOutlined, SafetyOutlined, DashboardOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const Statistics: React.FC = () => {
  const { message } = AntApp.useApp();
  const { plants, units, lines, settlements, repairOrders, inspectionOrders } = useStore();
  const [region, setRegion] = useState<string>('all');
  const [reportMonth, setReportMonth] = useState<string>(dayjs().format('YYYY-MM'));

  const regions = ['all', ...new Set(plants.map(p => p.region))];

  const stats = useMemo(() => {
    const filteredPlants = region === 'all' ? plants : plants.filter(p => p.region === region);
    const filteredUnits = units.filter(u => filteredPlants.some(p => p.id === u.plantId));

    const totalCapacity = filteredUnits.reduce((s, u) => s + u.ratedCapacity, 0);
    const totalOutput = filteredUnits.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0);
    const loadRate = totalCapacity > 0 ? (totalOutput / totalCapacity) * 100 : 0;

    const monthlyEnergy = totalOutput * 24 * 30;
    const lineLoss = 3.5 + Math.random() * 1.5;
    const mttr = 2.5 + Math.random() * 2;
    const completedRepairs = repairOrders.filter(o => o.status === 'completed').length;
    const completedInspections = inspectionOrders.filter(o => o.status === 'completed').length;

    const energySaved = monthlyEnergy * 0.023;

    return {
      totalCapacity,
      totalOutput: Math.round(totalOutput),
      loadRate: Math.round(loadRate * 10) / 10,
      monthlyEnergy: Math.round(monthlyEnergy),
      lineLoss: Math.round(lineLoss * 100) / 100,
      mttr: Math.round(mttr * 10) / 10,
      completedRepairs,
      completedInspections,
      energySaved: Math.round(energySaved),
      co2Saved: Math.round(energySaved * 0.85),
    };
  }, [region, plants, units, repairOrders, inspectionOrders]);

  const regionEnergyOption = useMemo(() => {
    const regionData: Record<string, { gen: number; load: number }> = {};
    regions.filter(r => r !== 'all').forEach(r => {
      const rUnits = units.filter(u => plants.find(p => p.id === u.plantId)?.region === r);
      regionData[r] = {
        gen: rUnits.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0),
        load: rUnits.reduce((s, u) => s + u.ratedCapacity, 0),
      };
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['发电量', '装机容量'], top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: Object.keys(regionData) },
      yAxis: { type: 'value', name: 'MW' },
      series: [
        { name: '发电量', type: 'bar', data: Object.values(regionData).map(d => Math.round(d.gen)), itemStyle: { color: '#52c41a' }, barWidth: 30 },
        { name: '装机容量', type: 'bar', data: Object.values(regionData).map(d => d.load), itemStyle: { color: '#1677ff' }, barWidth: 30 },
      ],
    };
  }, [regions, plants, units]);

  const hourlyLoadOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const workday = hours.map((_, h) => Math.round(10000 + 5000 * Math.sin((h - 6) * Math.PI / 12) + (h >= 8 && h <= 18 ? 2000 : 0)));
    const weekend = hours.map((_, h) => Math.round(8000 + 4000 * Math.sin((h - 8) * Math.PI / 12)));

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['工作日', '周末'], top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: hours },
      yAxis: { type: 'value', name: 'MW' },
      series: [
        { name: '工作日', type: 'line', smooth: true, data: workday, areaStyle: { opacity: 0.3 }, itemStyle: { color: '#1677ff' } },
        { name: '周末', type: 'line', smooth: true, data: weekend, areaStyle: { opacity: 0.3 }, itemStyle: { color: '#52c41a' } },
      ],
    };
  }, []);

  const lineLossOption = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => dayjs().subtract(5 - i, 'month').format('YYYY-MM'));
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value', name: '%', min: 2, max: 6 },
      series: [{
        name: '线损率',
        type: 'line',
        smooth: true,
        data: months.map(() => (3.2 + Math.random() * 1.5).toFixed(2)),
        areaStyle: { opacity: 0.3, color: '#722ed1' },
        itemStyle: { color: '#722ed1' },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed' },
          data: [{ yAxis: 5, label: { formatter: '考核线 5%' } }],
        },
      }],
    };
  }, []);

  const mttrOption = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => dayjs().subtract(5 - i, 'month').format('YYYY-MM'));
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value', name: '小时' },
      series: [{
        name: 'MTTR',
        type: 'bar',
        data: months.map(() => Math.round((2 + Math.random() * 3) * 10) / 10),
        itemStyle: { color: '#fa8c16' },
        barWidth: 35,
      }],
    };
  }, []);

  const typeEnergyOption = useMemo(() => {
    const types: Record<string, number> = { thermal: 0, hydro: 0, nuclear: 0, wind: 0, solar: 0 };
    const names: Record<string, string> = { thermal: '火电', hydro: '水电', nuclear: '核电', wind: '风电', solar: '光伏' };
    const colors: Record<string, string> = { thermal: '#ff7875', hydro: '#69b1ff', nuclear: '#b37feb', wind: '#95de64', solar: '#ffd666' };

    units.forEach(u => {
      if (u.status === 'running') types[u.type] += u.currentOutput;
    });

    const data = Object.entries(types).map(([k, v]) => ({
      name: names[k],
      value: Math.round(v * 24 * 30),
      itemStyle: { color: colors[k] },
    })).filter(d => d.value > 0);

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} MWh ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        label: { formatter: '{b}\n{d}%' },
        data,
      }],
    };
  }, [units]);

  const handleExportReport = async () => {
    const result = await api.exportReport(reportMonth);
    if (result) {
      message.success(`月度运营报告已导出至: ${result}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">统计分析与节能降耗</h2>
        <Space>
          <Select value={region} onChange={setRegion} style={{ width: 150 }}>
            <Option value="all">全部区域</Option>
            {regions.filter(r => r !== 'all').map(r => <Option key={r} value={r}>{r}</Option>)}
          </Select>
          <DatePicker picker="month" value={dayjs(reportMonth)} onChange={(v) => v && setReportMonth(v.format('YYYY-MM'))} />
          <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportReport}>
            导出Excel月度报告
          </Button>
        </Space>
      </div>

      <Alert
        type="success"
        showIcon
        icon={<SafetyOutlined />}
        message={`节能降耗分析 ${reportMonth}`}
        description={`本月综合能耗同比下降 2.3%，累计节电约 ${stats.energySaved.toLocaleString()} MWh，折合减排 CO₂ ${stats.co2Saved.toLocaleString()} 吨。线损率 ${stats.lineLoss}% 较上月下降 0.15%。`}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="总装机容量" value={stats.totalCapacity.toLocaleString()} suffix="MW" prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="当前出力" value={stats.totalOutput.toLocaleString()} suffix="MW" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="负荷率" value={stats.loadRate} suffix="%" valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="月发电量" value={stats.monthlyEnergy.toLocaleString()} suffix="MWh" prefix={<RiseOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="线损率" value={stats.lineLoss} suffix="%" valueStyle={{ color: stats.lineLoss > 5 ? '#ff4d4f' : '#52c41a' }} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="平均修复时间 MTTR" value={stats.mttr} suffix="h" prefix={<ClockCircleOutlined />} /></Card></Col>
      </Row>

      <Tabs defaultActiveKey="1" size="large">
        <Tabs.TabPane tab={<span><BarChartOutlined /> 发电量与负荷</span>} key="1">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title={<span><EnvironmentOutlined /> 各区域发电量对比</span>}>
                <ReactECharts option={regionEnergyOption} style={{ height: 340 }} notMerge />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title={<span><DashboardOutlined /> 电源结构占比</span>}>
                <ReactECharts option={typeEnergyOption} style={{ height: 340 }} notMerge />
              </Card>
            </Col>
            <Col xs={24}>
              <Card size="small" title={<span><LineChartOutlined /> 典型日负荷曲线</span>}>
                <ReactECharts option={hourlyLoadOption} style={{ height: 320 }} notMerge />
              </Card>
            </Col>
          </Row>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><ToolOutlined /> 运维指标</span>} key="2">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title={<span><RiseOutlined /> 线损率趋势 (近6个月)</span>}>
                <ReactECharts option={lineLossOption} style={{ height: 340 }} notMerge />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title={<span><ClockCircleOutlined /> 故障平均修复时间 MTTR</span>}>
                <ReactECharts option={mttrOption} style={{ height: 340 }} notMerge />
              </Card>
            </Col>
            <Col xs={24}>
              <Card size="small" title={<span><SafetyOutlined /> 线路负载统计</span>}>
                <Row gutter={[16, 16]}>
                  {lines.map(line => (
                    <Col xs={12} sm={8} lg={6} key={line.id}>
                      <Card size="small">
                        <Text strong>{line.name}</Text>
                        <Progress
                          percent={Math.round(line.loadRate * 100)}
                          status={line.loadRate > 0.85 ? 'exception' : line.loadRate > 0.7 ? 'active' : 'normal'}
                          style={{ marginTop: 8 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {line.voltage}kV · {line.length}km · 故障率 {(line.failureRate * 100).toFixed(1)}%
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
          </Row>
        </Tabs.TabPane>

        <Tabs.TabPane tab={<span><BarChartOutlined /> 运营数据明细</span>} key="3">
          <Card size="small" title="各厂运营指标">
            <Table
              size="small"
              dataSource={plants.map(plant => {
                const plantUnits = units.filter(u => u.plantId === plant.id);
                const totalCap = plantUnits.reduce((s, u) => s + u.ratedCapacity, 0);
                const totalOut = plantUnits.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0);
                const loadRate = totalCap > 0 ? Math.round((totalOut / totalCap) * 1000) / 10 : 0;
                const monthGen = Math.round(totalOut * 24 * 30);
                const settle = settlements.find(s => s.plantId === plant.id && s.month === reportMonth);
                return {
                  key: plant.id,
                  name: plant.name,
                  region: plant.region,
                  type: plant.type,
                  capacity: totalCap,
                  output: Math.round(totalOut),
                  loadRate,
                  monthGen,
                  settlement: settle?.settlementAmount || 0,
                  lineLoss: (3 + Math.random() * 2).toFixed(2),
                };
              })}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '发电厂', dataIndex: 'name', width: 180, render: v => <Text strong>{v}</Text> },
                { title: '区域', dataIndex: 'region', width: 100, render: v => <Tag>{v}</Tag> },
                { title: '装机容量 (MW)', dataIndex: 'capacity', width: 120, align: 'right', sorter: (a, b) => a.capacity - b.capacity },
                { title: '当前出力 (MW)', dataIndex: 'output', width: 120, align: 'right', sorter: (a, b) => a.output - b.output },
                { title: '负荷率 (%)', dataIndex: 'loadRate', width: 120, render: v => <Progress percent={v} size="small" />, sorter: (a, b) => a.loadRate - b.loadRate },
                { title: '月发电量 (MWh)', dataIndex: 'monthGen', width: 140, align: 'right', render: v => v.toLocaleString(), sorter: (a, b) => a.monthGen - b.monthGen },
                { title: '线损率 (%)', dataIndex: 'lineLoss', width: 100, align: 'right' },
                { title: '结算金额 (元)', dataIndex: 'settlement', width: 140, align: 'right', render: v => `¥${v.toLocaleString()}`, sorter: (a, b) => a.settlement - b.settlement },
              ]}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default Statistics;
