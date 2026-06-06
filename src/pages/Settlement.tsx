import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, App as AntApp, Row, Col,
  Statistic, DatePicker, Select, InputNumber, Modal, Form, Descriptions,
} from 'antd';
import {
  DollarOutlined, FileExcelOutlined, ThunderboltOutlined, RiseOutlined,
  ArrowDownOutlined, SwapOutlined, CalculatorOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import type { SettlementData, PowerPlant } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const Settlement: React.FC = () => {
  const { message } = AntApp.useApp();
  const { settlements, plants, units, refreshAll } = useStore();
  const [settleMonth, setSettleMonth] = useState<string>(dayjs().format('YYYY-MM'));
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedData, setSelectedData] = useState<SettlementData | null>(null);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm] = Form.useForm();

  const getPlantName = (id: string) => plants.find(p => p.id === id)?.name || id;
  const getPlant = (id: string) => plants.find(p => p.id === id);

  const monthlyStats = useMemo(() => {
    const currentMonthData = settlements.filter(s => s.month === settleMonth);
    const totalGridEnergy = currentMonthData.reduce((s, d) => s + d.gridEnergy, 0);
    const totalTrade = currentMonthData.reduce((s, d) => s + d.tradeVolume, 0);
    const totalDeviation = currentMonthData.reduce((s, d) => s + d.deviationFee, 0);
    const totalSettlement = currentMonthData.reduce((s, d) => s + d.settlementAmount, 0);

    return {
      plantCount: currentMonthData.length,
      totalGridEnergy,
      totalTrade,
      totalDeviation,
      totalSettlement,
      avgPrice: totalGridEnergy > 0 ? totalSettlement / totalGridEnergy : 0,
    };
  }, [settlements, settleMonth]);

  const settlementChartOption = useMemo(() => {
    const currentMonthData = settlements.filter(s => s.month === settleMonth);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['上网电量', '发电权交易', '偏差考核'], top: 0 },
      grid: { left: 60, right: 60, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: currentMonthData.map(d => getPlantName(d.plantId).slice(0, 8)),
        axisLabel: { rotate: 15, fontSize: 11 },
      },
      yAxis: [
        { type: 'value', name: '电量 (MWh)' },
        { type: 'value', name: '金额 (元)' },
      ],
      series: [
        {
          name: '上网电量', type: 'bar', stack: 'energy', barWidth: 25,
          data: currentMonthData.map(d => d.gridEnergy), itemStyle: { color: '#52c41a' },
        },
        {
          name: '发电权交易', type: 'bar', barWidth: 25,
          data: currentMonthData.map(d => d.tradeVolume), itemStyle: { color: '#1677ff' },
        },
        {
          name: '偏差考核', type: 'line', yAxisIndex: 1, smooth: true,
          data: currentMonthData.map(d => d.deviationFee), itemStyle: { color: '#ff4d4f' },
          lineStyle: { width: 3 },
        },
      ],
    };
  }, [settlements, settleMonth, plants]);

  const handleExport = async () => {
    const result = await api.exportReport(settleMonth);
    if (result) {
      message.success(`报告已导出: ${result}`);
    }
  };

  const columns = [
    { title: '月份', dataIndex: 'month', width: 100 },
    {
      title: '发电厂', dataIndex: 'plantId', width: 200,
      render: (id: string) => {
        const plant = getPlant(id);
        return (
          <Space>
            <ThunderboltOutlined />
            <Text strong>{plant?.name || id}</Text>
            <Tag color="blue">{plant?.region}</Tag>
          </Space>
        );
      },
    },
    {
      title: '上网电量', dataIndex: 'gridEnergy', width: 130, align: 'right',
      render: (v: number) => <Space><Text strong>{v.toLocaleString()}</Text><Text type="secondary">MWh</Text></Space>,
      sorter: (a: SettlementData, b: SettlementData) => a.gridEnergy - b.gridEnergy,
    },
    {
      title: '发电权交易量', dataIndex: 'tradeVolume', width: 140, align: 'right',
      render: (v: number) => <Space><SwapOutlined style={{ color: '#1677ff' }} /><Text>{v.toLocaleString()}</Text><Text type="secondary">MWh</Text></Space>,
    },
    {
      title: '偏差考核费', dataIndex: 'deviationFee', width: 130, align: 'right',
      render: (v: number) => (
        <Space>
          <Text style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }} strong>
            ¥{v.toLocaleString()}
          </Text>
        </Space>
      ),
      sorter: (a: SettlementData, b: SettlementData) => a.deviationFee - b.deviationFee,
    },
    {
      title: '结算金额', dataIndex: 'settlementAmount', width: 150, align: 'right',
      render: (v: number) => <Text strong style={{ color: '#52c41a', fontSize: 15 }}>¥{v.toLocaleString()}</Text>,
      sorter: (a: SettlementData, b: SettlementData) => a.settlementAmount - b.settlementAmount,
    },
    {
      title: '操作', key: 'action', width: 180, render: (_: any, r: SettlementData) => (
        <Space size="small">
          <Button size="small" icon={<CalculatorOutlined />} onClick={() => { setSelectedData(r); setDetailVisible(true); }}>
            明细
          </Button>
          <Button size="small" icon={<FileExcelOutlined />} type="primary" onClick={handleExport}>
            导出
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">电量结算中心</h2>
        <Space>
          <DatePicker
            picker="month"
            value={dayjs(settleMonth)}
            onChange={(v) => v && setSettleMonth(v.format('YYYY-MM'))}
            allowClear={false}
          />
          <Button icon={<FileExcelOutlined />} type="primary" onClick={handleExport}>
            导出月度报告
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={4}><Card size="small"><Statistic title="结算电厂" value={monthlyStats.plantCount} prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col xs={8} sm={5}><Card size="small"><Statistic title="总上网电量" value={monthlyStats.totalGridEnergy.toLocaleString()} suffix="MWh" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={8} sm={5}><Card size="small"><Statistic title="发电权交易" value={monthlyStats.totalTrade.toLocaleString()} suffix="MWh" valueStyle={{ color: '#1677ff' }} prefix={<SwapOutlined />} /></Card></Col>
        <Col xs={12} sm={5}><Card size="small"><Statistic title="偏差考核费" value={monthlyStats.totalDeviation.toLocaleString()} prefix="¥" valueStyle={{ color: monthlyStats.totalDeviation > 0 ? '#ff4d4f' : '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={5}><Card size="small"><Statistic title="总结算金额" value={monthlyStats.totalSettlement.toLocaleString()} prefix="¥" valueStyle={{ color: '#722ed1', fontSize: 20 }} /></Card></Col>
        <Col xs={24} sm={5}><Card size="small"><Statistic title="平均电价" value={monthlyStats.avgPrice.toFixed(2)} prefix="¥" suffix="/MWh" /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card size="small" title={<span><RiseOutlined /> {settleMonth} 月度结算对比</span>}>
            <ReactECharts option={settlementChartOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<span><DollarOutlined /> 结算明细列表</span>}>
        <Table
          columns={columns as any}
          dataSource={settlements}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 8, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="结算明细"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          <Button key="adjust" type="primary" onClick={() => setAdjustModal(true)}>调整考核</Button>,
        ]}
        width={640}
      >
        {selectedData && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2} title={`${getPlantName(selectedData.plantId)} - ${selectedData.month}`}>
              <Descriptions.Item label="上网电量">{selectedData.gridEnergy.toLocaleString()} MWh</Descriptions.Item>
              <Descriptions.Item label="基准电价">¥40.00 / MWh</Descriptions.Item>
              <Descriptions.Item label="发电权交易">{selectedData.tradeVolume.toLocaleString()} MWh</Descriptions.Item>
              <Descriptions.Item label="交易电价">¥42.50 / MWh</Descriptions.Item>
              <Descriptions.Item label="电费小计" span={2}>
                <Text strong style={{ fontSize: 16 }}>
                  ¥{(selectedData.gridEnergy * 40 + selectedData.tradeVolume * 42.5).toLocaleString()}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="偏差电量">{(selectedData.deviationFee / 80).toFixed(0)} MWh</Descriptions.Item>
              <Descriptions.Item label="考核单价">¥80.00 / MWh</Descriptions.Item>
              <Descriptions.Item label="偏差考核费" span={2}>
                <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>¥{selectedData.deviationFee.toLocaleString()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="应付结算金额" span={2}>
                <Text strong style={{ color: '#52c41a', fontSize: 20 }}>
                  ¥{selectedData.settlementAmount.toLocaleString()}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>

      <Modal
        title="调整偏差考核"
        open={adjustModal}
        onCancel={() => setAdjustModal(false)}
        onOk={async () => {
          const v = await adjustForm.validateFields();
          if (selectedData) {
            const newDeviation = v.deviationFee;
            const newAmount = selectedData.settlementAmount - selectedData.deviationFee + newDeviation;
            await api.update('settlementData', selectedData.id, {
              deviationFee: newDeviation,
              settlementAmount: newAmount,
            });
            message.success('考核已调整');
            await refreshAll();
          }
          setAdjustModal(false);
        }}
      >
        {selectedData && (
          <Form form={adjustForm} layout="vertical" initialValues={{ deviationFee: selectedData.deviationFee }}>
            <Form.Item label="偏差考核费 (元)" name="deviationFee" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Settlement;
