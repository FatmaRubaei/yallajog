import { useLocation, Link } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Dumbbell, 
  Megaphone, 
  Flag,
  Menu,
  Globe,
  Sun,
  Moon,
  Check,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import { type TrainerInfo } from "@/hooks/use-auth";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "عربي" },
  { code: "he", label: "עברית" },
];

interface NavContentProps {
  onClick?: () => void;
  trainer: TrainerInfo;
  onLogout: () => void;
}

function NavContent({ onClick, trainer, onLogout }: NavContentProps) {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar" || i18n.language === "he";
  const { theme, toggleTheme } = useTheme();

  const navigation = [
    { name: t("nav.dashboard"), href: "/", icon: LayoutDashboard },
    { name: t("nav.trainees"), href: "/trainees", icon: Users },
    { name: t("nav.weekPlanner"), href: "/week-planner", icon: CalendarDays },
    { name: t("nav.segments"), href: "/segments", icon: Dumbbell },
    { name: t("nav.announcements"), href: "/announcements", icon: Megaphone },
    { name: t("nav.events"), href: "/events", icon: Flag },
    { name: "Control Panel", href: "/control-panel", icon: Settings },
  ];

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Dumbbell className="h-6 w-6 text-primary me-3" />
        <span className="font-semibold text-lg tracking-tight text-sidebar-foreground">{t("nav.appName")}</span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className="block" onClick={onClick}>
                <div
                  className={cn(
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground",
                      "me-3 h-5 w-5 shrink-0"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {trainer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{trainer.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{trainer.email}</p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {theme === "dark"
            ? <Sun className="h-5 w-5 me-3 shrink-0" />
            : <Moon className="h-5 w-5 me-3 shrink-0" />}
          {theme === "dark" ? t("common.lightMode") : t("common.darkMode")}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
              <Globe className="h-5 w-5 me-3 shrink-0" />
              {currentLang.label}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={isRtl ? "end" : "start"} className="w-40">
            {LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className="flex items-center justify-between cursor-pointer"
              >
                {lang.label}
                {i18n.language === lang.code && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onLogout}
          className="flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 me-3 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

interface SidebarProps {
  trainer: TrainerInfo;
  onLogout: () => void;
}

export function Sidebar({ trainer, onLogout }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar" || i18n.language === "he";

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("md:hidden lg:hidden xl:hidden fixed top-3 z-40", isRtl ? "right-4" : "left-4")}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">{i18n.t("common.openSidebar")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side={isRtl ? "right" : "left"} className="p-0 w-64 bg-sidebar border-sidebar-border">
          <NavContent onClick={() => setOpen(false)} trainer={trainer} onLogout={onLogout} />
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-sidebar-border",
          isRtl ? "md:right-0 border-l" : "md:left-0 border-r"
        )}
      >
        <NavContent trainer={trainer} onLogout={onLogout} />
      </div>
    </>
  );
}
