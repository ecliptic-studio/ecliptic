import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { betterAuthClient } from "@public/lib/auth-client";
import { Button } from "@public/components/ui/button";
import { Input } from "@public/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@public/components/ui/card";
import { Alert, AlertDescription } from "@public/components/ui/alert";

export function SigninPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await betterAuthClient.signIn.email({
        email: formData.email,
        password: formData.password,
        callbackURL: "/",
      });

      if (error) {
        setError(error.message || "Failed to sign in. Please try again.");
        setLoading(false);
        return;
      }

      // If signin is successful, redirect to home or dashboard
      navigate("/");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img
              src="/favicon.ico"
              alt="Ecliptic Logo"
              className="h-12 w-12"
            />
          </div>
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                aria-invalid={!!error}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                aria-invalid={!!error}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign up
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SigninPage;
