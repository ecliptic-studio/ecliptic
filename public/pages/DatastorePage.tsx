import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import rpcClient from "@public/rpc-client";
import { Button } from "@public/components/ui/button";
import { Input } from "@public/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@public/components/ui/card";
import { globalStore, type TGlobalStore } from "@public/store/store.global";
import { produce } from "immer";

export function DatastorePage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    internalName: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await rpcClient.api.v1.datastore.post({
        internalName: formData.internalName,
        provider: "sqlite", // Hardcoded as per requirements
      });

      if (response.error) {
        toast.error("Failed to create datastore", {
          description: response.error.value.message,
        });
        setLoading(false);
        return;
      }

      globalStore.setState(produce((state:TGlobalStore) => {
        state.datastores.push(response.data);
      }))

      toast.success("Datastore created successfully!", {
        description: `Datastore "${formData.internalName}" is ready to use.`,
      });
      setFormData({ internalName: "" }); // Reset form
      setLoading(false);
    } catch (err) {
      toast.error("An unexpected error occurred", {
        description: "Please try again.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create New Datastore</CardTitle>
          <CardDescription className="text-center">
            Create a new SQLite datastore to manage your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="internalName" className="text-sm font-medium">
                Datastore Name
              </label>
              <Input
                id="internalName"
                name="internalName"
                type="text"
                placeholder="my-database"
                value={formData.internalName}
                onChange={handleChange}
                required
                disabled={loading}
                minLength={1}
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground">
                Enter a unique name for your datastore (1-255 characters)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Input
                value="SQLite"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Currently only SQLite datastores are supported
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating datastore..." : "Create Datastore"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-primary underline-offset-4 hover:underline"
            >
              Back to Home
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DatastorePage;
