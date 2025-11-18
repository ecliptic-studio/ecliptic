import { Button } from "@public/components/ui/button";
import { Card } from "@public/components/ui/card";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@public/components/ui/table";
import { Badge } from "@public/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@public/components/ui/dialog";
import { globalStore } from "@public/store/store.global";
import { useHeader } from "@public/contexts/HeaderContext";
import { Settings, Plus, X, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "zustand";

type EmailTag = {
  id: string;
  name: string;
  description: string;
};

type TableMapping = {
  id: string;
  datastoreId: string;
  tableName: string;
  description: string;
};

type EmailStatus = "PENDING" | "TODO" | "DONE" | "DISCARDED";

type MockEmail = {
  id: string;
  status: EmailStatus;
  tags: string[];
  title: string;
  date: string;
  from: string;
};

// Mock email data
const MOCK_EMAILS: MockEmail[] = [
  {
    id: "1",
    status: "PENDING",
    tags: ["sales", "inquiry"],
    title: "Question about pricing",
    date: "2025-01-18 10:30",
    from: "customer@example.com",
  },
  {
    id: "2",
    status: "TODO",
    tags: ["billing", "urgent"],
    title: "Invoice #12345",
    date: "2025-01-18 09:15",
    from: "support@vendor.com",
  },
  {
    id: "3",
    status: "DISCARDED",
    tags: ["spam", "marketing"],
    title: "Limited time offer!",
    date: "2025-01-17 20:00",
    from: "promo@ads.com",
  },
  {
    id: "4",
    status: "DISCARDED",
    tags: ["spam"],
    title: "You won a prize",
    date: "2025-01-17 18:30",
    from: "lottery@fake.com",
  },
  {
    id: "5",
    status: "DONE",
    tags: ["support"],
    title: "Re: Bug report #543",
    date: "2025-01-17 16:45",
    from: "dev@company.com",
  },
  {
    id: "6",
    status: "TODO",
    tags: ["sales", "partnership"],
    title: "Partnership opportunity",
    date: "2025-01-17 15:20",
    from: "lead@startup.io",
  },
  {
    id: "7",
    status: "DONE",
    tags: ["internal"],
    title: "Meeting notes",
    date: "2025-01-17 14:00",
    from: "team@example.com",
  },
  {
    id: "8",
    status: "DONE",
    tags: ["billing", "invoice"],
    title: "Payment confirmation",
    date: "2025-01-17 11:30",
    from: "accounts@vendor.com",
  },
  {
    id: "9",
    status: "DISCARDED",
    tags: ["spam", "phishing"],
    title: "Verify your account now!",
    date: "2025-01-16 22:15",
    from: "security@fake-bank.com",
  },
];

export function MailboxDetailPage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const mailboxes = useStore(globalStore, (state) => state.mailboxes);
  const datastores = useStore(globalStore, (state) => state.datastores);
  const { setHeaderContent, clearHeader } = useHeader();

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [tags, setTags] = useState<EmailTag[]>([]);
  const [tableMappings, setTableMappings] = useState<TableMapping[]>([]);

  // Form states for adding new items
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [newMappingDatastore, setNewMappingDatastore] = useState("");
  const [newMappingTable, setNewMappingTable] = useState("");
  const [newMappingDescription, setNewMappingDescription] = useState("");

  const mailbox = mailboxes.find((m) => m.email === email);

  useEffect(() => {
    if (!mailbox) {
      toast.error("Mailbox not found");
      navigate("/mailbox");
    }
  }, [mailbox, navigate]);

  // Set header content
  useEffect(() => {
    if (mailbox) {
      setHeaderContent({
        title: `INCOMING EMAILS ${email}`,
        subtitle: `${mailbox.todoCount} emails pending`,
        actions: (
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            SETTINGS
          </Button>
        ),
      });
    }

    return () => clearHeader();
  }, [email, mailbox, setHeaderContent, clearHeader]);

  // Load existing settings from API
  useEffect(() => {
    const loadSettings = async () => {
      // In production, fetch from API: /api/v1/mailbox/:email/settings
      // const { tags, tableMappings } = await api.mailbox[email].settings.get();
      // setTags(tags);
      // setTableMappings(tableMappings);
    };
    loadSettings();
  }, [email]);

  const handleAddTag = () => {
    if (!newTagName.trim() || !newTagDescription.trim()) {
      toast.error("Please fill in both tag name and description");
      return;
    }

    const newTag: EmailTag = {
      id: crypto.randomUUID(),
      name: newTagName.trim(),
      description: newTagDescription.trim(),
    };

    setTags([...tags, newTag]);
    setNewTagName("");
    setNewTagDescription("");
    toast.success(`Tag "${newTag.name}" added`);
  };

  const handleRemoveTag = (tagId: string) => {
    setTags(tags.filter((t) => t.id !== tagId));
  };

  const handleAddTableMapping = () => {
    if (!newMappingDatastore || !newMappingTable || !newMappingDescription.trim()) {
      toast.error("Please fill in all table mapping fields");
      return;
    }

    const newMapping: TableMapping = {
      id: crypto.randomUUID(),
      datastoreId: newMappingDatastore,
      tableName: newMappingTable,
      description: newMappingDescription.trim(),
    };

    setTableMappings([...tableMappings, newMapping]);
    setNewMappingDatastore("");
    setNewMappingTable("");
    setNewMappingDescription("");
    toast.success("Table mapping added");
  };

  const handleRemoveMapping = (mappingId: string) => {
    setTableMappings(tableMappings.filter((m) => m.id !== mappingId));
  };

  const handleSaveSettings = async () => {
    // In production, save to API: POST /api/v1/mailbox/:email/settings
    // const response = await api.mailbox[email].settings.post({ tags, tableMappings });

    toast.success("Settings saved!");
    setShowSettingsDialog(false);
  };

  const getStatusBadgeStyle = (status: EmailStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-orange-500 text-white";
      case "TODO":
        return "bg-yellow-400 text-black";
      case "DONE":
        return "bg-green-500 text-white";
      case "DISCARDED":
        return "bg-red-500 text-white";
    }
  };

  const getDatastoreName = (datastoreId: string) => {
    return datastores.find((ds) => ds.id === datastoreId)?.internal_name || datastoreId;
  };

  const getAvailableTables = (datastoreId: string) => {
    const datastore = datastores.find((ds) => ds.id === datastoreId);
    if (!datastore) return [];
    return Object.keys(datastore.schema_json.tables);
  };

  if (!mailbox) {
    return null; // Will redirect via useEffect
  }

  return (
    <>
      <div className="p-8">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-40">Date</TableHead>
                <TableHead className="w-48">From</TableHead>
                <TableHead className="w-32">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_EMAILS.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    <Badge
                      className={`${getStatusBadgeStyle(email.status)} rounded-sm text-sm font-semibold px-3 py-1`}
                    >
                      {email.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {email.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{email.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{email.date}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{email.from}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      OPEN <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mailbox Settings</DialogTitle>
            <DialogDescription>
              Configure tags and table mappings for {email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">

        {/* Tags Section */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Email Tags</h2>
            <p className="text-sm text-muted-foreground">
              Define tags that AI will apply to incoming emails based on their content.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                placeholder="e.g., sales, support, billing"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tag-description">AI Instructions</Label>
              <Input
                id="tag-description"
                placeholder="e.g., Apply to emails about product pricing, demos, or sales inquiries"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
              />
            </div>

            <Button onClick={handleAddTag} className="w-fit">
              <Plus className="size-4 mr-2" />
              Add Tag
            </Button>
          </div>

          {tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Configured Tags</h3>
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-start justify-between p-3 border rounded-md bg-muted/50"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{tag.name}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{tag.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTag(tag.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Table Mappings Section */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Table Mappings</h2>
            <p className="text-sm text-muted-foreground">
              Define which datastore tables should receive data extracted from emails.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mapping-datastore">Datastore</Label>
              <select
                id="mapping-datastore"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newMappingDatastore}
                onChange={(e) => {
                  setNewMappingDatastore(e.target.value);
                  setNewMappingTable(""); // Reset table selection
                }}
              >
                <option value="">Select a datastore</option>
                {datastores.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.internal_name}
                  </option>
                ))}
              </select>
            </div>

            {newMappingDatastore && (
              <div className="grid gap-2">
                <Label htmlFor="mapping-table">Table</Label>
                <select
                  id="mapping-table"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newMappingTable}
                  onChange={(e) => setNewMappingTable(e.target.value)}
                >
                  <option value="">Select a table</option>
                  {getAvailableTables(newMappingDatastore).map((tableName) => (
                    <option key={tableName} value={tableName}>
                      {tableName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="mapping-description">Mapping Instructions</Label>
              <Input
                id="mapping-description"
                placeholder="e.g., Extract customer name, email, and inquiry details from sales emails"
                value={newMappingDescription}
                onChange={(e) => setNewMappingDescription(e.target.value)}
              />
            </div>

            <Button onClick={handleAddTableMapping} className="w-fit">
              <Plus className="size-4 mr-2" />
              Add Mapping
            </Button>
          </div>

          {tableMappings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Configured Mappings</h3>
              <div className="space-y-2">
                {tableMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-start justify-between p-3 border rounded-md bg-muted/50"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {getDatastoreName(mapping.datastoreId)} / {mapping.tableName}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{mapping.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMapping(mapping.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MailboxDetailPage;
