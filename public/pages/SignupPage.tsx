import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { betterAuthClient } from "@public/lib/auth-client";
import { Button } from "@public/components/ui/button";
import { Input } from "@public/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@public/components/ui/card";
import { Alert, AlertDescription } from "@public/components/ui/alert";

export function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
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
      const { data, error } = await betterAuthClient.signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        callbackURL: '/'
      });

      if (error) {
        setError(error.message || "Failed to sign up. Please try again.");
        setLoading(false);
        return;
      }

      // If signup is successful, redirect to home or dashboard
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
          <CardTitle className="text-2xl text-center">Create an account</CardTitle>
          <CardDescription className="text-center">
            Enter your details below to create your account
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
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={loading}
                aria-invalid={!!error}
              />
            </div>

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
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/signin")}
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SignupPage;
