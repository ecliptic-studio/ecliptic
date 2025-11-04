import {
  SidebarInset,
  SidebarTrigger
} from "@components/ui/sidebar";
import { useHeader } from "@public/contexts/HeaderContext";
import { Outlet } from "react-router-dom";


export function AppSidebarInset() {
  const { headerContent } = useHeader();


  return <SidebarInset className="flex flex-col h-screen overflow-hidden">
    <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4 bg-white dark:bg-gray-800">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1 flex items-center justify-between gap-4">
        {headerContent.title && (
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{headerContent.title}</h1>
            {headerContent.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{headerContent.subtitle}</p>
            )}
          </div>
        )}
        {headerContent.actions && (
          <div className="flex items-center gap-2 shrink-0">
            {headerContent.actions}
          </div>
        )}
      </div>
    </header>
    <div className="flex-1 overflow-auto">
      <Outlet />
    </div>
  </SidebarInset>
}