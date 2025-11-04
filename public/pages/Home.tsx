import { Button } from "@public/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@public/components/ui/card";
import { Badge } from "@public/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Database, Zap, Bot, Shield, ArrowRight } from "lucide-react";

export function Home() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Database,
      title: "Datastore",
      description: "Custom tables with full CRUD operations, foreign keys, and schema evolution",
      action: "Get Started",
      path: "/datastore",
    },
    {
      icon: Shield,
      title: "Authentication",
      description: "Secure user accounts with better-auth (email/password, OAuth coming soon)",
      status: "Active",
    },
    {
      icon: Bot,
      title: "MCP Server",
      description: "Expose fine-grained access to your tables and columns for AI agents to interact",
      status: "Active",
    },
    {
      icon: Zap,
      title: "AI-Native Design",
      description: "Delegate work to AI agents through natural language, not complex workflows",
      status: "Core",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="outline">
            Early Alpha
          </Badge>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Ecliptic
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            AI-Native Enterprise Resource Planning
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Built from the ground up for AI collaboration through the Model Context Protocol.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Icon className="size-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                    {feature.status && (
                      <Badge variant="secondary" className="text-xs">
                        {feature.status}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-2">{feature.description}</CardDescription>
                </CardHeader>
                {feature.action && feature.path && (
                  <CardContent>
                    <Button
                      onClick={() => navigate(feature.path)}
                      className="w-full"
                      variant="outline"
                    >
                      {feature.action}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Coming Soon Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-dashed">
          <CardHeader>
            <CardTitle>Coming Soon: Enterprise Modules</CardTitle>
            <CardDescription>Modular extensions designed to grow with your business</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["CRM", "HCM/HRIS", "SCM", "Accounting", "Marketing", "Manufacturing", "ECM", "Objectstore"].map((module) => (
                <Badge key={module} variant="outline" className="justify-center py-2">
                  {module}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with Bun, powered by AI, designed for the future of work.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
