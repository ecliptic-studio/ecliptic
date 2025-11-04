import { Navigate, Outlet } from "react-router-dom";
import { betterAuthClient } from "@public/lib/auth-client";
import { AppSidebarProvider } from "@public/features/app-sidebar";

/**
 * AuthGuard component that protects routes requiring authentication.
 *
 * - Shows loading state while checking session
 * - Redirects to /signup if user is not authenticated
 * - Renders child routes (via Outlet) if user is authenticated
 */
export function AuthGuard() {
  const { data: session, isPending, error } = betterAuthClient.useSession();

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
