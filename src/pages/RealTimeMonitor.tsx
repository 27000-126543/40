import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, List, Tag, Button, Space, Typography,
  Progress, Tooltip, Divider, Switch, Alert as AntAlert, App as AntApp,
  Badge, Avatar, Empty, Modal
} from 'antd';
import {
  ThunderboltOutlined, AlertOutlined, SafetyOutlined, DashboardOutlined,
  CheckOutlined, WarningOutlined, SoundOutlined, ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import type { GeneratorUnit, Busbar, Alert } from '../types';

const { Title, Text, Paragraph } = Typography;

const RealTimeMonitor: React.FC = () => {
  const { message } = AntApp.useApp();
  const { units, busbars, lines, alerts, agcEnabled, soundEnabled, toggleAGC, toggleSound, acknowledgeAlert, refreshAll } = useStore();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [unitHistory, setUnitHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const init: Record<string, number[]> = {};
    units.forEach(u => { init[u.id] = new Array(20).fill(u.currentOutput); });
    setUnitHistory(init);
  }, [units]);

  useEffect(() => {
    const interval = setInterval(() => {
      setUnitHistory(prev => {
        const next: Record<string, number[]> = {};
        units.forEach(u => {
          const hist = prev[u.id] || [];
          next[u.id] = [...hist.slice(-19), u.currentOutput];
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [units]);

  const handleAcknowledge = async (alert: Alert) => {
    acknowledgeAlert(alert.id);
    await api.update('alerts', alert.id, { acknowledged: true });
    message.success('报警已确认');
  };

  const handleAGCRegulate = async (unitId: string, targetOutput: number) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;
    const delta = Math.sign(targetOutput - unit.currentOutput) * Math.min(Math.abs(targetOutput - unit.currentOutput), unit.rampRate);
    const newOutput = Math.round((unit.currentOutput + delta) * 10) / 10;
    await api.update('generatorUnits', unitId, { currentOutput: newOutput });
    message.info(`AGC调节: ${unit.name} -> ${newOutput} MW`);
    await refreshAll();
  };

  const systemStats = useMemo(() => {
    const totalOutput = units.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0);
    const totalCapacity = units.reduce((s, u) => s + u.ratedCapacity, 0);
    const activeAlerts = alerts.filter(a => !a.acknowledged);
    const critical = activeAlerts.filter(a => a.level === 'critical').length;
    const warnings = activeAlerts.filter(a => a.level === 'warning').length;
    const avgFreq = busbars.length > 0 ? busbars.reduce((s, b) => s + b.frequency, 0) / busbars.length : 50;

    return {
      totalOutput: Math.round(totalOutput),
      totalCapacity,
      loadRate: totalCapacity > 0 ? Math.round((totalOutput / totalCapacity) * 1000) / 10 : 0,
      avgFreq: Math.round(avgFreq * 100) / 100,
      avgVoltage: busbars.length > 0 ? Math.round(busbars.reduce((s, b) => s + b.voltage, 0) / busbars.length * 10) / 10 : 0,
      activeAlerts: activeAlerts.length,
      critical,
      warnings,
      freqStatus: Math.abs(avgFreq - 50) < 0.1 ? 'normal' : Math.abs(avgFreq - 50) < 0.2 ? 'warning' : 'critical',
    };
  }, [units, busbars, alerts]);

  const freqTrendOption = useMemo(() => {
    const times = Array.from({ length: 20 }, (_, i) => dayjs().subtract(19 - i, 'second').format('HH:mm:ss'));
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: times, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', min: 49.7, max: 50.3, name: 'Hz' },
      series: [{
        type: 'line',
        smooth: true,
        data: Array.from({ length: 20 }, () => 50 + (Math.random() - 0.5) * 0.2),
        itemStyle: { color: systemStats.freqStatus === 'normal' ? '#52c41a' : systemStats.freqStatus === 'warning' ? '#faad14' : '#ff4d4f' },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f' },
          data: [{ yAxis: 49.8 }, { yAxis: 50.2 }],
        },
        areaStyle: { opacity: 0.3 },
      }],
    };
  }, [systemStats.freqStatus]);

  const unitColumns = [
    {
      title: '机组',
      dataIndex: 'name',
      width: 130,
      render: (v: string, r: GeneratorUnit) => (
        <Space>
          <Text strong>{v}</Text>
          <Tag color={r.status === 'running' ? 'green' : r.status === 'maintenance' ? 'orange' : 'default'} style={{ fontSize: 10 }}>
            {r.status === 'running' ? '运行' : r.status === 'maintenance' ? '检修' : '停机'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '有功出力 (MW)',
      width: 220,
      render: (_: any, r: GeneratorUnit) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space>
            <Text strong style={{ fontSize: 15 }}>{r.currentOutput}</Text>
            <Text type="secondary">/ {r.ratedCapacity}</Text>
          </Space>
          <Progress
            percent={Math.round((r.currentOutput / r.ratedCapacity) * 100)}
            size="small"
            status={r.status === 'running' ? 'active' : 'exception'}
            strokeColor={{ from: '#52c41a', to: '#1677ff' }}
          />
        </Space>
      ),
    },
    {
      title: '无功 (MVar)',
      dataIndex: 'reactiveOutput',
      width: 100,
      align: 'right',
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: '出力趋势',
      width: 160,
      render: (_: any, r: GeneratorUnit) => {
        const data = unitHistory[r.id] || [];
        if (data.length === 0) return null;
        const min = Math.min(...data, r.ratedCapacity * 0.3);
        const max = Math.max(...data, r.ratedCapacity);
        return (
          <div style={{ height: 32, width: 150, position: 'relative' }}>
            <svg viewBox={`0 0 150 32`} style={{ width: '100%', height: '100%' }}>
              <polyline
                fill="none"
                stroke={r.status === 'running' ? '#1677ff' : '#d9d9d9'}
                strokeWidth="2"
                points={data.map((v, i) => `${(i / (data.length - 1)) * 150},${32 - ((v - min) / (max - min || 1)) * 28 - 2}`).join(' ')}
              />
            </svg>
          </div>
        );
      },
    },
    {
      title: 'AGC调节',
      width: 140,
      align: 'center',
      render: (_: any, r: GeneratorUnit) => (
        <Space size="small">
          <Button
            size="small"
            disabled={r.status !== 'running' || !agcEnabled}
            onClick={() => handleAGCRegulate(r.id, r.currentOutput - r.rampRate)}
          >-</Button>
          <Tooltip title={agcEnabled ? 'AGC自动调节已启用' : 'AGC未启用'}>
            <ExperimentOutlined style={{ color: agcEnabled && r.status === 'running' ? '#52c41a' : '#bfbfbf' }} />
          </Tooltip>
          <Button
            size="small"
            disabled={r.status !== 'running' || !agcEnabled}
            onClick={() => handleAGCRegulate(r.id, r.currentOutput + r.rampRate)}
          >+</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">实时运行监控</h2>
        <Space>
          <Space>
            <Text type="secondary">AGC自动发电控制</Text>
            <Switch checked={agcEnabled} onChange={toggleAGC} />
          </Space>
          <Space>
            <Text type="secondary">声光报警</Text>
            <Switch checked={soundEnabled} onChange={toggleSound} checkedChildren={<SoundOutlined />} unCheckedChildren={<SoundOutlined />} />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => { refreshAll(); message.success('数据已刷新'); }}>
            刷新
          </Button>
        </Space>
      </div>

      {systemStats.critical > 0 && (
        <AntAlert
          type="error"
          showIcon
          icon={<WarningOutlined className="blink" />}
          message={`当前存在 ${systemStats.critical} 个严重报警，请立即处理！`}
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderLeft: `4px solid ${systemStats.freqStatus === 'normal' ? '#52c41a' : systemStats.freqStatus === 'warning' ? '#faad14' : '#ff4d4f'}` }}>
            <Statistic
              title={<Space><DashboardOutlined /> 系统频率</Space>}
              value={systemStats.avgFreq}
              suffix="Hz"
              valueStyle={{ color: systemStats.freqStatus === 'normal' ? '#52c41a' : systemStats.freqStatus === 'warning' ? '#faad14' : '#ff4d4f' }}
              prefix={systemStats.freqStatus === 'normal' ? <CheckOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderLeft: '4px solid #1677ff' }}>
            <Statistic
              title={<Space><ThunderboltOutlined /> 总有功出力</Space>}
              value={systemStats.totalOutput}
              suffix={`MW / ${systemStats.totalCapacity}`}
              valueStyle={{ color: '#1677ff' }}
            />
            <Progress percent={systemStats.loadRate} size="small" showInfo style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title={<Space><SafetyOutlined /> 平均母线电压</Space>}
              value={systemStats.avgVoltage}
              suffix="kV"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderLeft: `4px solid ${systemStats.activeAlerts > 0 ? '#ff4d4f' : '#52c41a'}` }}>
            <Statistic
              title={<Space><AlertOutlined /> 活动报警</Space>}
              value={systemStats.activeAlerts}
              valueStyle={{ color: systemStats.activeAlerts > 0 ? '#ff4d4f' : '#52c41a' }}
              suffix={
                <Space style={{ fontSize: 12 }}>
                  {systemStats.critical > 0 && <Tag color="red">严重 {systemStats.critical}</Tag>}
                  {systemStats.warnings > 0 && <Tag color="orange">警告 {systemStats.warnings}</Tag>}
                </Space>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card size="small" title={<span><ThunderboltOutlined /> 机组实时运行状态</span>} extra={<Tag color="green">{units.filter(u => u.status === 'running').length}/{units.length} 运行中</Tag>}>
            <Table
              size="small"
              columns={unitColumns as any}
              dataSource={units}
              rowKey="id"
              pagination={{ pageSize: 6 }}
              scroll={{ y: 360 }}
              rowClassName={(r: GeneratorUnit) => {
                if (r.status !== 'running') return '';
                const loadRate = r.currentOutput / r.ratedCapacity;
                if (loadRate > 0.98 || loadRate < 0.2) return 'blink';
                return '';
              }}
              onRow={(r: GeneratorUnit) => {
                if (r.status !== 'running') return {};
                const loadRate = r.currentOutput / r.ratedCapacity;
                if (loadRate > 0.98 || loadRate < 0.2) {
                  return { style: { background: '#fff2f0' } };
                }
                return {};
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Row gutter={[0, 16]}>
            <Col span={24}>
              <Card size="small" title={<span><DashboardOutlined /> 系统频率趋势</span>} extra={<Badge status={systemStats.freqStatus === 'normal' ? 'success' : systemStats.freqStatus === 'warning' ? 'warning' : 'error'} text={systemStats.freqStatus === 'normal' ? '正常' : systemStats.freqStatus === 'warning' ? '注意' : '异常'} />}>
                <ReactECharts option={freqTrendOption} style={{ height: 180 }} notMerge />
              </Card>
            </Col>
            <Col span={24}>
              <Card size="small" title={<span><SafetyOutlined /> 母线电压与频率</span>}>
                <List
                  size="small"
                  dataSource={busbars}
                  renderItem={(bus: Busbar) => {
                    const voltOutOfRange = bus.voltage < bus.voltageLimit.min || bus.voltage > bus.voltageLimit.max;
                    const freqOutOfRange = Math.abs(bus.frequency - 50) > 0.2;
                    const isAlert = voltOutOfRange || freqOutOfRange;
                    return (
                      <List.Item
                        style={{
                          background: isAlert ? '#fff2f0' : undefined,
                          borderRadius: 4,
                          padding: '6px 8px',
                          marginBottom: 4,
                        }}
                        className={isAlert ? 'blink' : undefined}
                      >
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <Text strong style={{ color: isAlert ? '#ff4d4f' : undefined }}>{bus.name}</Text>
                            {isAlert && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                          </Space>
                          <Space>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11 }}>电压</Text>
                              <Text strong style={{ color: voltOutOfRange ? '#ff4d4f' : '#52c41a', marginLeft: 8 }}>
                                {bus.voltage} kV
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                ({bus.voltageLimit.min}~{bus.voltageLimit.max})
                              </Text>
                            </div>
                            <Divider type="vertical" />
                            <div>
                              <Text type="secondary" style={{ fontSize: 11 }}>频率</Text>
                              <Text strong style={{ color: freqOutOfRange ? '#ff4d4f' : '#52c41a', marginLeft: 8 }}>
                                {bus.frequency} Hz
                              </Text>
                            </div>
                          </Space>
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            size="small"
            title={<span><AlertOutlined /> 实时报警中心 {soundEnabled && <Tag color="blue">声音开</Tag>}</span>}
            extra={<Space>
              <Tag color={systemStats.critical > 0 ? 'red' : 'default'}>严重: {systemStats.critical}</Tag>
              <Tag color={systemStats.warnings > 0 ? 'orange' : 'default'}>警告: {systemStats.warnings}</Tag>
              <Button size="small" onClick={() => alerts.filter(a => !a.acknowledged).forEach(a => handleAcknowledge(a))}>
                全部确认
              </Button>
            </Space>}
          >
            {alerts.length === 0 ? (
              <Empty description="暂无报警信息" />
            ) : (
              <List
                size="small"
                dataSource={alerts.slice(0, 20)}
                renderItem={(alert: Alert) => (
                  <List.Item className={`alert-item ${alert.level}`} style={{ marginBottom: 4 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size="middle">
                        <Avatar
                          size={32}
                          style={{
                            backgroundColor: alert.level === 'critical' ? '#ff4d4f' : alert.level === 'warning' ? '#faad14' : '#1677ff',
                          }}
                          icon={alert.level === 'critical' ? <WarningOutlined className={!alert.acknowledged ? 'blink' : ''} /> : <AlertOutlined />}
                        />
                        <Space direction="vertical" size={0}>
                          <Space>
                            <Tag color={alert.level === 'critical' ? 'red' : alert.level === 'warning' ? 'orange' : 'blue'}>
                              {alert.level === 'critical' ? '严重' : alert.level === 'warning' ? '警告' : '提示'}
                            </Tag>
                            <Text strong>{alert.message}</Text>
                            {!alert.acknowledged && <Tag color="magenta">未确认</Tag>}
                          </Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(alert.timestamp).format('YYYY-MM-DD HH:mm:ss')} | 类型: {alert.type} | 来源: {alert.source}
                          </Text>
                        </Space>
                      </Space>
                      <Space>
                        <Button size="small" icon={<AlertOutlined />} onClick={() => setSelectedAlert(alert)}>详情</Button>
                        {!alert.acknowledged && (
                          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAcknowledge(alert)}>
                            确认
                          </Button>
                        )}
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="报警详情"
        open={!!selectedAlert}
        onCancel={() => setSelectedAlert(null)}
        footer={[
          selectedAlert && !selectedAlert.acknowledged ? (
            <Button key="ack" type="primary" onClick={() => { handleAcknowledge(selectedAlert); setSelectedAlert(null); }}>
              确认报警
            </Button>
          ) : null,
          <Button key="close" onClick={() => setSelectedAlert(null)}>关闭</Button>,
        ]}
      >
        {selectedAlert && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <AntAlert
              type={selectedAlert.level === 'critical' ? 'error' : selectedAlert.level === 'warning' ? 'warning' : 'info'}
              showIcon
              message={selectedAlert.message}
              description={`报警ID: ${selectedAlert.id}`}
            />
            <Paragraph>
              <Text strong>报警类型：</Text>{selectedAlert.type}<br />
              <Text strong>报警级别：</Text>{selectedAlert.level === 'critical' ? '严重' : selectedAlert.level === 'warning' ? '警告' : '提示'}<br />
              <Text strong>发生时间：</Text>{dayjs(selectedAlert.timestamp).format('YYYY-MM-DD HH:mm:ss')}<br />
              <Text strong>设备/位置：</Text>{selectedAlert.source}<br />
              <Text strong>处理状态：</Text>{selectedAlert.acknowledged ? '已确认处理' : '待确认'}
            </Paragraph>
            {agcEnabled && (
              <AntAlert type="info" showIcon message="AGC自动调节" description="系统已自动启动AGC进行有功功率调节，相关机组出力正在校正中。" />
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default RealTimeMonitor;
