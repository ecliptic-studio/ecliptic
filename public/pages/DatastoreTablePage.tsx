import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@public/components/ui/button";
import { useHeader } from "@public/contexts/HeaderContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPositioner,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@public/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { useDatastoreDialogs } from "@public/features/datastore/hooks/useDatastoreDialogs";
import { useStore } from "zustand";
import { globalStore } from "@public/store/store.global";
import { DatastoreTable } from "@public/features/datastore/DatastoreTable";

export function DatastoreTablePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setHeaderContent, clearHeader } = useHeader();
  const { openDialog } = useDatastoreDialogs();

  const datastore = useStore(globalStore, s => s.datastores.find(d => d.id === id))
  const tableName = useParams<{ tableName: string }>().tableName

  // Set header content when datastore loads
  useEffect(() => {
    if (datastore && tableName && id) {
      setHeaderContent({
        title: tableName,
        subtitle: `Datastore: ${datastore.internal_name}`,
        actions: (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuPositioner>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Datastore Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog("addTable", {
                        datastoreId: id,
                        tableName,
                      })
                    }
                  >
                    Add Table
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog("renameTable", {
                        datastoreId: id,
                        tableName,
                      })
                    }
                  >
                    Rename Table
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog("deleteTable", {
                        datastoreId: id,
                        tableName,
                      })
                    }
                  >
                    Delete Table
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog("deleteDatastore", {
                        datastoreId: id,
                        datastoreName: datastore.internal_name,
                      })
                    }
                    className="text-red-600 dark:text-red-400"
                  >
                    Delete Datastore
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenuPositioner>
          </DropdownMenu>
        ),
      });
    }

    // Clear header on unmount
    return () => clearHeader();
  }, [datastore, setHeaderContent, clearHeader, tableName, id, openDialog]);

  // NOTE: flickers on load until datastore is loaded
  if (!datastore) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-4">
          <p className="text-lg">Datastore not found</p>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  if (!tableName) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-lg">No table selected</p>
      </div>
    );
  }

  return <DatastoreTable datastoreId={id!} tableName={tableName} />;
}

export default DatastoreTablePage;
