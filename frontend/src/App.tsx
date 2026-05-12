import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/auth/AuthProvider";
import { NotificationProvider } from "@/notifications/NotificationProvider";
import { RequireRole } from "@/auth/RequireRole";
import { Layout } from "@/components/Layout";

import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { HomeRedirect } from "@/pages/HomeRedirect";
import { NotFound } from "@/pages/NotFound";

import { UsersTable } from "@/pages/admin/UsersTable";
import { AIConfigPage } from "@/pages/superadmin/AIConfig";

import { PointsList } from "@/pages/florist/PointsList";
import { PointDetailFlorist } from "@/pages/florist/PointDetail";
import { OrdersListFlorist } from "@/pages/florist/OrdersList";
import { OrderDetailFlorist } from "@/pages/florist/OrderDetail";

import { Search } from "@/pages/consumer/Search";
import { PointDetailConsumer } from "@/pages/consumer/PointDetail";
import { Generate } from "@/pages/consumer/Generate";
import { OrderDetailConsumer } from "@/pages/consumer/OrderDetail";
import { Profile } from "@/pages/consumer/Profile";
import { OrdersHistory } from "@/pages/consumer/OrdersHistory";
import { NotificationsPage } from "@/pages/consumer/NotificationsPage";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast:
                    "!bg-card !text-foreground !border !border-border !shadow-lg !rounded-xl",
                  title: "!font-display !text-base !text-foreground",
                  description: "!text-sm !text-muted-foreground",
                },
              }}
            />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<Layout />}>
                <Route path="/" element={<HomeRedirect />} />

                {/* Superadmin */}
                <Route
                  path="/admin/users"
                  element={
                    <RequireRole roles={["superadmin"]}>
                      <UsersTable />
                    </RequireRole>
                  }
                />
                <Route
                  path="/superadmin/ai-config"
                  element={
                    <RequireRole roles={["superadmin"]}>
                      <AIConfigPage />
                    </RequireRole>
                  }
                />

                {/* Florist */}
                <Route
                  path="/florist/points"
                  element={
                    <RequireRole roles={["floristadmin"]}>
                      <PointsList />
                    </RequireRole>
                  }
                />
                <Route
                  path="/florist/points/:id"
                  element={
                    <RequireRole roles={["floristadmin"]}>
                      <PointDetailFlorist />
                    </RequireRole>
                  }
                />
                <Route
                  path="/florist/orders"
                  element={
                    <RequireRole roles={["floristadmin"]}>
                      <OrdersListFlorist />
                    </RequireRole>
                  }
                />
                <Route
                  path="/florist/orders/:id"
                  element={
                    <RequireRole roles={["floristadmin"]}>
                      <OrderDetailFlorist />
                    </RequireRole>
                  }
                />

                {/* Consumer */}
                <Route
                  path="/search"
                  element={
                    <RequireRole roles={["consumer"]}>
                      <Search />
                    </RequireRole>
                  }
                />
                <Route
                  path="/points/:id"
                  element={
                    <RequireRole roles={["consumer"]}>
                      <PointDetailConsumer />
                    </RequireRole>
                  }
                />
                <Route
                  path="/points/:id/generate"
                  element={
                    <RequireRole roles={["consumer"]}>
                      <Generate />
                    </RequireRole>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <RequireRole roles={["consumer", "floristadmin"]}>
                      <OrderDetailConsumer />
                    </RequireRole>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireRole roles={["consumer"]}>
                      <Profile />
                    </RequireRole>
                  }
                />
                <Route
                  path="/profile/orders"
                  element={
                    <RequireRole roles={["consumer"]}>
                      <OrdersHistory />
                    </RequireRole>
                  }
                />
                <Route
                  path="/profile/notifications"
                  element={
                    <RequireRole roles={["consumer"]}>
                      <NotificationsPage />
                    </RequireRole>
                  }
                />

                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
