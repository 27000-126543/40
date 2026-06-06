import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker,
  Typography, App as AntApp, Row, Col, Statistic, Drawer, Descriptions,
  Upload, List, Progress, Rate, message as Msg, Empty, Badge
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EditOutlined, CheckOutlined,
  CarOutlined, CloudOutlined, CameraOutlined, ToolOutlined,
  FileTextOutlined, ClockCircleOutlined, WarningOutlined, SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import type { ColumnsType } from 'antd/es/table';
import type { InspectionWorkOrder, TransmissionLine, InspectionTeam, InspectionFinding } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待分配', color: 'default' },
  assigned: { label: '已分配', color: 'blue' },
  inProgress: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
};

const priorityMap: Record<string, { label: string; color: string }> = {
  low: { label: '低', color: 'default' },
  medium: { label: '中', color: 'blue' },
  high: { label: '高', color: 'orange' },
  critical: { label: '紧急', color: 'red' },
};

const typeMap: Record<string, string> = {
  routine: '常规巡检',
  urgent: '紧急巡检',
  special: '专项巡检',
};

const weatherRiskMap: Record<string, { label: string; color: string }> = {
  low: { label: '低风险', color: 'green' },
  medium: { label: '中风险', color: 'orange' },
  high: { label: '高风险', color: 'red' },
};

const LineInspection: React.FC = () => {
  const { message } = AntApp.useApp();
  const { inspectionOrders, lines, inspectionTeams, refreshAll } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [findingModal, setFindingModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InspectionWorkOrder | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | undefined>();
  const [form] = Form.useForm();
  const [findingForm] = Form.useForm();

  const stats = useMemo(() => {
    const total = inspectionOrders.length;
    const pending = inspectionOrders.filter(o => o.status === 'pending' || o.status === 'assigned').length;
    const inProgress = inspectionOrders.filter(o => o.status === 'inProgress').length;
    const completed = inspectionOrders.filter(o => o.status === 'completed').length;
    const hasFindings = inspectionOrders.filter(o => o.findings?.length > 0).length;
    return { total, pending, inProgress, completed, hasFindings };
  }, [inspectionOrders]);

  const lineRiskOption = useMemo(() => {
    const data = lines.map(l => ({
      name: l.name,
      value: Math.round((l.failureRate * 10 + (l.weatherRisk === 'high' ? 5 : l.weatherRisk === 'medium' ? 2 : 0)) * 10) / 10,
      failureRate: l.failureRate,
      loadRate: l.loadRate,
    })).sort((a, b) => b.value - a.value);

    return {
      tooltip: {
        formatter: (p: any) => `${p.name}<br/>风险指数: ${p.value}<br/>故障率: ${(p.data.failureRate * 100).toFixed(1)}%<br/>负载率: ${(p.data.loadRate * 100).toFixed(0)}%`,
      },
      grid: { left: 140, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: '风险指数' },
      yAxis: { type: 'category', data: data.map(d => d.name).reverse() },
      series: [{
        type: 'bar',
        data: data.map(d => ({
          ...d,
          itemStyle: {
            color: d.value > 3 ? '#ff4d4f' : d.value > 1.5 ? '#faad14' : '#52c41a',
          },
        })).reverse(),
        label: { show: true, position: 'right' },
      }],
    };
  }, [lines]);

  const getLineName = (id: string) => lines.find(l => l.id === id)?.name || id;
  const getTeamName = (id: string) => inspectionTeams.find(t => t.id === id)?.name || id;

  const handleAutoGenerate = async () => {
    const orders = await api.autoGenerateInspection();
    message.success(`自动生成 ${orders.length} 条巡检工单`);
    await refreshAll();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        id: `WO${Date.now()}`,
        ...values,
        scheduledDate: values.scheduledDate?.format('YYYY-MM-DD'),
        status: 'pending',
        createdAt: new Date().toISOString(),
        findings: [],
        hasDroneImagery: false,
      };
      await api.create('inspectionWorkOrders', payload);
      message.success('工单创建成功');
      await refreshAll();
      setModalOpen(false);
      form.resetFields();
    } catch (e) {}
  };

  const handleAddFinding = async () => {
    try {
      if (!selectedOrder) return;
      const values = await findingForm.validateFields();
      const newFindings: InspectionFinding[] = [...(selectedOrder.findings || []), values];
      await api.update('inspectionWorkOrders', selectedOrder.id, { findings: newFindings });
      message.success('缺陷已记录，将自动生成维修任务');
      await refreshAll();
      setFindingModal(false);
      findingForm.resetFields();
      if (detailOpen) {
        const updated = await api.getById('inspectionWorkOrders', selectedOrder.id) as InspectionWorkOrder;
        setSelectedOrder(updated);
      }
    } catch (e) {}
  };

  const handleComplete = async (order: InspectionWorkOrder) => {
    await api.update('inspectionWorkOrders', order.id, {
      status: 'completed',
      completedDate: new Date().toISOString().split('T')[0],
    });
    message.success('巡检工单已完成');
    await refreshAll();
  };

  const columns: ColumnsType<InspectionWorkOrder> = [
    { title: '工单编号', dataIndex: 'id', width: 150, sorter: (a, b) => a.id.localeCompare(b.id) },
    {
      title: '线路', dataIndex: 'lineId', width: 160,
      render: (id) => {
        const line = lines.find(l => l.id === id);
        return <Space><CarOutlined /><Text strong>{line?.name || id}</Text></Space>;
      },
    },
    { title: '类型', dataIndex: 'type', width: 100, render: t => typeMap[t] },
    {
      title: '优先级', dataIndex: 'priority', width: 90,
      render: p => <Tag color={priorityMap[p]?.color}>{priorityMap[p]?.label}</Tag>,
    },
    {
      title: '巡检班组', dataIndex: 'teamId', width: 140,
      render: id => <Space><TeamOutlined />{getTeamName(id)}</Space>,
    },
    {
      title: '无人机巡检', dataIndex: 'hasDroneImagery', width: 100, align: 'center',
      render: v => v ? <Tag icon={<CameraOutlined />} color="geekblue">已上传</Tag> : <Tag color="default">未上传</Tag>,
    },
    { title: '计划日期', dataIndex: 'scheduledDate', width: 110 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Tag color={statusMap[s]?.color} icon={<ClockCircleOutlined />}>{statusMap[s]?.label}</Tag>,
    },
    {
      title: '发现缺陷', dataIndex: 'findings', width: 100, align: 'center',
      render: (f) => f?.length > 0
        ? <Badge count={f.length} size="small" offset={[0, 0]}><WarningOutlined style={{ color: '#faad14', fontSize: 18 }} /></Badge>
        : <SafetyOutlined style={{ color: '#52c41a' }} />,
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right',
      render: (_, order) => (
        <Space size="small">
          <Button size="small" icon={<FileTextOutlined />} onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}>详情</Button>
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleComplete(order)}>完成</Button>
          )}
          {order.status === 'inProgress' && (
            <Button size="small" icon={<ToolOutlined />} onClick={() => { setSelectedOrder(order); setFindingModal(true); }}>记录缺陷</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">输电线路巡检工单系统</h2>
        <Space>
          <Button icon={<CloudOutlined />} onClick={handleAutoGenerate}>
            智能生成巡检计划
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            创建巡检工单
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="工单总数" value={stats.total} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="待执行" value={stats.pending} valueStyle={{ color: '#1677ff' }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#faad14' }} prefix={<CarOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} prefix={<CheckOutlined />} /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="发现缺陷" value={stats.hasFindings} valueStyle={{ color: '#ff4d4f' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card size="small" title={<span><WarningOutlined /> 线路风险评估排序</span>}>
            <ReactECharts option={lineRiskOption} style={{ height: 340 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title={<span><CarOutlined /> 输电线路状态</span>}>
            <Table
              size="small"
              dataSource={lines}
              rowKey="id"
              pagination={false}
              scroll={{ y: 340 }}
              columns={[
                { title: '线路名称', dataIndex: 'name', width: 140 },
                { title: '电压等级', dataIndex: 'voltage', width: 90, render: v => `${v}kV` },
                { title: '长度 (km)', dataIndex: 'length', width: 90, align: 'right' },
                {
                  title: '负载率', dataIndex: 'loadRate', width: 130,
                  render: v => <Progress percent={Math.round(v * 100)} size="small" status={v > 0.85 ? 'exception' : 'normal'} />,
                },
                {
                  title: '故障率', dataIndex: 'failureRate', width: 90, align: 'right',
                  render: v => `${(v * 100).toFixed(1)}%`,
                },
                {
                  title: '天气风险', dataIndex: 'weatherRisk', width: 90,
                  render: v => <Tag color={weatherRiskMap[v]?.color}>{weatherRiskMap[v]?.label}</Tag>,
                },
                { title: '上次巡检', dataIndex: 'lastInspection', width: 100 },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<span><FileTextOutlined /> 巡检工单列表</span>} style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <Select placeholder="工单状态" allowClear style={{ width: 140 }} value={searchStatus} onChange={setSearchStatus}>
            {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
          </Select>
        </Space>
        <Table
          columns={columns}
          dataSource={inspectionOrders.filter(o => !searchStatus || o.status === searchStatus)}
          rowKey="id"
          size="middle"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 8, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="创建巡检工单"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="创建"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="巡检线路" name="lineId" rules={[{ required: true }]}>
                <Select placeholder="选择线路">
                  {lines.map(l => <Option key={l.id} value={l.id}>{l.name} ({l.voltage}kV)</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="巡检班组" name="teamId" rules={[{ required: true }]}>
                <Select placeholder="选择班组">
                  {inspectionTeams.filter(t => t.status === 'available').map(t => (
                    <Option key={t.id} value={t.id}>
                      {t.name} {t.hasDrone && '🛸'} ({t.members}人)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="巡检类型" name="type" rules={[{ required: true }]} initialValue="routine">
                <Select>
                  <Option value="routine">常规巡检</Option>
                  <Option value="urgent">紧急巡检</Option>
                  <Option value="special">专项巡检</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="优先级" name="priority" rules={[{ required: true }]} initialValue="medium">
                <Select>
                  {Object.entries(priorityMap).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="计划日期" name="scheduledDate" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={selectedOrder ? `工单详情 - ${selectedOrder.id}` : ''}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
        extra={selectedOrder && selectedOrder.status === 'inProgress' ? (
          <Space>
            <Upload
              multiple
              beforeUpload={() => false}
              onChange={() => { message.success('无人机影像已上传'); }}
            >
              <Button icon={<CameraOutlined />}>上传无人机影像</Button>
            </Upload>
            <Button type="primary" icon={<ToolOutlined />} onClick={() => setFindingModal(true)}>记录缺陷</Button>
          </Space>
        ) : null}
      >
        {selectedOrder && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="工单编号">{selectedOrder.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[selectedOrder.status]?.color}>{statusMap[selectedOrder.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="线路">{getLineName(selectedOrder.lineId)}</Descriptions.Item>
              <Descriptions.Item label="班组">{getTeamName(selectedOrder.teamId)}</Descriptions.Item>
              <Descriptions.Item label="类型">{typeMap[selectedOrder.type]}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityMap[selectedOrder.priority]?.color}>{priorityMap[selectedOrder.priority]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="计划日期">{selectedOrder.scheduledDate}</Descriptions.Item>
              <Descriptions.Item label="完成日期">{selectedOrder.completedDate || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(selectedOrder.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="缺陷记录" extra={<Tag color={selectedOrder.findings?.length > 0 ? 'orange' : 'green'}>{selectedOrder.findings?.length || 0} 项</Tag>}>
              {selectedOrder.findings?.length === 0 ? (
                <Empty description="暂无缺陷记录" />
              ) : (
                <List
                  dataSource={selectedOrder.findings}
                  renderItem={(f, i) => (
                    <List.Item>
                      <Space>
                        <Tag color={f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'orange' : f.severity === 'medium' ? 'blue' : 'default'}>
                          {f.severity === 'critical' ? '严重' : f.severity === 'high' ? '高' : f.severity === 'medium' ? '中' : '低'}
                        </Tag>
                        <Text>#{i + 1} {f.description}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card size="small" title="无人机巡检影像">
              {selectedOrder.hasDroneImagery ? (
                <Row gutter={[8, 8]}>
                  {[1, 2, 3, 4].map(i => (
                    <Col span={12} key={i}>
                      <div style={{
                        height: 120,
                        background: `linear-gradient(${45 * i}deg, #1677ff33, #52c41a33)`,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed #1677ff',
                      }}>
                        <Space direction="vertical" align="center">
                          <CameraOutlined style={{ fontSize: 28, color: '#1677ff' }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>影像 #{i}</Text>
                        </Space>
                      </div>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty description="尚未上传无人机巡检影像" />
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="记录巡检缺陷"
        open={findingModal}
        onCancel={() => setFindingModal(false)}
        onOk={handleAddFinding}
        okText="提交缺陷"
        destroyOnClose
      >
        <Paragraph type="secondary">发现的缺陷将自动生成维修任务并派单至相关班组。</Paragraph>
        <Form form={findingForm} layout="vertical">
          <Form.Item label="缺陷描述" name="description" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="详细描述发现的缺陷情况..." />
          </Form.Item>
          <Form.Item label="严重程度" name="severity" rules={[{ required: true }]} initialValue="medium">
            <Select>
              <Option value="low">低 - 记录观察</Option>
              <Option value="medium">中 - 计划处理</Option>
              <Option value="high">高 - 尽快处理</Option>
              <Option value="critical">严重 - 立即处理</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LineInspection;
