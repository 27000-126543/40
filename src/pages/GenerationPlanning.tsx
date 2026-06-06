import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, InputNumber, DatePicker,
  Typography, App as AntApp, Row, Col, Statistic, Progress, Tooltip, Popconfirm,
  Drawer, Descriptions, Badge, Select, Alert, Input
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, CloseOutlined, SendOutlined,
  ThunderboltOutlined, ClockCircleOutlined, PlusOutlined, EyeOutlined,
  EditOutlined, SafetyCertificateOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import type { ColumnsType } from 'antd/es/table';
import type { GenerationPlan, GeneratorUnit, UnitSchedule } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const planStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'orange' },
  approved: { label: '已审批', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  distributed: { label: '已下发', color: 'blue' },
};

const GenerationPlanning: React.FC = () => {
  const { message } = AntApp.useApp();
  const { plans, units, plants, refreshAll } = useStore();
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<GenerationPlan | null>(null);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustUnit, setAdjustUnit] = useState<UnitSchedule | null>(null);
  const [genForm] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || id;
  const getPlantName = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    return unit ? plants.find(p => p.id === unit.plantId)?.name || '' : '';
  };

  const generateLoadForecast = () => {
    return Array.from({ length: 24 }, (_, h) => {
      const base = 15000;
      const peak = 6000 * Math.sin((h - 6) * Math.PI / 12);
      return Math.round(base + Math.max(0, peak) + Math.random() * 500);
    });
  };

  const handleGeneratePlan = async () => {
    try {
      const values = await genForm.validateFields();
      const loadForecast = generateLoadForecast();
      const plan = await api.generatePlan({
        date: values.date.format('YYYY-MM-DD'),
        loadForecast,
        reserveMargin: values.reserveMargin,
        emissionLimit: values.emissionLimit,
      });
      message.success(`发电计划生成成功: ${plan.id}`);
      await refreshAll();
      setGenModalOpen(false);
      genForm.resetFields();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (plan: GenerationPlan) => {
    await api.approvePlan(plan.id);
    message.success('计划已审批并下发至各电厂终端');
    await refreshAll();
  };

  const handleConfirm = async (planId: string, unitId: string) => {
    await api.confirmPlan(planId, unitId);
    message.success('值班长已确认执行该机组计划');
    await refreshAll();
  };

  const handleRequestAdjust = async () => {
    try {
      const values = await adjustForm.validateFields();
      message.info(`调整申请已提交至调度中心审批: ${values.reason}`);
      setAdjustModal(false);
      adjustForm.resetFields();
    } catch (e) {}
  };

  const openDetail = (plan: GenerationPlan) => {
    setSelectedPlan(plan);
    setDetailDrawer(true);
  };

  const ganttOption = useMemo(() => {
    if (!selectedPlan) return {};
    const hours = Array.from({ length: 24 }, (_, i) => `${i}`);
    const seriesData: any[] = [];
    const unitNames: string[] = [];

    selectedPlan.schedules.forEach((sch, idx) => {
      unitNames.push(getUnitName(sch.unitId));
      for (let h = 0; h < 24; h++) {
        const val = Number(sch[`hour${h}`]) || 0;
        if (val > 0) {
          seriesData.push([h, idx, val]);
        }
      }
    });

    return {
      tooltip: {
        formatter: (p: any) => {
          const [h, idx, val] = p.data;
          return `${unitNames[idx]}<br/>${h}:00 - ${h + 1}:00<br/>出力: ${val} MW`;
        },
      },
      grid: { left: 120, right: 30, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: hours,
        name: '小时',
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: unitNames,
        inverse: true,
      },
      visualMap: {
        min: 0,
        max: 1000,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#e0f7fa', '#00acc1', '#006064'] },
      },
      series: [{
        type: 'heatmap',
        data: seriesData,
        label: { show: true, formatter: (p: any) => p.data[2] > 100 ? p.data[2] : '', fontSize: 10 },
      }],
    };
  }, [selectedPlan, units]);

  const loadCurveOption = useMemo(() => {
    if (!selectedPlan) return {};
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const scheduled = hours.map((_, h) =>
      selectedPlan.schedules.reduce((s, sch) => s + (Number(sch[`hour${h}`]) || 0), 0)
    );
    const loadForecast = hours.map((_, h) =>
      Math.round(selectedPlan.totalLoadForecast * (1 + 0.3 * Math.sin((h - 6) * Math.PI / 12)))
    );
    const reserve = hours.map((_, h) =>
      Math.round(loadForecast[h] * selectedPlan.reserveMargin)
    );

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['计划总出力', '负荷预测', '备用容量'], top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 40 },
      xAxis: { type: 'category', data: hours },
      yAxis: { type: 'value', name: 'MW' },
      series: [
        { name: '计划总出力', type: 'line', stack: 'total', smooth: true, areaStyle: {}, data: scheduled, itemStyle: { color: '#52c41a' } },
        { name: '备用容量', type: 'line', stack: 'total', smooth: true, areaStyle: {}, data: reserve, itemStyle: { color: '#faad14' } },
        { name: '负荷预测', type: 'line', smooth: true, data: loadForecast, lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: '#ff4d4f' } },
      ],
    };
  }, [selectedPlan]);

  const planColumns: ColumnsType<GenerationPlan> = [
    { title: '计划编号', dataIndex: 'id', width: 140, sorter: (a, b) => a.id.localeCompare(b.id) },
    { title: '日期', dataIndex: 'date', width: 120, sorter: (a, b) => a.date.localeCompare(b.date) },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s) => <Tag color={planStatusMap[s]?.color} icon={
        s === 'approved' ? <SafetyCertificateOutlined /> : s === 'distributed' ? <SendOutlined /> : <ClockCircleOutlined />
      }>{planStatusMap[s]?.label}</Tag>,
    },
    { title: '预测平均负荷 (MW)', dataIndex: 'totalLoadForecast', width: 150, align: 'right', render: v => v?.toFixed(0) },
    { title: '备用率', dataIndex: 'reserveMargin', width: 90, render: v => `${(v * 100).toFixed(0)}%` },
    { title: '排放限值 (t)', dataIndex: 'emissionLimit', width: 110, align: 'right' },
    {
      title: '预计排放 (t)', dataIndex: 'totalEmission', width: 110, align: 'right',
      render: (v, r) => {
        if (v == null) return '-';
        const exceed = r.emissionLimit && v > r.emissionLimit;
        return <span style={{ color: exceed ? '#ff4d4f' : '#52c41a' }}>{v.toFixed(1)}</span>;
      },
    },
    { title: '启停成本 (万元)', dataIndex: 'totalStartCost', width: 120, align: 'right', render: v => v?.toFixed(2) ?? '-' },
    { title: '机组数', dataIndex: 'schedules', width: 70, render: s => s.length, align: 'center' },
    {
      title: '创建时间', dataIndex: 'createdAt', width: 170,
      render: t => dayjs(t).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作', key: 'action', width: 260, fixed: 'right',
      render: (_, plan) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(plan)}>详情</Button>
          {plan.status === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(plan)}>审批下发</Button>
              <Popconfirm title="确定驳回此计划？" onConfirm={() => message.info('计划已驳回')}>
                <Button size="small" danger icon={<CloseOutlined />}>驳回</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">发电计划调度</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenModalOpen(true)}>
            生成日发电计划
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="计划总数" value={plans.length} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="待审批" value={plans.filter(p => p.status === 'pending').length} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={8} sm={6}><Card size="small"><Statistic title="已审批" value={plans.filter(p => p.status === 'approved' || p.status === 'distributed').length} valueStyle={{ color: '#52c41a' }} prefix={<SafetyCertificateOutlined />} /></Card></Col>
        <Col xs={24} sm={6}><Card size="small"><Statistic title="在线机组" value={units.filter(u => u.status === 'running').length} suffix={`/ ${units.length}`} prefix={<ThunderboltOutlined />} /></Card></Col>
      </Row>

      <Card size="small" title="发电计划列表">
        <Table
          columns={planColumns}
          dataSource={plans}
          rowKey="id"
          size="middle"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 8, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="生成每日发电计划"
        open={genModalOpen}
        onCancel={() => setGenModalOpen(false)}
        onOk={handleGeneratePlan}
        okText="生成计划"
        width={560}
      >
        <Paragraph type="secondary" style={{ marginBottom: 20 }}>
          系统将根据负荷预测、备用容量、环保排放限值和机组启停成本自动优化调度计划，
          并考虑爬坡速率、最小开机时间等约束条件。
        </Paragraph>
        <Form form={genForm} layout="vertical">
          <Form.Item label="计划日期" name="date" rules={[{ required: true, message: '请选择日期' }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="系统备用率 (%)" name="reserveMargin" rules={[{ required: true }]} initialValue={0.15}>
                <InputNumber min={5 as number} max={30 as number} step={1} style={{ width: '100%' }} formatter={(value) => `${value}%`} parser={(value) => Number(value?.replace('%', '')) / 100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="日排放限值 (t)" name="emissionLimit" rules={[{ required: true }]} initialValue={5000}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            type="info"
            showIcon
            message="约束条件说明"
            description="爬坡速率、最小开机时间、检修排期等机组约束将在优化算法中自动考虑"
            style={{ marginTop: 8 }}
          />
        </Form>
      </Modal>

      <Drawer
        title={selectedPlan ? `发电计划详情 - ${selectedPlan.id}` : ''}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        width={1100}
        extra={selectedPlan && selectedPlan.status === 'pending' ? (
          <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => { handleApprove(selectedPlan); setDetailDrawer(false); }}>
            调度长审批
          </Button>
        ) : null}
      >
        {selectedPlan && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="计划编号">{selectedPlan.id}</Descriptions.Item>
              <Descriptions.Item label="日期">{selectedPlan.date}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={planStatusMap[selectedPlan.status]?.color}>{planStatusMap[selectedPlan.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="平均负荷预测">{selectedPlan.totalLoadForecast.toFixed(0)} MW</Descriptions.Item>
              <Descriptions.Item label="备用率">{(selectedPlan.reserveMargin * 100).toFixed(0)}%</Descriptions.Item>
              <Descriptions.Item label="排放限值">{selectedPlan.emissionLimit} t/日</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="负荷曲线与出力计划">
              <ReactECharts option={loadCurveOption} style={{ height: 280 }} notMerge />
            </Card>

            <Card size="small" title="各机组24小时出力计划 (MW)">
              <ReactECharts option={ganttOption} style={{ height: Math.max(300, selectedPlan.schedules.length * 35 + 100) }} notMerge />
            </Card>

            <Card size="small" title="机组计划明细" extra={<Text type="secondary">值班长可确认执行或申请调整</Text>}>
              <Table
                size="small"
                dataSource={selectedPlan.schedules}
                rowKey="unitId"
                pagination={false}
                columns={[
                  { title: '机组编号', dataIndex: 'unitId', width: 100 },
                  { title: '机组名称', width: 140, render: (_, r) => getUnitName(r.unitId) },
                  { title: '所属电厂', width: 180, render: (_, r) => getPlantName(r.unitId) },
                  {
                    title: '日均出力 (MW)', width: 120, align: 'right',
                    render: (_, r) => {
                      const total = Array.from({ length: 24 }, (_, h) => Number(r[`hour${h}`]) || 0).reduce((a, b) => a + b, 0);
                      return (total / 24).toFixed(1);
                    },
                  },
                  {
                    title: '最大出力 (MW)', width: 110, align: 'right',
                    render: (_, r) => Math.max(...Array.from({ length: 24 }, (_, h) => Number(r[`hour${h}`]) || 0)),
                  },
                  {
                    title: '执行状态', width: 110,
                    render: (_, r) => r.confirmed
                      ? <Badge status="success" text="值班长已确认" />
                      : <Badge status="warning" text="待确认" />,
                  },
                  {
                    title: '操作', width: 200,
                    render: (_, r) => (
                      <Space size="small">
                        {!r.confirmed && selectedPlan.status === 'approved' && (
                          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(selectedPlan.id, r.unitId)}>
                            确认执行
                          </Button>
                        )}
                        <Button size="small" icon={<EditOutlined />} onClick={() => { setAdjustUnit(r); setAdjustModal(true); }}>
                          申请调整
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="申请计划调整"
        open={adjustModal}
        onCancel={() => setAdjustModal(false)}
        onOk={handleRequestAdjust}
        okText="提交申请"
      >
        {adjustUnit && (
          <Form form={adjustForm} layout="vertical">
            <Paragraph type="secondary">
              机组: <Text strong>{getUnitName(adjustUnit.unitId)}</Text> 的调整申请需经调度中心审批后方可生效。
            </Paragraph>
            <Form.Item label="调整原因" name="reason" rules={[{ required: true, message: '请输入调整原因' }]}>
              <Select mode="tags" placeholder="选择或输入原因">
                <Option value="设备故障">设备故障</Option>
                <Option value="燃料不足">燃料不足</Option>
                <Option value="环保限制">环保限制</Option>
                <Option value="电网需求变更">电网需求变更</Option>
              </Select>
            </Form.Item>
            <Form.Item label="建议调整方案" name="adjustment" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="描述具体的出力调整建议..." />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default GenerationPlanning;
