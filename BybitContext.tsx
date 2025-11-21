import { createContext, useContext, useState, ReactNode } from 'react';

interface BybitContextType {
  // Define your context state and functions here
  // Example:
  // someValue: string;
  // setSomeValue: (value: string) => void;
}

const BybitContext = createContext<BybitContextType | undefined>(undefined);

export const BybitProvider = ({ children }: { children: ReactNode }) => {
  // Your state and logic here
  // const [someValue, setSomeValue] = useState("default");

  const value = { /* someValue, setSomeValue */ };

  return <BybitContext.Provider value={value}>{children}</BybitContext.Provider>;
};

export const useBybit = () => {
  const context = useContext(BybitContext);
  if (context === undefined) {
    throw new Error('useBybit must be used within a BybitProvider');
  }
  return context;
};