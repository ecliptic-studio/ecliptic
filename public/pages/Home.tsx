import { Button } from "@public/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@public/components/ui/card";
import { Badge } from "@public/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { Database, Zap, Bot, Shield, ArrowRight } from "lucide-react";
import { betterAuthClient } from "@public/lib/auth-client";

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

function getAuthorizeUrl(userId: string) {
  const tenant = process.env.BUN_PUBLIC_MICROSOFT_TENANT_ID as string;
  const clientId = process.env.BUN_PUBLIC_MICROSOFT_CLIENT_ID as string;
  const redirectUri = process.env.BUN_PUBLIC_MICROSOFT_CALLBACK_URL as string;
  const responseType = "code";
  const responseMode = "query";
  const scope = ["offline_access", "user.read"];
  const state = userId;

  const authorizeUrlParams = new URLSearchParams({
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    response_mode: responseMode,
    scope: scope.join(" "),
    state: state,
    prompt: "consent",
  });

  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${authorizeUrlParams.toString()}`;
  return url;
}

function testMicrosoftAuth() {
  fetch("/auth/microsoft/test", {
    method: "GET",
    credentials: "include",
  })
    .then(response => response.json())
    .then(data => {
      console.log(data)
    })
    .catch(error => {
      console.error(error)
    })
}

export function Home() {
  const navigate = useNavigate();
  const { data } = betterAuthClient.useSession();


  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-2">
        {/* Connect Section */}
        <div className="flex justify-center mb-12 gap-4 flex-col md:flex-row">
          <Button variant="outline" className="w-1/2 bg-blue-400 text-white">
            <Link to={getAuthorizeUrl(data.user.id)} className="w-full">
            Connect with Outlook
            </Link>
          </Button>

          <Button variant="outline" className="w-1/2 bg-blue-400 text-white" onClick={testMicrosoftAuth}>
            Test Microsoft Auth
          </Button>
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

      </div>
    </div>
  );
}

export default Home;
