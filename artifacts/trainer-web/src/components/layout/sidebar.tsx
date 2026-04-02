import { useLocation, Link } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Dumbbell, 
  Megaphone, 
  Flag,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Trainees", href: "/trainees", icon: Users },
  { name: "Week Planner", href: "/week-planner", icon: CalendarDays },
  { name: "Segments", href: "/segments", icon: Dumbbell },
  { name: "Announcements", href: "/announcements", icon: Megaphone },
  { name: "Events", href: "/events", icon: Flag },
];

function NavContent({ onClick }: { onClick?: () => void }) {
  const [location] = useLocation();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Dumbbell className="h-6 w-6 text-primary mr-3" />
        <span className="font-semibold text-lg tracking-tight text-sidebar-foreground">Trainer Hub</span>
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
                      "mr-3 h-5 w-5 shrink-0"
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
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden lg:hidden xl:hidden fixed top-3 left-4 z-40">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r-sidebar-border">
          <NavContent onClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-sidebar-border">
        <NavContent />
      </div>
    </>
  );
}
