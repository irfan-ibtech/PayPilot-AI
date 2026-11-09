import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import OrderAssistant from './pages/OrderAssistant';
import Copilot from './pages/Copilot';
import RevenueRecovery from './pages/RevenueRecovery';
import Login from './pages/Login';
import Register from './pages/Register';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing PayPilot AI...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <Login onNavigateRegister={() => setAuthView('register')} />
    ) : (
      <Register onNavigateLogin={() => setAuthView('login')} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl">
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigateCopilot={() => setCurrentTab('copilot')}
              onNavigateRecovery={() => setCurrentTab('recovery')}
            />
          )}
          {currentTab === 'recovery' && (
            <RevenueRecovery />
          )}
          {currentTab === 'assistant' && (
            <OrderAssistant onNavigateDashboard={() => setCurrentTab('dashboard')} />
          )}
          {currentTab === 'copilot' && <Copilot />}
          {currentTab === 'products' && (
            <Dashboard onNavigateCopilot={() => setCurrentTab('copilot')} />
          )}
          {currentTab === 'payments' && (
            <Dashboard onNavigateCopilot={() => setCurrentTab('copilot')} />
          )}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

export default App;
