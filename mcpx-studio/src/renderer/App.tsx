import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, Layout, theme } from 'antd';
import { Provider } from 'react-redux';
import { store } from './store';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Agents from './views/Agents';
import Bridges from './views/Bridges';
import Topics from './views/Topics';
import Monitoring from './views/Monitoring';
import Settings from './views/Settings';
import './App.css';

const { Content } = Layout;

const App: React.FC = () => {
  const { defaultAlgorithm, darkAlgorithm } = theme;
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <Provider store={store}>
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <Router>
          <Layout style={{ minHeight: '100vh' }}>
            <Sidebar />
            <Layout>
              <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/bridges" element={<Bridges />} />
                  <Route path="/topics" element={<Topics />} />
                  <Route path="/monitoring" element={<Monitoring />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Content>
            </Layout>
          </Layout>
        </Router>
      </ConfigProvider>
    </Provider>
  );
};

export default App;