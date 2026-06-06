import React, { useEffect, useState } from 'react';
import { Layout, Menu, Badge, Avatar, Dropdown, Space, Switch, Tooltip, Button, App as AntApp } from 'antd';
import {
  DashboardOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  RiseOutlined,
  AlertOutlined,
  SearchOutlined,
  ToolOutlined,
  BarChartOutlined,
  ShareAltOutlined,
  DollarOutlined,
  BellOutlined,
  UserOutlined,
  SoundOutlined,
  AudioOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import GeneratorUnits from './pages/GeneratorUnits';
import GenerationPlanning from './pages/GenerationPlanning';
import RealTimeMonitor from './pages/RealTimeMonitor';
import LineInspection from './pages/LineInspection';
import SubstationMonitor from './pages/SubstationMonitor';
import Settlement from './pages/Settlement';
import Statistics from './pages/Statistics';
import TopologyView from './pages/TopologyView';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '调度总览' },
  { key: '/topology', icon: <ShareAltOutlined />, label: '电网拓扑图' },
  { key: '/units', icon: <ThunderboltOutlined />, label: '机组信息管理' },
  { key: '/planning', icon: <FileTextOutlined />, label: '发电计划调度' },
  { key: '/monitor', icon: <RiseOutlined />, label: '实时运行监控' },
  { key: '/inspection', icon: <SearchOutlined />, label: '线路巡检工单' },
  { key: '/substation', icon: <ToolOutlined />, label: '变电站运维' },
  { key: '/settlement', icon: <DollarOutlined />, label: '电量结算' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计分析' },
];

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();
  const { alerts, agcEnabled, soundEnabled, toggleAGC, toggleSound, refreshAll } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        api.simulateTick().then((result) => {
          if (result?.events?.length > 0) {
            result.events.forEach((e: any) => {
              useStore.getState().addAlert(e);
            });
          }
          refreshAll();
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const unacknowledged = alerts.filter((a) => !a.acknowledged).length;

  const userMenu = {
    items: [
      { key: '1', label: '个人设置' },
      { key: '2', label: '切换用户' },
      { type: 'divider' as const },
      { key: '3', label: '退出登录', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === '3') message.info('已退出登录');
    },
  };

  return (
    <Layout className="app-container">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
      >
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 16 : 15,
          fontWeight: 600,
          background: 'rgba(255,255,255,0.05)',
          margin: 12,
          borderRadius: 8,
        }}>
          {collapsed ? '电网' : '⚡ 电网调度系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          background: '#001529',
          height: 56,
        }}>
          <Space size="large">
            <span style={{ color: 'white', fontSize: 18, fontWeight: 500 }}>
              大型电网调度与输电运维系统
            </span>
            <Space size="small">
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>AGC</span>
              <Switch
                size="small"
                checked={agcEnabled}
                onChange={() => { toggleAGC(); message.success(agcEnabled ? 'AGC已关闭' : 'AGC已启动'); }}
              />
            </Space>
          </Space>
          <Space size="middle">
            <Tooltip title="刷新数据">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                style={{ color: 'white' }}
                onClick={() => { refreshAll(); message.success('数据已刷新'); }}
              />
            </Tooltip>
            <Tooltip title={soundEnabled ? '关闭报警声音' : '开启报警声音'}>
              <Button
                type="text"
                icon={soundEnabled ? <SoundOutlined /> : <AudioOutlined />}
                style={{ color: 'white' }}
                onClick={toggleSound}
              />
            </Tooltip>
            <Tooltip title="报警信息">
              <Badge count={unacknowledged} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ color: unacknowledged > 0 ? '#ff4d4f' : 'white' }}
                  onClick={() => navigate('/monitor')}
                />
              </Badge>
            </Tooltip>
            <Dropdown menu={userMenu}>
              <Space style={{ cursor: 'pointer', color: 'white' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <span>调度长</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ overflow: 'auto', background: '#f0f2f5' }}>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/topology" element={<TopologyView />} />
              <Route path="/units" element={<GeneratorUnits />} />
              <Route path="/planning" element={<GenerationPlanning />} />
              <Route path="/monitor" element={<RealTimeMonitor />} />
              <Route path="/inspection" element={<LineInspection />} />
              <Route path="/substation" element={<SubstationMonitor />} />
              <Route path="/settlement" element={<Settlement />} />
              <Route path="/statistics" element={<Statistics />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
