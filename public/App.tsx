import { AuthGuard } from "@public/components/AuthGuard";
import { Toaster } from "@public/components/ui/sonner";
import { HeaderProvider } from "@public/contexts/HeaderContext";
import { DatastoreDialogsProvider } from "@public/features/datastore/DatastoreDialogsProvider";
import { McpDialogsProvider } from "@public/features/mcp/provider/provider.mcp-dialog";
import DatastorePage from "@public/pages/DatastorePage";
import DatastoreTablePage from "@public/pages/DatastoreTablePage";
import Home from "@public/pages/Home";
import McpApiKeyEditorPage from "@public/pages/McpApiKeyEditorPage";
import McpSettingsPage from "@public/pages/McpSettingsPage";
import SigninPage from "@public/pages/SigninPage";
import SignupPage from "@public/pages/SignupPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const queryClient = new QueryClient();

export function App() {
  return (
    <BrowserRouter>
      <HeaderProvider>
        <QueryClientProvider client={queryClient}>
          <DatastoreDialogsProvider>
            <McpDialogsProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/signin" element={<SigninPage />} />

                {/* Protected routes - require authentication */}
                <Route element={<AuthGuard />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/datastore" element={<DatastorePage />} />
                  <Route path="/datastore/:id/table/:tableName" element={<DatastoreTablePage />} />
                  <Route path="/mcp-settings" element={<McpSettingsPage />} />
                  <Route path="/mcp-settings/new-api" element={<McpApiKeyEditorPage />} />
                  <Route path="/mcp-settings/edit/:keyId" element={<McpApiKeyEditorPage />} />
                  {/* Add more protected routes here */}
                  {/* <Route path="/settings" element={<SettingsPage />} /> */}
                  {/* <Route path="/profile" element={<ProfilePage />} /> */}
                </Route>

                {/* 404 */}
                <Route path="*" element={<div>404</div>} />
              </Routes>
              <Toaster />
            </McpDialogsProvider>
          </DatastoreDialogsProvider>
        </QueryClientProvider>
      </HeaderProvider>
    </BrowserRouter>
  );
}

export default App;
