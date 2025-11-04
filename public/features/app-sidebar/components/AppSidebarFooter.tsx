import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPositioner,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  SidebarFooter
} from "@components/ui/sidebar";
import { getLangFx } from "@public/i18n/get-lang";
import { t } from "@public/i18n/t";
import { betterAuthClient } from "@public/lib/auth-client";
import {
  ChevronDown,
  LogOut,
  Settings,
  User
} from "lucide-react";
import appSidebarTranslations from "../app-sidebar.i18n.json";


export function AppSidebarFooter() {
  const { data: session } = betterAuthClient.useSession();
  const lang = getLangFx();

  return <SidebarFooter>
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center gap-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
        <Avatar className="size-8 rounded-lg">
          {session?.user?.image && (
            <AvatarImage
              src={session.user.image}
              alt={session.user.name || t(lang, appSidebarTranslations.guest)}
            />
          )}
          <AvatarFallback>
            {session?.user?.name?.[0]?.toUpperCase() || "G"}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">
            {session?.user?.name || t(lang, appSidebarTranslations.guest)}
          </span>
          <span className="truncate text-xs">
            {session?.user?.email || ""}
          </span>
        </div>
        <ChevronDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuPositioner side="top" align="end" sideOffset={4}>
        <DropdownMenuContent
          className="w-[--base-reference-width] min-w-56 rounded-lg"
        >
          <DropdownMenuItem>
            <User className="mr-2 size-4" />
            {t(lang, appSidebarTranslations.profile)}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 size-4" />
            {t(lang, appSidebarTranslations.settings)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => betterAuthClient.signOut()}>
            <LogOut className="mr-2 size-4" />
            {t(lang, appSidebarTranslations.logOut)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPositioner>
    </DropdownMenu>
  </SidebarFooter>
}