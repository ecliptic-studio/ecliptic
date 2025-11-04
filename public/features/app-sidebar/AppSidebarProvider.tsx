import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPositioner,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator
} from "@components/ui/sidebar";
import { useDatastoreDialogs } from "@public/features/datastore/hooks/useDatastoreDialogs";
import { getLangFx } from "@public/i18n/get-lang";
import { t } from "@public/i18n/t";
import { globalStore } from "@public/store/store.global";
import {
  ChevronDown,
  ChevronRight,
  CombineIcon,
  Database,
  MoreVertical,
  Plus,
  Table
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import appSidebarTranslations from "./app-sidebar.i18n.json";
import { AppSidebarFooter } from "./components/AppSidebarFooter";
import { AppSidebarHeader } from "./components/AppSidebarHeader";
import { AppSidebarInset } from "./components/AppSidebarInset";

export function AppSidebarProvider() {
  const lang = getLangFx();
  const navigate = useNavigate();
  const location = useLocation();
  const datastores = useStore(globalStore, (state) => state.datastores);
  const { openDialog } = useDatastoreDialogs();
  const [openDatastores, setOpenDatastores] = useState<Record<string, boolean>>({});

  // Parse current route to extract datastore ID and table name
  const routeMatch = location.pathname.match(/^\/datastore\/([^\/]+)\/table\/([^\/]+)$/);
  const currentDatastoreId = routeMatch?.[1];
  const currentTableName = routeMatch?.[2];

  // Auto-expand datastore that contains the current table
  useEffect(() => {
    if (currentDatastoreId) {
      setOpenDatastores(prev => ({ ...prev, [currentDatastoreId]: true }));
    }
  }, [currentDatastoreId]);

  return (
    <SidebarProvider>
      <Sidebar>
        {/* Header */}
        <AppSidebarHeader />

        {/* Content */}
        <SidebarContent>
          {/* Datastores Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <div className="flex items-center">
                {t(lang, appSidebarTranslations.dataStores)}
              </div>
              <button
                onClick={() => navigate("/datastore")}
                className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent"
              >
                <Plus className="size-4" />
              </button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {datastores.map((datastore) => {
                  const isOpen = openDatastores[datastore.id || ''] || false;
                  const tables = Object.keys(datastore.schema_json?.tables || {});

                  return (
                    <SidebarMenuItem key={datastore.id}>
                      <Collapsible
                        open={isOpen}
                        onOpenChange={(open) =>
                          setOpenDatastores(prev => ({ ...prev, [datastore.id || '']: open }))
                        }
                      >
                        <div className="flex items-center w-full group">
                          <CollapsibleTrigger className="flex-1 w-full flex pl-2">
                            <Database className="mr-2 size-4" />
                            <span className="flex-1 text-left">{datastore.internal_name}</span>
                            {tables.length > 0 && (
                              isOpen ? (
                                <ChevronDown className="size-4 ml-auto" />
                              ) : (
                                <ChevronRight className="size-4 ml-auto" />
                              )
                            )}
                          </CollapsibleTrigger>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-1 hover:bg-sidebar-accent rounded">
                                <MoreVertical className="size-4" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuPositioner>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() => openDialog("addTable", {
                                    datastoreId: datastore.id || '',
                                  })}
                                >
                                  {t(lang, appSidebarTranslations.addTable)}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDialog("renameDatastore", {
                                    datastoreId: datastore.id || '',
                                    datastoreName: datastore.internal_name,
                                  })}
                                >
                                  {t(lang, appSidebarTranslations.renameDatastore)}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDialog("deleteDatastore", {
                                    datastoreId: datastore.id || '',
                                    datastoreName: datastore.internal_name,
                                  })}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  {t(lang, appSidebarTranslations.deleteDatastore)}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenuPositioner>
                          </DropdownMenu>
                        </div>
                        {tables.length > 0 && (
                          <CollapsibleContent>
                            <SidebarMenu className="ml-2 mt-1">
                              {tables.map((tableName) => {
                                const isActive = currentDatastoreId === datastore.id && currentTableName === tableName;
                                return (
                                  <SidebarMenuItem key={tableName}>
                                    <div className="flex items-center w-full group">
                                      <SidebarMenuButton
                                        onClick={() => navigate(`/datastore/${datastore.id}/table/${tableName}`)}
                                        className="flex-1"
                                        isActive={isActive}
                                      >
                                        <Table className="mr-2 size-4" />
                                        <span>{tableName}</span>
                                      </SidebarMenuButton>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity" render={
                                          <button className="p-1 hover:bg-sidebar-accent rounded">
                                            <MoreVertical className="size-4" />
                                          </button>
                                        } />
                                        <DropdownMenuPositioner>
                                          <DropdownMenuContent>
                                            <DropdownMenuItem
                                              onClick={() => openDialog("renameTable", {
                                                datastoreId: datastore.id || '',
                                                tableName,
                                              })}
                                            >
                                              {t(lang, appSidebarTranslations.renameTable)}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => openDialog("deleteTable", {
                                                datastoreId: datastore.id || '',
                                                tableName,
                                              })}
                                              className="text-red-600 dark:text-red-400"
                                            >
                                              {t(lang, appSidebarTranslations.deleteTable)}
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenuPositioner>
                                      </DropdownMenu>
                                    </div>
                                  </SidebarMenuItem>
                                );
                              })}
                            </SidebarMenu>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* THIS FIXES scroll bar */}
          <SidebarSeparator style={{width: '90%'}} />
          <SidebarMenu>
            <SidebarMenuItem key="mcp">
              <SidebarMenuButton className="pl-4" render={<a href='/mcp-settings' />}>
                <CombineIcon />
                <span>MCP</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <AppSidebarFooter />

        <SidebarRail />
      </Sidebar>

      {/* Main content area */}
      <AppSidebarInset />
    </SidebarProvider>
  );
}
