import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { MainLayout } from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import TraineeList from "@/pages/trainees";
import TraineeProfile from "@/pages/trainee-profile";
import { WeekPlannerList, TraineeWeekPlanner } from "@/pages/week-planner";
import SegmentLibrary from "@/pages/segments";
import AnnouncementList from "@/pages/announcements";
import EventList from "@/pages/events";

const queryClient = new QueryClient();

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/trainees" component={TraineeList} />
        <Route path="/trainees/:id" component={TraineeProfile} />
        <Route path="/week-planner" component={WeekPlannerList} />
        <Route path="/week-planner/:traineeId" component={TraineeWeekPlanner} />
        <Route path="/segments" component={SegmentLibrary} />
        <Route path="/announcements" component={AnnouncementList} />
        <Route path="/events" component={EventList} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
