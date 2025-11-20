/**
 * Mailbox Email Table Component
 *
 * Displays a paginated table of emails with status, tags, and actions
 */

import { Badge } from "@public/components/ui/badge";
import { Button } from "@public/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipPositioner,
  TooltipTrigger,
} from "@public/components/ui/tooltip";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MailboxEmailTableProps } from "../types";
import { formatDateTime, formatRecipientFull, formatRecipientName, getStatusBadgeStyle } from "../utils";

export function MailboxEmailTable({
  emails,
  isLoading,
  pagination,
  currentPage,
  onPreviousPage,
  onNextPage,
}: MailboxEmailTableProps) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Table wrapper with scroll */}
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          <table className="w-full caption-bottom text-sm table-fixed">
            <thead className="[&_tr]:border-b sticky top-0 bg-background z-10">
              <tr className="border-b transition-colors">
                <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[120px]">
                  Status
                </th>
                <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[180px]">
                  Tags
                </th>
                <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[350px]">
                  Subject
                </th>
                <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[100px]">
                  Date
                </th>
                <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[200px]">
                  From
                </th>
                <th className="text-foreground h-10 px-2 text-left align-middle font-medium w-[100px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {isLoading ? (
                <tr className="hover:bg-muted/50 border-b transition-colors">
                  <td
                    colSpan={6}
                    className="p-2 align-middle text-center py-8 text-muted-foreground"
                  >
                    Loading emails...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr className="hover:bg-muted/50 border-b transition-colors">
                  <td
                    colSpan={6}
                    className="p-2 align-middle text-center py-8 text-muted-foreground"
                  >
                    No emails found
                  </td>
                </tr>
              ) : (
                emails.map((emailItem) => {
                  const { date, time } = formatDateTime(emailItem.createdDateTime);
                  return (
                    <tr
                      key={emailItem.id}
                      className="hover:bg-muted/50 border-b transition-colors h-[72px]"
                    >
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
                            <TooltipContent>{formatRecipientFull(emailItem.from)}</TooltipContent>
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
      {!isLoading && emails.length > 0 && (
        <div className="flex items-center justify-between px-8 py-4 border-t bg-background">
          <div className="text-sm text-muted-foreground">
            Showing {pagination.offset + 1} to {pagination.offset + emails.length} of{" "}
            {pagination.total} emails
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
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
              onClick={onNextPage}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
