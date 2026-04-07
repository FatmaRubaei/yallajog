import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import NotFound from "@/pages/not-found";
import { MainLayout } from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import TraineeList from "@/pages/trainees";
import TraineeProfile from "@/pages/trainee-profile";
import { WeekPlannerList, TraineeWeekPlanner } from "@/pages/week-planner";
import SegmentLibrary from "@/pages/segments";
import AnnouncementList from "@/pages/announcements";
import EventList from "@/pages/events";
import ControlPanel from "@/pages/control-panel";
import AuthPage from "@/pages/auth";
import { authMe, authLogout, type TrainerInfo } from "@/hooks/use-auth";

const queryClient = new QueryClient();

function RTLHandler() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const isRtl = i18n.language === "ar" || i18n.language === "he";
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
    localStorage.setItem("lang", i18n.language);
  }, [i18n.language]);
  return null;
}

interface RouterProps {
  trainer: TrainerInfo;
  onLogout: () => void;
}

function Router({ trainer, onLogout }: RouterProps) {
  return (
    <MainLayout trainer={trainer} onLogout={onLogout}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/trainees" component={TraineeList} />
        <Route path="/trainees/:id" component={TraineeProfile} />
        <Route path="/week-planner" component={WeekPlannerList} />
        <Route path="/week-planner/:traineeId" component={TraineeWeekPlanner} />
        <Route path="/segments" component={SegmentLibrary} />
        <Route path="/announcements" component={AnnouncementList} />
        <Route path="/events" component={EventList} />
        <Route path="/control-panel">
          {() => <ControlPanel trainer={trainer} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  const [trainer, setTrainer] = useState<TrainerInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    authMe().then((t) => {
      setTrainer(t);
      setAuthLoading(false);
    });
  }, []);

  const handleAuth = useCallback((t: TrainerInfo) => {
    setTrainer(t);
    queryClient.clear();
  }, []);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setTrainer(null);
    queryClient.clear();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trainer) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RTLHandler />
          <AuthPage onAuth={handleAuth} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RTLHandler />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router trainer={trainer} onLogout={handleLogout} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
