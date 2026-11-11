import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import OrderAssistant from './pages/OrderAssistant';
import Copilot from './pages/Copilot';
import RevenueRecovery from './pages/RevenueRecovery';
import ProductCatalog from './pages/ProductCatalog';
import TransactionLedger from './pages/TransactionLedger';
import Login from './pages/Login';
import Register from './pages/Register';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab && ['dashboard', 'recovery', 'assistant', 'copilot', 'products', 'payments'].includes(tab)) {
        return tab;
      }
    }
    return 'dashboard';
  });
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [assistantInitialPrompt, setAssistantInitialPrompt] = useState<string | undefined>(undefined);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

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

  const handleNavigateAssistantWithPrompt = (prompt?: string) => {
    if (prompt) {
      setAssistantInitialPrompt(prompt);
    }
    handleSelectTab('assistant');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar currentTab={currentTab} onSelectTab={handleSelectTab} />
      <div className="flex-1 flex">
        <Sidebar currentTab={currentTab} onSelectTab={handleSelectTab} />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl">
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigateCopilot={() => handleSelectTab('copilot')}
              onNavigateRecovery={() => handleSelectTab('recovery')}
            />
          )}
          {currentTab === 'recovery' && (
            <RevenueRecovery />
          )}
          {currentTab === 'assistant' && (
            <OrderAssistant
              onNavigateDashboard={() => handleSelectTab('dashboard')}
              initialPrompt={assistantInitialPrompt}
            />
          )}
          {currentTab === 'copilot' && (
            <Copilot
              onNavigateRecovery={() => handleSelectTab('recovery')}
              onNavigateAssistant={() => handleSelectTab('assistant')}
            />
          )}
          {currentTab === 'products' && (
            <ProductCatalog
              onNavigateAssistant={handleNavigateAssistantWithPrompt}
            />
          )}
          {currentTab === 'payments' && (
            <TransactionLedger />
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