import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dataStore } from './lib/dataStore';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import DeliveriesView from './views/DeliveriesView';
import AdvancesView from './views/AdvancesView';
import CustomersLedgerView from './views/CustomersLedgerView';
import RoutesStationsView from './views/RoutesStationsView';
import AssignmentsView from './views/AssignmentsView';
import SchemaView from './views/SchemaView';
import LoginView from './views/LoginView';
import UnauthorizedView from './views/UnauthorizedView';

function MainLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { triggerRefresh, dataVersion, isManager } = useAuth();

  const handleResetData = () => {
    if (!isManager) {
      alert('Access Denied: Only Operations Managers can reset system state.');
      return;
    }
    if (window.confirm('Reset all demo state back to default seed data?')) {
      dataStore.resetToDefaults();
      triggerRefresh();
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col w-full overflow-x-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="lg:pl-64 pl-0 flex flex-col min-h-screen w-full min-w-0 transition-all duration-200">
        <Navbar
          onResetData={handleResetData}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
        <main
          className="w-full bg-surface px-3.5 sm:px-5 lg:px-6 pt-20 sm:pt-24 pb-8 sm:pb-12 flex-1 min-w-0"
          key={`${activeTab}-${dataVersion}`}
        >
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'deliveries' && <DeliveriesView />}
          {activeTab === 'advances' && <AdvancesView />}
          {activeTab === 'ledger' && <CustomersLedgerView />}
          {activeTab === 'routes' && <RoutesStationsView />}
          {activeTab === 'assignments' && (
            isManager ? <AssignmentsView /> : <UnauthorizedView onNavigate={setActiveTab} />
          )}
          {activeTab === 'schema' && <SchemaView />}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-surface text-on-surface">
        <div className="w-11 h-11 rounded-lg bg-primary text-amber-400 flex items-center justify-center shadow-sm mb-3">
          <span className="material-symbols-outlined text-[24px]">local_gas_station</span>
        </div>
        <div className="flex items-center gap-2 font-label-code text-[12px] text-secondary">
          <span className="material-symbols-outlined text-[16px] animate-spin text-primary">sync</span>
          <span>Initializing PetroFlow Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
