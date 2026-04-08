import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Pets from "@/pages/Pets";
import Health from "@/pages/Health";
import Symptoms from "@/pages/Symptoms";
import Nutrition from "@/pages/Nutrition";
import Wellness from "@/pages/Wellness";
import Status from "@/pages/Status";
import Agenda from "@/pages/Agenda";
import Planner from "@/pages/Planner";
import Training from "@/pages/Training";
import Bookings from "@/pages/Bookings";
import ProviderConsole from "@/pages/ProviderConsole";
import SharedRecords from "@/pages/SharedRecords";
import Moderation from "@/pages/Moderation";
import Records from "@/pages/Records";
import Documents from "@/pages/Documents";
import Medications from "@/pages/Medications";
import Vaccines from "@/pages/Vaccines";
import Vision from "@/pages/Vision";
import Video from "@/pages/Video";
import Gps from "@/pages/Gps";
import Expenses from "@/pages/Expenses";
import Community from "@/pages/Community";
import Marketplace from "@/pages/Marketplace";
import Insights from "@/pages/Insights";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShellLayout } from "@/components/AppShellLayout";
import { useAuthStore } from "@/stores/authStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToastStore } from "@/stores/toastStore";

export default function App() {
  const start = useAuthStore((s) => s.start);
  const pushToast = useToastStore((s) => s.push);
  useEffect(() => {
    const unsub = start();
    return () => unsub();
  }, [start]);

  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : "Errore imprevisto";
      pushToast({ type: "error", title: "Errore", message: msg });
    };
    const onError = (e: ErrorEvent) => {
      const msg = e.error instanceof Error ? e.error.message : (e.message || "Errore imprevisto");
      pushToast({ type: "error", title: "Errore", message: msg });
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [pushToast]);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/share/:token" element={<SharedRecords />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShellLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pets" element={<Pets />} />
          <Route path="health" element={<Health />} />
          <Route path="symptoms" element={<Symptoms />} />
          <Route path="nutrition" element={<Nutrition />} />
          <Route path="wellness" element={<Wellness />} />
          <Route path="status" element={<Status />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="planner" element={<Planner />} />
          <Route path="training" element={<Training />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="provider" element={<ProviderConsole />} />
          <Route path="records" element={<Records />} />
          <Route path="documents" element={<Documents />} />
          <Route path="medications" element={<Medications />} />
          <Route path="vaccines" element={<Vaccines />} />
          <Route path="vision" element={<Vision />} />
          <Route path="video" element={<Video />} />
          <Route path="gps" element={<Gps />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="community" element={<Community />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="insights" element={<Insights />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
