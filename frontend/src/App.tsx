import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import { buildTheme } from "./theme";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Landing } from "./pages/Landing";
import { Mushaf } from "./pages/Mushaf";
import { Settings } from "./pages/Settings";

export default function App() {
  const { user } = useAuth();
  const theme = useMemo(
    () => buildTheme(user?.preferences?.theme === "dark" ? "dark" : "light"),
    [user?.preferences?.theme],
  );

  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Landing />} />
        <Route
          path="/mushaf"
          element={
            <ProtectedRoute>
              <Mushaf />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
