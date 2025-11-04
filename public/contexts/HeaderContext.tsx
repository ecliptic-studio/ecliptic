import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface HeaderContent {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

interface HeaderContextType {
  headerContent: HeaderContent;
  setHeaderContent: (content: HeaderContent) => void;
  clearHeader: () => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContentState] = useState<HeaderContent>({});

  const setHeaderContent = useCallback((content: HeaderContent) => {
    setHeaderContentState(content);
  }, []);

  const clearHeader = useCallback(() => {
    setHeaderContentState({});
  }, []);

  return (
    <HeaderContext.Provider value={{ headerContent, setHeaderContent, clearHeader }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
