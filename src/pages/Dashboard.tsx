import React, { useMemo } from 'react';
import { Row, Col, Card, List, Tag, Progress, Space, Typography, Statistic } from 'antd';
import {
  ThunderboltOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LineChartOutlined,
  SafetyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { units, busbars, lines, alerts, plans, inspectionOrders, repairOrders } = useStore();

  const stats = useMemo(() => {
    const runningUnits = units.filter((u) => u.status === 'running');
    const totalCapacity = units.reduce((s, u) => s + u.ratedCapacity, 0);
    const totalOutput = runningUnits.reduce((s, u) => s + u.currentOutput, 0);
    const loadRate = totalCapacity > 0 ? (totalOutput / totalCapacity) * 100 : 0;
    const activeAlerts = alerts.filter((a) => !a.acknowledged);
    const criticalAlerts = activeAlerts.filter((a) => a.level === 'critical');
    const avgFreq = busbars.length > 0 ? busbars.reduce((s, b) => s + b.frequency, 0) / busbars.length : 50;
    const avgLoadRate = lines.length > 0 ? lines.reduce((s, l) => s + l.loadRate, 0) / lines.length : 0;

    return {
      runningUnits: runningUnits.length,
      totalUnits: units.length,
      totalCapacity,
      totalOutput: Math.round(totalOutput),
      loadRate: Math.round(loadRate * 10) / 10,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      avgFreq: Math.round(avgFreq * 100) / 100,
      avgLoadRate: Math.round(avgLoadRate * 1000) / 10,
      pendingInspections: inspectionOrders.filter((o) => o.status !== 'completed').length,
      pendingRepairs: repairOrders.filter((o) => o.status !== 'completed').length,
      approvedPlans: plans.filter((p) => p.status === 'approved').length,
    };
  }, [units, busbars, lines, alerts, plans, inspectionOrders, repairOrders]);

  const loadCurveOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const today = dayjs().format('YYYY-MM-DD');
    const todayPlan = plans.find((p) => p.date === today);
    const loadData = hours.map((_, h) => {
      if (todayPlan) {
        return todayPlan.schedules.reduce((s, sch) => s + (Number(sch[`hour${h}`]) || 0), 0);
      }
      return 12000 + 4000 * Math.sin((h - 6) * Math.PI / 12) + Math.random() * 500;
    });
    const predictData = loadData.map((v) => v * 1.08);

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际负荷', '预测负荷'], top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: hours },
      yAxis: { type: 'value', name: 'MW' },
      series: [
        { name: '实际负荷', type: 'line', smooth: true, data: loadData.map((v) => Math.round(v)), areaStyle: { opacity: 0.3 }, itemStyle: { color: '#1677ff' } },
        { name: '预测负荷', type: 'line', smooth: true, data: predictData.map((v) => Math.round(v)), lineStyle: { type: 'dashed' }, itemStyle: { color: '#52c41a' } },
      ],
    };
  }, [plans]);

  const energyMixOption = useMemo(() => {
    const types = ['thermal', 'hydro', 'nuclear', 'wind', 'solar'];
    const names: Record<string, string> = { thermal: '火电', hydro: '水电', nuclear: '核电', wind: '风电', solar: '光伏' };
    const data = types.map((t) => ({
      name: names[t],
      value: Math.round(units.filter((u) => u.type === t && u.status === 'running').reduce((s, u) => s + u.currentOutput, 0)),
    })).filter((d) => d.value > 0);

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} MW ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        label: { show: false },
        data,
        color: ['#ff7875', '#69b1ff', '#b37feb', '#95de64', '#ffd666'],
      }],
    };
  }, [units]);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">调度总览</h2>
        <Space>
          <Text type="secondary">系统运行时间：{dayjs().format('YYYY-MM-DD HH:mm:ss')}</Text>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card blue" bordered={false}>
            <ThunderboltOutlined style={{ fontSize: 28 }} />
            <div className="stat-value">{stats.totalOutput}<span style={{ fontSize: 14 }}> MW</span></div>
            <div className="stat-label">当前总出力 / {stats.totalCapacity} MW</div>
            <Progress percent={stats.loadRate} showInfo={false} strokeColor="#fff" style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <SafetyOutlined style={{ fontSize: 28 }} />
            <div className="stat-value">{stats.avgFreq}<span style={{ fontSize: 14 }}> Hz</span></div>
            <div className="stat-label">
              系统频率
              {stats.avgFreq > 50.05 ? <ArrowUpOutlined style={{ color: '#ff7875', marginLeft: 8 }} /> :
                stats.avgFreq < 49.95 ? <ArrowDownOutlined style={{ color: '#ff7875', marginLeft: 8 }} /> : null}
            </div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)' }}>
              运行机组 <b>{stats.runningUnits}/{stats.totalUnits}</b>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className={`stat-card ${stats.criticalAlerts > 0 ? 'orange' : 'green'}`} bordered={false}>
            <AlertOutlined style={{ fontSize: 28 }} />
            <div className="stat-value">{stats.activeAlerts}</div>
            <div className="stat-label">
              活动报警
              {stats.criticalAlerts > 0 && <Tag color="red" style={{ marginLeft: 8 }}>严重 {stats.criticalAlerts}</Tag>}
            </div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)' }}>
              待巡检 {stats.pendingInspections} | 待抢修 {stats.pendingRepairs}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card green" bordered={false}>
            <CheckCircleOutlined style={{ fontSize: 28 }} />
            <div className="stat-value">{stats.avgLoadRate}%</div>
            <div className="stat-label">线路平均负载率</div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)' }}>
              已审批计划 <b>{stats.approvedPlans}</b> 份
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={<span><LineChartOutlined /> 全网负荷曲线</span>} size="small">
            <ReactECharts option={loadCurveOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<span><ThunderboltOutlined /> 电源结构</span>} size="small">
            <ReactECharts option={energyMixOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<span><AlertOutlined /> 实时报警信息</span>} size="small" extra={<Tag color="red">{stats.activeAlerts} 条未处理</Tag>}>
            <List
              size="small"
              dataSource={alerts.slice(0, 8)}
              renderItem={(item) => (
                <List.Item className={`alert-item ${item.level}`}>
                  <Space direction="vertical" size={0} style={{ flex: 1 }}>
                    <Space>
                      {item.level === 'critical' ? <WarningOutlined style={{ color: '#ff4d4f' }} /> :
                        item.level === 'warning' ? <AlertOutlined style={{ color: '#faad14' }} /> :
                          <AlertOutlined style={{ color: '#1677ff' }} />}
                      <Text strong>{item.message}</Text>
                      {!item.acknowledged && <Tag color={item.level === 'critical' ? 'red' : 'orange'}>未确认</Tag>}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(item.timestamp).format('HH:mm:ss')} | 来源: {item.source}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span><ThunderboltOutlined /> 主要机组运行状态</span>} size="small">
            <List
              size="small"
              dataSource={units.filter((u) => u.ratedCapacity >= 500).slice(0, 8)}
              renderItem={(unit) => (
                <List.Item>
                  <Space style={{ flex: 1, justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                      <Text strong>{unit.name}</Text>
                      <Tag color={unit.status === 'running' ? 'green' : unit.status === 'maintenance' ? 'orange' : 'default'}>
                        {unit.status === 'running' ? '运行' : unit.status === 'maintenance' ? '检修' : unit.status === 'stopped' ? '停机' : '故障'}
                      </Tag>
                    </Space>
                    <Space>
                      <Text type="secondary">出力:</Text>
                      <Text strong>{unit.currentOutput} MW</Text>
                      <Text type="secondary">/ {unit.ratedCapacity} MW</Text>
                      <Progress
                        percent={Math.round((unit.currentOutput / unit.ratedCapacity) * 100)}
                        size="small"
                        style={{ width: 100 }}
                        status={unit.status === 'running' ? 'active' : 'exception'}
                      />
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
