import React, { createContext, useContext, useState } from 'react';

interface DashboardContextType {
  dashboardData: any | null;
  setDashboardData: (data: any) => void;
}

const DashboardContext = createContext<DashboardContextType>({
  dashboardData: null,
  setDashboardData: () => {},
});

export const useDashboard = () => useContext(DashboardContext);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  return (
    <DashboardContext.Provider value={{ dashboardData, setDashboardData }}>
      {children}
    </DashboardContext.Provider>
  );
};
