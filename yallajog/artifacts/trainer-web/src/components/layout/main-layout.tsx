import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { type TrainerInfo } from "@/hooks/use-auth";

interface MainLayoutProps {
  children: ReactNode;
  trainer: TrainerInfo;
  onLogout: () => void;
}

export function MainLayout({ children, trainer, onLogout }: MainLayoutProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar" || i18n.language === "he";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar trainer={trainer} onLogout={onLogout} />
      <div className={cn("flex flex-col flex-1 min-h-screen", isRtl ? "md:pr-64" : "md:pl-64")}>
        <main className="flex-1 pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
