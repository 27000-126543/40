import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card, Row, Col, Slider, Space, Tag, Typography, Drawer, List, Progress,
  Badge, Tooltip, Radio, Button, Statistic, Divider, Empty, Alert
} from 'antd';
import {
  ThunderboltOutlined, DashboardOutlined, EnvironmentOutlined,
  SafetyOutlined, WarningOutlined, EyeOutlined, LineChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../store';
import type { TopologyNode, TopologyLink, GeneratorUnit, Busbar, TransmissionLine } from '../types';

const { Title, Text, Paragraph } = Typography;

const loadColor = (rate: number) => {
  if (rate < 0.5) return '#52c41a';
  if (rate < 0.7) return '#1677ff';
  if (rate < 0.85) return '#faad14';
  return '#ff4d4f';
};

const voltageColor = (v: number, min: number, max: number) => {
  const ratio = (v - min) / (max - min);
  if (ratio < 0.2) return '#1677ff';
  if (ratio < 0.4) return '#52c41a';
  if (ratio < 0.6) return '#faad14';
  return '#ff4d4f';
};

const nodeTypeStyle: Record<string, { color: string; icon: string; size: number }> = {
  plant: { color: '#52c41a', icon: '⚡', size: 36 },
  busbar: { color: '#1677ff', icon: '◈', size: 28 },
  substation: { color: '#722ed1', icon: '🏭', size: 32 },
  load: { color: '#fa8c16', icon: '🏠', size: 24 },
};

const TopologyView: React.FC = () => {
  const { topology, units, busbars, lines, plants, substations, refreshAll } = useStore();
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'voltage' | 'load'>('load');
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [hoveredLink, setHoveredLink] = useState<TopologyLink | null>(null);
  const [time, setTime] = useState(dayjs());

  useEffect(() => {
    const t = setInterval(() => setTime(dayjs()), 1000);
    return () => clearInterval(t);
  }, []);

  const getUnitForNode = (nodeId: string): GeneratorUnit | null => {
    return units.find(u => u.plantId === nodeId) || null;
  };

  const getBusbarForNode = (nodeId: string): Busbar | null => {
    return busbars.find(b => b.id === nodeId) || null;
  };

  const getLineForLink = (lineId: string): TransmissionLine | null => {
    return lines.find(l => l.id === lineId) || null;
  };

  const displayNodes = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.map(n => ({
      ...n,
      voltage: n.voltage || (busbars.find(b => b.id === n.id)?.voltage || 0),
    }));
  }, [topology, busbars]);

  const displayLinks = useMemo(() => {
    if (!topology) return [];
    return topology.links.map(l => {
      const line = l.lineId ? getLineForLink(l.lineId) : null;
      return {
        ...l,
        loadRate: l.loadRate || line?.loadRate || 0.5,
        lineData: line,
      };
    });
  }, [topology, lines]);

  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    displayNodes.forEach(n => {
      map[n.id] = { x: n.x, y: n.y };
    });
    return map;
  }, [displayNodes]);

  const handleNodeClick = (node: TopologyNode) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  };

  const renderLegend = () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <Text type="secondary" strong>图例:</Text>
      <Space><span style={{ width: 12, height: 12, borderRadius: 3, background: '#52c41a' }} /><Text type="secondary">发电厂</Text></Space>
      <Space><span style={{ width: 12, height: 12, borderRadius: 3, background: '#1677ff' }} /><Text type="secondary">母线</Text></Space>
      <Space><span style={{ width: 12, height: 12, borderRadius: 3, background: '#722ed1' }} /><Text type="secondary">变电站</Text></Space>
      <Divider type="vertical" />
      <Text type="secondary" strong>线路负载:</Text>
      <Space><span style={{ width: 24, height: 4, background: '#52c41a' }} /><Text type="secondary">{'<50%'}</Text></Space>
      <Space><span style={{ width: 24, height: 4, background: '#1677ff' }} /><Text type="secondary">50-70%</Text></Space>
      <Space><span style={{ width: 24, height: 4, background: '#faad14' }} /><Text type="secondary">70-85%</Text></Space>
      <Space><span style={{ width: 24, height: 4, background: '#ff4d4f' }} /><Text type="secondary">{'>85%'}</Text></Space>
    </div>
  );

  const getSelectedNodeDetail = () => {
    if (!selectedNode) return null;

    if (selectedNode.type === 'plant') {
      const plant = plants.find(p => p.id === selectedNode.id);
      const plantUnits = units.filter(u => u.plantId === selectedNode.id);
      return {
        title: plant?.name || selectedNode.name,
        subtitle: plant?.region || '',
        type: '发电厂',
        icon: <ThunderboltOutlined style={{ color: '#52c41a', fontSize: 32 }} />,
        content: (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[16, 8]}>
              <Col span={12}><Statistic title="装机容量" value={plant?.capacity} suffix="MW" /></Col>
              <Col span={12}><Statistic title="机组数" value={plantUnits.length} /></Col>
              <Col span={12}>
                <Statistic
                  title="当前出力"
                  value={Math.round(plantUnits.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0))}
                  suffix="MW"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="运行机组"
                  value={plantUnits.filter(u => u.status === 'running').length}
                  suffix={`/ ${plantUnits.length}`}
                />
              </Col>
            </Row>
            <Divider />
            <Text strong>机组列表:</Text>
            <List
              size="small"
              dataSource={plantUnits}
              renderItem={u => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Tag color={u.status === 'running' ? 'green' : u.status === 'maintenance' ? 'orange' : 'default'}>
                        {u.status === 'running' ? '运行' : u.status === 'maintenance' ? '检修' : '停机'}
                      </Tag>
                      <Text strong>{u.name}</Text>
                    </Space>
                    <Text>{u.currentOutput} / {u.ratedCapacity} MW</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ),
      };
    }

    if (selectedNode.type === 'busbar') {
      const busbar = busbars.find(b => b.id === selectedNode.id);
      return {
        title: busbar?.name || selectedNode.name,
        subtitle: selectedNode.voltage ? `${selectedNode.voltage} kV` : '',
        type: '母线',
        icon: <DashboardOutlined style={{ color: '#1677ff', fontSize: 32 }} />,
        content: busbar ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Statistic
                  title="当前电压"
                  value={busbar.voltage}
                  suffix="kV"
                  valueStyle={{
                    color: busbar.voltage < busbar.voltageLimit.min || busbar.voltage > busbar.voltageLimit.max
                      ? '#ff4d4f' : '#52c41a',
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="系统频率"
                  value={busbar.frequency}
                  suffix="Hz"
                  valueStyle={{ color: Math.abs(busbar.frequency - 50) > 0.2 ? '#ff4d4f' : '#52c41a' }}
                />
              </Col>
            </Row>
            <Alert
              type="info"
              showIcon
              message={`电压允许范围: ${busbar.voltageLimit.min} ~ ${busbar.voltageLimit.max} kV`}
            />
            <Divider />
            <Text strong>连接线路:</Text>
            <List
              size="small"
              dataSource={lines.filter(l => l.from === busbar.id || l.to === busbar.id)}
              renderItem={l => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text>{l.name}</Text>
                    <Space>
                      <Progress percent={Math.round(l.loadRate * 100)} size="small" style={{ width: 120 }} />
                      <Tag color={loadColor(l.loadRate)}>{Math.round(l.loadRate * 100)}%</Tag>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : <Empty />,
      };
    }

    if (selectedNode.type === 'substation') {
      const sub = substations.find(s => s.id === selectedNode.id);
      return {
        title: sub?.name || selectedNode.name,
        subtitle: sub ? `${sub.location.lat.toFixed(2)}, ${sub.location.lng.toFixed(2)}` : '',
        type: '变电站',
        icon: <EnvironmentOutlined style={{ color: '#722ed1', fontSize: 32 }} />,
        content: sub ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[16, 8]}>
              <Col span={12}><Statistic title="设备数量" value={sub.devices.length} /></Col>
              <Col span={12}>
                <Statistic
                  title="异常设备"
                  value={sub.devices.filter(d => d.status === 'warning' || d.status === 'fault' || d.status === 'overload').length}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>
            <Divider />
            <Text strong>设备列表:</Text>
            <List
              size="small"
              dataSource={sub.devices}
              renderItem={d => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Tag color={d.status === 'normal' || d.status === 'closed' ? 'green' : d.status === 'warning' || d.status === 'overload' ? 'orange' : 'red'}>
                        {d.status === 'closed' ? '合闸' : d.status === 'normal' ? '正常' : d.status === 'warning' ? '预警' : d.status === 'overload' ? '过载' : d.status}
                      </Tag>
                      <Text strong>{d.name}</Text>
                      <Text type="secondary">
                        {d.type === 'transformer' ? '变压器' : d.type === 'circuitBreaker' ? '断路器' : d.type}
                      </Text>
                    </Space>
                    {d.loadRate != null && (
                      <Progress percent={Math.round(d.loadRate * 100)} size="small" style={{ width: 100 }} />
                    )}
                    {d.temperature != null && (
                      <Text strong style={{ color: d.temperature > 75 ? '#ff4d4f' : '#52c41a' }}>
                        {d.temperature}°C
                      </Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : <Empty />,
      };
    }

    return null;
  };

  const detail = getSelectedNodeDetail();

  return (
    <div>
      <div className="page-header">
        <Space direction="vertical" size={0}>
          <h2 className="page-title" style={{ margin: 0 }}>可视化电网拓扑图</h2>
          <Space>
            <Text type="secondary">实时显示各节点电压和线路负载热力分布</Text>
            <Tag color="blue">{time.format('YYYY-MM-DD HH:mm:ss')}</Tag>
          </Space>
        </Space>
        <Space>
          <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)}>
            <Radio.Button value="load"><EyeOutlined /> 负载热力</Radio.Button>
            <Radio.Button value="voltage"><DashboardOutlined /> 电压分布</Radio.Button>
          </Radio.Group>
          <Space>
            <Text type="secondary">动画速度:</Text>
            <Slider min={0} max={3} step={0.5} value={animationSpeed} onChange={setAnimationSpeed} style={{ width: 100 }} />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>刷新</Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        {renderLegend()}
      </Card>

      <div className="topology-container">
        <svg className="topology-svg" viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="lineFlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {displayLinks.map((link, idx) => {
            const from = nodePositions[link.source];
            const to = nodePositions[link.target];
            if (!from || !to) return null;

            const loadRate = link.loadRate || 0.5;
            const color = loadColor(loadRate);
            const strokeWidth = 1 + loadRate * 5;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            return (
              <g key={`link-${idx}`} onMouseEnter={() => setHoveredLink(link)} onMouseLeave={() => setHoveredLink(null)}>
                <line
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={color}
                  strokeWidth={strokeWidth + 4}
                  opacity={0.2}
                />
                <line
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  style={{ cursor: 'pointer' }}
                  filter={hoveredLink === link ? 'url(#glow)' : undefined}
                />
                {animationSpeed > 0 && (
                  <line
                    x1={from.x} y1={from.y}
                    x2={to.x} y2={to.y}
                    stroke="url(#lineFlow)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    opacity={0.7}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      values="0;-200"
                      dur={`${3 / animationSpeed}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-dasharray"
                      values="0 200;100 100;0 200"
                      dur={`${3 / animationSpeed}s`}
                      repeatCount="indefinite"
                    />
                  </line>
                )}
                {hoveredLink === link && (
                  <g>
                    <rect
                      x={midX - 70} y={midY - 22}
                      width={140} height={36}
                      rx={6}
                      fill="rgba(0,0,0,0.85)"
                    />
                    <text x={midX} y={midY - 5} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                      {link.lineData?.name || '联络线'}
                    </text>
                    <text x={midX} y={midY + 9} textAnchor="middle" fill={color} fontSize="12" fontWeight="bold">
                      负载: {Math.round(loadRate * 100)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {displayNodes.map(node => {
            const style = nodeTypeStyle[node.type] || nodeTypeStyle.busbar;
            const busbar = getBusbarForNode(node.id);
            const voltColor = busbar
              ? voltageColor(busbar.voltage, busbar.voltageLimit.min, busbar.voltageLimit.max)
              : style.color;
            const showColor = viewMode === 'voltage' ? voltColor : style.color;

            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
              >
                {isSelected && (
                  <>
                    <circle r={style.size + 10} fill="url(#nodeGlow)" opacity={0.6}>
                      <animate attributeName="r" values={`${style.size + 8};${style.size + 14};${style.size + 8}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.3;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle r={style.size + 5} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.8} />
                  </>
                )}

                <circle
                  r={style.size}
                  fill={showColor}
                  stroke="#ffffff"
                  strokeWidth={3}
                  filter="url(#glow)"
                  opacity={0.9}
                />

                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fill="#ffffff"
                  fontSize={style.size * 0.6}
                  fontWeight="bold"
                >
                  {style.icon}
                </text>

                <text
                  y={style.size + 18}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="600"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  {node.name}
                </text>

                {node.type === 'busbar' && node.voltage && (
                  <text
                    y={style.size + 34}
                    textAnchor="middle"
                    fill={voltColor}
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {node.voltage} kV
                  </text>
                )}

                {node.type === 'plant' && (() => {
                  const plantUnits = units.filter(u => u.plantId === node.id);
                  const totalOut = plantUnits.filter(u => u.status === 'running').reduce((s, u) => s + u.currentOutput, 0);
                  const totalCap = plantUnits.reduce((s, u) => s + u.ratedCapacity, 0);
                  const rate = totalCap > 0 ? Math.round((totalOut / totalCap) * 100) : 0;
                  return (
                    <text
                      y={style.size + 34}
                      textAnchor="middle"
                      fill="#52c41a"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {Math.round(totalOut)} MW ({rate}%)
                    </text>
                  );
                })()}
              </g>
            );
          })}

          <g transform="translate(880, 700)">
            <rect x={-80} y={-20} width={160} height={30} rx={6} fill="rgba(0,0,0,0.6)" />
            <text textAnchor="middle" y={2} fill="#52c41a" fontSize="12" fontWeight="bold">
              ⚡ 系统运行正常
            </text>
          </g>
        </svg>
      </div>

      <Drawer
        title={detail ? (
          <Space direction="vertical" size={0}>
            <Space>
              {detail.icon}
              <Title level={4} style={{ margin: 0 }}>{detail.title}</Title>
            </Space>
            <Space>
              <Tag color="blue">{detail.type}</Tag>
              {detail.subtitle && <Text type="secondary">{detail.subtitle}</Text>}
            </Space>
          </Space>
        ) : ''}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={440}
      >
        {detail?.content}
      </Drawer>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card size="small" title={<span><DashboardOutlined /> 母线电压</span>}>
            <List
              size="small"
              dataSource={busbars}
              renderItem={b => {
                const outOfRange = b.voltage < b.voltageLimit.min || b.voltage > b.voltageLimit.max;
                return (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text strong>{b.name}</Text>
                      <Badge status={outOfRange ? 'error' : 'success'} />
                      <Text strong style={{ color: outOfRange ? '#ff4d4f' : '#52c41a' }}>{b.voltage} kV</Text>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card size="small" title={<span><LineChartOutlined /> 线路负载率 TOP</span>}>
            <Row gutter={[12, 12]}>
              {[...lines].sort((a, b) => b.loadRate - a.loadRate).map(line => (
                <Col xs={12} sm={8} key={line.id}>
                  <Card
                    size="small"
                    style={{
                      borderLeft: `4px solid ${loadColor(line.loadRate)}`,
                      background: line.loadRate > 0.85 ? '#fff2f0' : undefined,
                    }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Text strong style={{ fontSize: 13 }}>{line.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{line.voltage}kV · {line.length}km</Text>
                      <Progress
                        percent={Math.round(line.loadRate * 100)}
                        size="small"
                        strokeColor={loadColor(line.loadRate)}
                        status={line.loadRate > 0.85 ? 'exception' : 'active'}
                      />
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TopologyView;
