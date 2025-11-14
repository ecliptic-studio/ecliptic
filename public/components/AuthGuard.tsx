import { AppSidebarProvider } from "@public/features/app-sidebar";
import { betterAuthClient } from "@public/lib/auth-client";
import { globalStore } from "@public/store/store.global";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useStore } from "zustand";

/**
 * AuthGuard component that protects routes requiring authentication.
 *
 * - Shows loading state while checking session
 * - Redirects to /signup if user is not authenticated
 * - Renders child routes (via Outlet) if user is authenticated
 */
export function AuthGuard() {
  const { data: session, isPending, error } = betterAuthClient.useSession();
  const { initialLoading } = useStore(globalStore);

  // All hooks at top - must call same order every render!
  useEffect(() => {
    if(session?.session) {
      initialLoading()
    }
  }, [session, initialLoading])

  // Show loading state while checking authentication
  if (isPending) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        Loading...
      </div>
    );
  }

  // If there's an error or no session, redirect to signup
  if (error || !session?.user) {
    return <Navigate to="/signup" replace />;
  }

  // User is authenticated, render the protected content
  return <AppSidebarProvider /> // this has outlet
}

export default AuthGuard;
