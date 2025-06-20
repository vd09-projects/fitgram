import React, { createContext, useContext, useState, ReactNode } from 'react';

type AppControlContextType = {
  forceReload: () => void;
  appInstanceKey: number;
  appStatus: string;
  setAppStatus: (status: string) => void;
};

const AppControlContext = createContext<AppControlContextType | undefined>(undefined);

export const useAppControl = (): AppControlContextType => {
  const context = useContext(AppControlContext);
  if (!context) throw new Error('useAppControl must be used within AppControlProvider');
  return context;
};

export const AppControlProvider = ({ children }: { children: ReactNode }) => {
  const [appInstanceKey, setAppInstanceKey] = useState(0);
  const [appStatus, setAppStatus] = useState('running');

  const forceReload = () => {
    setAppInstanceKey(prev => prev + 1); // triggers remount
  };

  return (
    <AppControlContext.Provider
      value={{ forceReload, appInstanceKey, appStatus, setAppStatus }}
    >
      {children}
    </AppControlContext.Provider>
  );
};