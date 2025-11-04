import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@components/ui/sidebar";
import { EclipticLogo } from "@public/components/EclipticLogo";
import { getLangFx } from "@public/i18n/get-lang";
import { t } from "@public/i18n/t";
import { useNavigate } from "react-router-dom";
import appSidebarTranslations from "../app-sidebar.i18n.json";


export function AppSidebarHeader() {
  const lang = getLangFx();
  const navigate = useNavigate();

  return <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          onClick={() => navigate("/")}>
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white text-primary-foreground">
            <EclipticLogo className="size-6 text-primary" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {t(lang, appSidebarTranslations.appName)}
            </span>
            <span className="truncate text-xs">
              {t(lang, appSidebarTranslations.appSubtitle)}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>
}