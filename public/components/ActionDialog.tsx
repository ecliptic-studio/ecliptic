import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@public/components/ui/dialog";
import { Button } from "@public/components/ui/button";

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  confirmVariant?: "default" | "destructive";
}

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmDisabled = false,
  confirmVariant = "default",
}: ActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
