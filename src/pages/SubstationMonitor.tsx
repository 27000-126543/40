import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select,
  Typography, App as AntApp, Row, Col, Statistic, Drawer, Descriptions,
  List, Progress, Timeline, Empty, Divider, Badge
} from 'antd';
import {
  ToolOutlined, WarningOutlined, ThunderboltOutlined, SafetyOutlined,
  EnvironmentOutlined, CarOutlined, ClockCircleOutlined, RocketOutlined,
  CheckOutlined, FileTextOutlined, TeamOutlined, InboxOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import type { Substation, RepairWorkOrder, RepairTeam } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const deviceStatusMap: Record<string, { label: string; color: string }> = {
  closed: { label: '合闸运行', color: 'green' },
  open: { label: '分闸', color: 'default' },
  normal: { label: '正常', color: 'green' },
  warning: { label: '预警', color: 'orange' },
  fault: { label: '故障', color: 'red' },
  tripped: { label: '跳闸', color: 'red' },
  overload: { label: '过载', color: 'orange' },
};

const repairStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待派单', color: 'default' },
  dispatched: { label: '已派单', color: 'blue' },
  inProgress: { label: '抢修中', color: 'processing' },
  completed: { label: '已完成', color: 'green' },
};

const priorityMap: Record<string, { label: string; color: string }> = {
  medium: { label: '一般', color: 'blue' },
  high: { label: '高', color: 'orange' },
  critical: { label: '紧急', color: 'red' },
};

const SubstationMonitor: React.FC = () => {
  const { message } = AntApp.useApp();
  const { substations, repairOrders, repairTeams, alerts, refreshAll } = useStore();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSubstation, setSelectedSubstation] = useState<Substation | null>(null);
  const [faultModal, setFaultModal] = useState(false);
  const [faultForm] = Form.useForm();

  const stats = useMemo(() => {
    const totalDevices = substations.reduce((s, sub) => s + sub.devices.length, 0);
    const faultDevices = substations.reduce(
      (s, sub) => s + sub.devices.filter(d => d.status === 'fault' || d.status === 'tripped' || d.status === 'overload' || d.status === 'warning').length,
      0
    );
    const activeRepairs = repairOrders.filter(o => o.status !== 'completed').length;
    const standbyTeams = repairTeams.filter(t => t.status === 'standby').length;
    return { totalDevices, faultDevices, activeRepairs, standbyTeams, totalSubstations: substations.length };
  }, [substations, repairOrders, repairTeams]);

  const deviceLoadOption = useMemo(() => {
    const transformers: any[] = [];
    substations.forEach(sub => {
      sub.devices.forEach(d => {
        if (d.type === 'transformer') {
          transformers.push({
            name: `${sub.name} ${d.name}`,
            load: Math.round((d.loadRate || 0) * 100),
            temp: d.temperature || 0,
            capacity: d.capacity || 0,
          });
        }
      });
    });

    return {
      tooltip: {
        formatter: (p: any) => `${p.name}<br/>负载率: ${p.value}%<br/>温度: ${p.data.temp}°C<br/>容量: ${p.data.capacity} MVA`,
      },
      grid: { left: 140, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: '负载率 (%)', max: 100 },
      yAxis: { type: 'category', data: transformers.map(t => t.name).reverse() },
      series: [{
        type: 'bar',
        data: transformers.map(t => ({
          value: t.load,
          itemStyle: {
            color: t.load > 85 ? '#ff4d4f' : t.load > 70 ? '#faad14' : '#52c41a',
          },
          ...t,
        })).reverse(),
        label: { show: true, position: 'right', formatter: '{c}%' },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed' },
          data: [{ xAxis: 85, label: { formatter: '过载阈值' } }],
        },
      }],
    };
  }, [substations]);

  const getTeamName = (id: string) => repairTeams.find(t => t.id === id)?.name || id;
  const getSubstationName = (id: string) => substations.find(s => s.id === id)?.name || id;

  const handleDispatchRepair = async (values: any) => {
    try {
      const order = await api.dispatchRepair({
        substationId: values.substationId,
        deviceId: values.deviceId,
        faultType: values.faultType,
        affectedLoad: values.affectedLoad,
      });
      if (order) {
        message.success(`已智能派单至最近抢修组: ${getTeamName(order.teamId)}`);
      } else {
        message.warning('暂无可用抢修组');
      }
      await refreshAll();
      setFaultModal(false);
      faultForm.resetFields();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteRepair = async (orderId: string) => {
    await api.update('repairWorkOrders', orderId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    message.success('抢修任务已完成');
    await refreshAll();
  };

  const substationColumns = [
    { title: '变电站名称', dataIndex: 'name', width: 180, render: (v: string, r: Substation) => <Space><EnvironmentOutlined /><Text strong>{v}</Text></Space> },
    { title: '设备数', dataIndex: 'devices', width: 80, align: 'center', render: (d: Substation['devices']) => d.length },
    {
      title: '运行状态', width: 180, render: (_: any, r: Substation) => {
        const faults = r.devices.filter(d => d.status === 'fault' || d.status === 'tripped');
        const warnings = r.devices.filter(d => d.status === 'warning' || d.status === 'overload');
        return (
          <Space>
            {faults.length > 0 && <Badge count={faults.length}><Tag color="red">故障</Tag></Badge>}
            {warnings.length > 0 && <Badge count={warnings.length}><Tag color="orange">预警</Tag></Badge>}
            {faults.length === 0 && warnings.length === 0 && <Tag color="green">正常</Tag>}
          </Space>
        );
      },
    },
    {
      title: '设备温度', width: 200, render: (_: any, r: Substation) => {
        const maxTemp = Math.max(...r.devices.map(d => d.temperature || 0), 0);
        return (
          <Space>
            <Text type="secondary">最高:</Text>
            <Text strong style={{ color: maxTemp > 75 ? '#ff4d4f' : maxTemp > 65 ? '#faad14' : '#52c41a' }}>
              {maxTemp}°C
            </Text>
            <Progress percent={maxTemp} showInfo={false} size="small" style={{ width: 80 }} />
          </Space>
        );
      },
    },
    {
      title: '坐标', width: 150, render: (_: any, r: Substation) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.location.lat.toFixed(2)}, {r.location.lng.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '操作', key: 'action', width: 120, render: (_: any, r: Substation) => (
        <Button size="small" icon={<FileTextOutlined />} onClick={() => { setSelectedSubstation(r); setDetailOpen(true); }}>
          详情
        </Button>
      ),
    },
  ];

  const repairColumns = [
    { title: '工单编号', dataIndex: 'id', width: 140 },
    { title: '变电站', dataIndex: 'substationId', width: 160, render: (id: string) => getSubstationName(id) },
    { title: '设备', dataIndex: 'deviceId', width: 100 },
    { title: '故障类型', dataIndex: 'faultType', width: 120 },
    { title: '影响负荷 (MW)', dataIndex: 'affectedLoad', width: 110, align: 'right' },
    {
      title: '优先级', dataIndex: 'priority', width: 80,
      render: (p: string) => <Tag color={priorityMap[p]?.color}>{priorityMap[p]?.label}</Tag>,
    },
    { title: '抢修组', dataIndex: 'teamId', width: 140, render: (id: string) => <Space><TeamOutlined />{getTeamName(id)}</Space> },
    {
      title: '预计到达 (min)', dataIndex: 'estimatedArrival', width: 110, align: 'center',
      render: (v: number) => <Space><CarOutlined />{v}</Space>,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string) => <Tag color={repairStatusMap[s]?.color}>{repairStatusMap[s]?.label}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: RepairWorkOrder) => (
        r.status !== 'completed' ? (
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleCompleteRepair(r.id)}>
            完成
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">变电站设备状态监测与故障调度</h2>
        <Space>
          <Button type="primary" icon={<WarningOutlined />} danger onClick={() => setFaultModal(true)}>
            模拟故障派单
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="变电站" value={stats.totalSubstations} prefix={<EnvironmentOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="设备总数" value={stats.totalDevices} prefix={<InboxOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="异常设备" value={stats.faultDevices} valueStyle={{ color: stats.faultDevices > 0 ? '#ff4d4f' : '#52c41a' }} prefix={<WarningOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="抢修任务" value={stats.activeRepairs} valueStyle={{ color: '#faad14' }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="待命抢修组" value={stats.standbyTeams} suffix={`/ ${repairTeams.length}`} valueStyle={{ color: '#1677ff' }} prefix={<TeamOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card size="small" title={<span><ThunderboltOutlined /> 主变负载率监测</span>}>
            <ReactECharts option={deviceLoadOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title={<span><TeamOutlined /> 抢修组位置与状态</span>}>
            <Row gutter={[8, 8]}>
              {repairTeams.map(team => (
                <Col xs={12} key={team.id}>
                  <Card size="small" style={{ borderLeft: `3px solid ${team.status === 'standby' ? '#52c41a' : team.status === 'onMission' ? '#faad14' : '#bfbfbf'}` }}>
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Text strong>{team.name}</Text>
                        <Tag color={team.status === 'standby' ? 'green' : team.status === 'onMission' ? 'orange' : 'default'}>
                          {team.status === 'standby' ? '待命' : team.status === 'onMission' ? '执行任务' : '维护中'}
                        </Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <EnvironmentOutlined /> {team.location.lat.toFixed(2)}, {team.location.lng.toFixed(2)}
                      </Text>
                      <Space size="large" style={{ marginTop: 4 }}>
                        <Text type="secondary"><TeamOutlined /> {team.members}人</Text>
                        <Text type="secondary"><CarOutlined /> {team.vehicleCount}辆</Text>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<span><EnvironmentOutlined /> 变电站列表</span>} style={{ marginTop: 16 }}>
        <Table
          columns={substationColumns as any}
          dataSource={substations}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 6 }}
        />
      </Card>

      <Card size="small" title={<span><ToolOutlined /> 抢修工单</span>} style={{ marginTop: 16 }}>
        {repairOrders.length === 0 ? (
          <Empty description="暂无抢修工单" />
        ) : (
          <Table
            columns={repairColumns as any}
            dataSource={repairOrders}
            rowKey="id"
            size="middle"
            pagination={{ pageSize: 5 }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      <Drawer
        title={selectedSubstation ? selectedSubstation.name : ''}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
      >
        {selectedSubstation && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="变电站ID">{selectedSubstation.id}</Descriptions.Item>
              <Descriptions.Item label="所属母线">{selectedSubstation.busbarId}</Descriptions.Item>
              <Descriptions.Item label="坐标" span={2}>
                {selectedSubstation.location.lat.toFixed(4)}, {selectedSubstation.location.lng.toFixed(4)}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title={<span><InboxOutlined /> 设备状态</span>}>
              <List
                dataSource={selectedSubstation.devices}
                renderItem={device => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color={device.type === 'transformer' ? 'blue' : device.type === 'circuitBreaker' ? 'green' : 'default'}>
                          {device.type === 'transformer' ? '变压器' : device.type === 'circuitBreaker' ? '断路器' : device.type}
                        </Tag>
                        <Text strong>{device.name}</Text>
                        <Tag color={deviceStatusMap[device.status]?.color || 'default'}>
                          {deviceStatusMap[device.status]?.label || device.status}
                        </Tag>
                      </Space>
                      <Space>
                        {device.capacity && <Text type="secondary">容量: {device.capacity} MVA</Text>}
                        {device.loadRate != null && (
                          <Progress percent={Math.round(device.loadRate * 100)} size="small" style={{ width: 100 }} />
                        )}
                        {device.temperature && (
                          <Text strong style={{ color: device.temperature > 75 ? '#ff4d4f' : '#52c41a' }}>
                            {device.temperature}°C
                          </Text>
                        )}
                        {device.lastCheck && <Text type="secondary">上次检查: {device.lastCheck}</Text>}
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="模拟故障事件 - 智能派单"
        open={faultModal}
        onCancel={() => setFaultModal(false)}
        onOk={() => faultForm.submit()}
        okText="智能派单"
        okButtonProps={{ icon: <RocketOutlined /> }}
        destroyOnClose
      >
        <Paragraph type="secondary">
          系统将根据故障影响负荷大小、备件库存和抢修车位置自动调度最近抢修组。
        </Paragraph>
        <Form form={faultForm} layout="vertical" onFinish={handleDispatchRepair}>
          <Form.Item label="变电站" name="substationId" rules={[{ required: true }]}>
            <Select placeholder="选择变电站">
              {substations.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="故障设备" name="deviceId" rules={[{ required: true }]}>
            <Select placeholder="选择设备">
              {['断路器跳闸', '主变过载', '避雷器故障', '隔离开关异常'].map(d => (
                <Option key={d} value={d}>{d}</Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="故障类型" name="faultType" rules={[{ required: true }]} initialValue="断路器跳闸">
                <Select>
                  <Option value="断路器跳闸">断路器跳闸</Option>
                  <Option value="变压器过载">变压器过载</Option>
                  <Option value="设备故障">设备故障</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="影响负荷 (MW)" name="affectedLoad" rules={[{ required: true }]} initialValue={50}>
                <Input min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default SubstationMonitor;
