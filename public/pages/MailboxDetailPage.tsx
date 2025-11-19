import api from "@public/api-calls";
import { Badge } from "@public/components/ui/badge";
import { Button } from "@public/components/ui/button";
import { Card } from "@public/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@public/components/ui/dialog";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipPositioner,
  TooltipTrigger,
} from "@public/components/ui/tooltip";
import { useHeader } from "@public/contexts/HeaderContext";
import { globalStore } from "@public/store/store.global";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

type TMailboxEmailRecipient = {
  name?: string;
  email: string;
};

type EmailWithMockData = {
  id: string;
  status: EmailStatus;
  tags: string[];
  subject: string;
  createdDateTime: string | null;
  from: TMailboxEmailRecipient | null;
  toRecipients: TMailboxEmailRecipient[];
  ccRecipients: TMailboxEmailRecipient[];
  bccRecipients: TMailboxEmailRecipient[];
  body: { contentType: "text" | "html"; content: string } | null;
  hasAttachments: boolean;
};

// Mock status generator - cycles through statuses for demo
const mockStatus = (index: number): EmailStatus => {
  const statuses: EmailStatus[] = ["PENDING", "TODO", "DONE", "DISCARDED"];
  return statuses[index % statuses.length]!;
};

// Mock tags generator - assigns random tags for demo
const mockTags = (index: number): string[] => {
  const allTags = [
    ["sales", "inquiry"],
    ["billing", "urgent"],
    ["spam", "marketing"],
    ["spam"],
    ["support"],
    ["sales", "partnership"],
    ["internal"],
    ["billing", "invoice"],
  ];
  return allTags[index % allTags.length] || [];
};

// Helper to format recipient display (name only, with email as fallback)
const formatRecipientName = (recipient: TMailboxEmailRecipient | null): string => {
  if (!recipient) return "-";
  return recipient.name || recipient.email;
};

// Helper to format full recipient (for tooltip)
const formatRecipientFull = (recipient: TMailboxEmailRecipient | null): string => {
  if (!recipient) return "-";
  return recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email;
};

// Helper to format date and time separately
const formatDateTime = (dateString: string | null): { date: string; time: string } => {
  if (!dateString) return { date: "-", time: "" };

  const date = new Date(dateString);
  const dateFormatted = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeFormatted = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return { date: dateFormatted, time: timeFormatted };
};

export function MailboxDetailPage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const mailboxes = useStore(globalStore, (state) => state.mailboxes);
  const datastores = useStore(globalStore, (state) => state.datastores);
  const { setHeaderContent, clearHeader } = useHeader();

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [tags, setTags] = useState<EmailTag[]>([]);
  const [tableMappings, setTableMappings] = useState<TableMapping[]>([]);
  const [emails, setEmails] = useState<EmailWithMockData[]>([]);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

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
        title: `${email}`,
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

  // Load emails when page changes
  useEffect(() => {
    const loadEmails = async () => {
      if (!email) return;

      setIsLoadingEmails(true);
      const offset = (currentPage - 1) * 50;
      const [result, error] = await api["/api/v1/mailbox/:email"].GET(
        { email },
        { limit: 50, offset }
      );

      if (error) {
        toast.error("Failed to load emails");
        setIsLoadingEmails(false);
        return;
      }

      if (result) {
        // Transform API emails to include mock status and tags
        const emailsWithMockData: EmailWithMockData[] = result.emails.map((apiEmail, index) => ({
          id: apiEmail.id,
          status: mockStatus(index),
          tags: mockTags(index),
          subject: apiEmail.subject,
          createdDateTime: apiEmail.createdDateTime,
          from: apiEmail.from,
          toRecipients: apiEmail.toRecipients,
          ccRecipients: apiEmail.ccRecipients,
          bccRecipients: apiEmail.bccRecipients,
          body: apiEmail.body,
          hasAttachments: apiEmail.hasAttachments,
        }));

        setEmails(emailsWithMockData);
        setPagination(result.pagination);
      }

      setIsLoadingEmails(false);
    };

    loadEmails();
  }, [email, currentPage]);

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Table wrapper with scroll */}
        <div className="flex-1 overflow-auto">
          <div className="w-full">
            <table className="w-full caption-bottom text-sm table-fixed">
              <thead className="[&_tr]:border-b sticky top-0 bg-background z-10">
                <tr className="border-b transition-colors">
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[120px]">Status</th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[180px]">Tags</th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[350px]">Subject</th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[100px]">Date</th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[200px]">From</th>
                  <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[100px]">Action</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {isLoadingEmails ? (
                  <tr className="hover:bg-muted/50 border-b transition-colors">
                    <td colSpan={6} className="p-2 align-middle text-center py-8 text-muted-foreground">
                      Loading emails...
                    </td>
                  </tr>
                ) : emails.length === 0 ? (
                  <tr className="hover:bg-muted/50 border-b transition-colors">
                    <td colSpan={6} className="p-2 align-middle text-center py-8 text-muted-foreground">
                      No emails found
                    </td>
                  </tr>
                ) : (
                  emails.map((emailItem) => {
                    const { date, time } = formatDateTime(emailItem.createdDateTime);
                    return (
                      <tr key={emailItem.id} className="hover:bg-muted/50 border-b transition-colors h-[72px]">
                        <td className="p-2 align-middle">
                          <Badge
                            className={`${getStatusBadgeStyle(emailItem.status)} rounded-sm text-sm font-semibold px-3 py-1`}
                          >
                            {emailItem.status}
                          </Badge>
                        </td>
                        <td className="p-2 align-middle">
                          <div className="flex gap-1 flex-wrap">
                            {emailItem.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 align-middle">
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="font-medium line-clamp-2 cursor-default break-words overflow-hidden text-left">
                                {emailItem.subject}
                              </div>
                            </TooltipTrigger>
                            <TooltipPositioner>
                              <TooltipContent className="max-w-md">
                                {emailItem.subject}
                              </TooltipContent>
                            </TooltipPositioner>
                          </Tooltip>
                        </td>
                        <td className="p-2 align-middle text-muted-foreground text-sm">
                          <div className="flex flex-col leading-tight">
                            <span className="whitespace-nowrap">{date}</span>
                            <span className="text-xs whitespace-nowrap">{time}</span>
                          </div>
                        </td>
                        <td className="p-2 align-middle text-muted-foreground text-sm">
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="truncate cursor-default overflow-hidden">
                                {formatRecipientName(emailItem.from)}
                              </div>
                            </TooltipTrigger>
                            <TooltipPositioner>
                              <TooltipContent>
                                {formatRecipientFull(emailItem.from)}
                              </TooltipContent>
                            </TooltipPositioner>
                          </Tooltip>
                        </td>
                        <td className="p-2 align-middle">
                          <Button variant="outline" size="sm">
                            OPEN <ChevronRight className="size-4 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixed Pagination */}
        {!isLoadingEmails && emails.length > 0 && (
          <div className="flex items-center justify-between px-8 py-4 border-t bg-background">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.offset + 1} to {pagination.offset + emails.length} of {pagination.total} emails
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
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
