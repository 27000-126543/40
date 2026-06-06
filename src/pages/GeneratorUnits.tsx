import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select,
  DatePicker, Card, Row, Col, Statistic, App as AntApp, Tooltip, Popconfirm, Progress, Typography
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ThunderboltOutlined, ToolOutlined, SafetyOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import type { GeneratorUnit, PowerPlant } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const unitTypeMap: Record<string, { label: string; color: string }> = {
  thermal: { label: '火电', color: 'red' },
  hydro: { label: '水电', color: 'blue' },
  nuclear: { label: '核电', color: 'purple' },
  wind: { label: '风电', color: 'green' },
  solar: { label: '光伏', color: 'orange' },
};

const statusMap: Record<string, { label: string; color: string }> = {
  running: { label: '运行中', color: 'green' },
  stopped: { label: '停机', color: 'default' },
  maintenance: { label: '检修', color: 'orange' },
  fault: { label: '故障', color: 'red' },
};

const GeneratorUnits: React.FC = () => {
  const { message } = AntApp.useApp();
  const { units, plants, refreshAll } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<GeneratorUnit | null>(null);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const stats = useMemo(() => {
    const total = units.length;
    const running = units.filter(u => u.status === 'running').length;
    const maintenance = units.filter(u => u.status === 'maintenance').length;
    const totalCapacity = units.reduce((s, u) => s + u.ratedCapacity, 0);
    const totalOutput = units.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0);
    return { total, running, maintenance, totalCapacity, totalOutput: Math.round(totalOutput) };
  }, [units]);

  const filteredUnits = useMemo(() => {
    return units.filter(u => {
      if (searchText && !u.name.includes(searchText) && !u.id.includes(searchText)) return false;
      if (typeFilter && u.type !== typeFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      return true;
    });
  }, [units, searchText, typeFilter, statusFilter]);

  const getPlantName = (plantId: string) => {
    return plants.find(p => p.id === plantId)?.name || plantId;
  };

  const openModal = (unit?: GeneratorUnit) => {
    setEditingUnit(unit || null);
    if (unit) {
      form.setFieldsValue({
        ...unit,
        maintenanceDate: unit.maintenanceSchedule ? [
          dayjs(unit.maintenanceSchedule.startDate),
          dayjs(unit.maintenanceSchedule.endDate),
        ] : undefined,
        maintenanceType: unit.maintenanceSchedule?.type,
      });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        ...editingUnit,
        ...values,
        maintenanceSchedule: values.maintenanceDate ? {
          startDate: values.maintenanceDate[0].format('YYYY-MM-DD'),
          endDate: values.maintenanceDate[1].format('YYYY-MM-DD'),
          type: values.maintenanceType || '计划检修',
        } : null,
      };

      if (editingUnit) {
        await api.update('generatorUnits', editingUnit.id, payload);
        message.success('机组信息更新成功');
      } else {
        payload.id = `U${Date.now().toString().slice(-4)}`;
        payload.currentOutput = values.status === 'running' ? values.ratedCapacity * 0.7 : 0;
        payload.reactiveOutput = 0;
        await api.create('generatorUnits', payload);
        message.success('机组添加成功');
      }

      await refreshAll();
      setModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    await api.remove('generatorUnits', id);
    message.success('删除成功');
    await refreshAll();
  };

  const columns: ColumnsType<GeneratorUnit> = [
    {
      title: '机组编号',
      dataIndex: 'id',
      width: 100,
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    {
      title: '机组名称',
      dataIndex: 'name',
      width: 140,
      filterSearch: true,
    },
    {
      title: '所属电厂',
      dataIndex: 'plantId',
      width: 180,
      render: (id) => getPlantName(id),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (t) => <Tag color={unitTypeMap[t]?.color}>{unitTypeMap[t]?.label}</Tag>,
      filters: Object.entries(unitTypeMap).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (v, r) => r.type === v,
    },
    {
      title: '额定容量 (MW)',
      dataIndex: 'ratedCapacity',
      width: 110,
      sorter: (a, b) => a.ratedCapacity - b.ratedCapacity,
      align: 'right',
    },
    {
      title: '当前出力',
      dataIndex: 'currentOutput',
      width: 200,
      align: 'center',
      render: (val, record) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Space>
            <Text strong>{val} MW</Text>
            <Text type="secondary">/ {record.ratedCapacity} MW</Text>
          </Space>
          <Progress
            percent={Math.round((val / record.ratedCapacity) * 100)}
            size="small"
            status={record.status === 'running' ? 'active' : 'exception'}
          />
        </Space>
      ),
    },
    {
      title: '无功出力',
      dataIndex: 'reactiveOutput',
      width: 100,
      align: 'right',
      render: (v) => `${v} MVar`,
    },
    {
      title: '爬坡速率',
      dataIndex: 'rampRate',
      width: 100,
      align: 'right',
      render: (v) => `${v} MW/min`,
    },
    {
      title: '最小开机',
      dataIndex: 'minUpTime',
      width: 90,
      align: 'right',
      render: (v) => `${v} h`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label}</Tag>,
      filters: Object.entries(statusMap).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (v, r) => r.status === v,
    },
    {
      title: '检修排期',
      dataIndex: 'maintenanceSchedule',
      width: 180,
      render: (sch) => sch ? (
        <Tooltip title={`${sch.startDate} ~ ${sch.endDate}`}>
          <Tag icon={<ToolOutlined />} color="orange">{sch.type}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{sch.startDate.slice(5)}</Text>
        </Tooltip>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>编辑</Button>
          <Popconfirm title="确定删除该机组？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">发电厂机组信息管理</h2>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            添加机组
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="机组总数" value={stats.total} prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="运行中" value={stats.running} valueStyle={{ color: '#52c41a' }} prefix={<SafetyOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="检修中" value={stats.maintenance} valueStyle={{ color: '#faad14' }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={6} sm={4}><Card size="small"><Statistic title="总容量" value={stats.totalCapacity} suffix="MW" /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="当前总出力" value={stats.totalOutput} suffix="MW" valueStyle={{ color: '#1677ff' }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索机组编号/名称"
            allowClear
            style={{ width: 240 }}
            prefix={<SearchOutlined />}
            onSearch={setSearchText}
            onChange={(e) => !e.target.value && setSearchText('')}
          />
          <Select
            placeholder="机组类型"
            allowClear
            style={{ width: 140 }}
            value={typeFilter}
            onChange={setTypeFilter}
          >
            {Object.entries(unitTypeMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="运行状态"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {Object.entries(statusMap).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Card size="small">
        <Table
          columns={columns}
          dataSource={filteredUnits}
          rowKey="id"
          size="middle"
          scroll={{ x: 1400, y: 520 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 台机组` }}
        />
      </Card>

      <Modal
        title={editingUnit ? '编辑机组信息' : '添加发电机组'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editingUnit ? '保存' : '添加'}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="机组编号" name="id" rules={[{ required: true, message: '请输入机组编号' }]}>
                <Input placeholder="如: U001" disabled={!!editingUnit} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="机组名称" name="name" rules={[{ required: true, message: '请输入机组名称' }]}>
                <Input placeholder="如: 1号机组" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="所属电厂" name="plantId" rules={[{ required: true, message: '请选择所属电厂' }]}>
                <Select placeholder="选择电厂">
                  {plants.map((p: PowerPlant) => (
                    <Option key={p.id} value={p.id}>{p.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="机组类型" name="type" rules={[{ required: true }]}>
                <Select placeholder="选择类型">
                  {Object.entries(unitTypeMap).map(([k, v]) => (
                    <Option key={k} value={k}>{v.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="额定容量 (MW)" name="ratedCapacity" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="爬坡速率 (MW/min)" name="rampRate" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="最小开机时间 (h)" name="minUpTime" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="排放系数 (t/MWh)" name="emissionRate" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="启动成本 (元)" name="startCost" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="运行状态" name="status" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(statusMap).map(([k, v]) => (
                    <Option key={k} value={k}>{v.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="检修排期" name="maintenanceDate">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="检修类型" name="maintenanceType">
                <Select>
                  <Option value="大修">大修</Option>
                  <Option value="小修">小修</Option>
                  <Option value="临修">临修</Option>
                  <Option value="换料大修">换料大修</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default GeneratorUnits;
