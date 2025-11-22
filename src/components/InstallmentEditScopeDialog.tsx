import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type EditScope = "current" | "current-and-remaining" | "all";

interface InstallmentEditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScopeSelected: (scope: EditScope) => void;
  currentInstallment: number;
  totalInstallments: number;
  mode?: "edit" | "delete";
}

export function InstallmentEditScopeDialog({
  open,
  onOpenChange,
  onScopeSelected,
  currentInstallment,
  totalInstallments,
  mode = "edit"
}: InstallmentEditScopeDialogProps) {
  const handleScopeSelection = (scope: EditScope) => {
    onScopeSelected(scope);
    onOpenChange(false);
  };

  const isDelete = mode === "delete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isDelete ? "Deletar Parcelas" : "Editar Parcelas"}
          </DialogTitle>
          <DialogDescription>
            {isDelete 
              ? `Escolha quais parcelas deseja deletar (parcela ${currentInstallment} de ${totalInstallments})`
              : `Escolha quais parcelas deseja editar (parcela ${currentInstallment} de ${totalInstallments})`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4"
            onClick={() => handleScopeSelection("current")}
          >
            <div className="text-left">
              <div className="font-medium">Apenas Esta Parcela</div>
              <div className="text-sm text-muted-foreground">
                {isDelete 
                  ? `Deletar apenas a parcela ${currentInstallment} de ${totalInstallments}`
                  : `Editar apenas a parcela ${currentInstallment} de ${totalInstallments}`
                }
              </div>
            </div>
          </Button>

          {currentInstallment < totalInstallments && (
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4"
              onClick={() => handleScopeSelection("current-and-remaining")}
            >
              <div className="text-left">
                <div className="font-medium">Esta e Próximas Parcelas</div>
                <div className="text-sm text-muted-foreground">
                  {isDelete 
                    ? `Deletar da parcela ${currentInstallment} até a ${totalInstallments}`
                    : `Editar da parcela ${currentInstallment} até a ${totalInstallments}`
                  }
                </div>
              </div>
            </Button>
          )}

          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4"
            onClick={() => handleScopeSelection("all")}
          >
            <div className="text-left">
              <div className="font-medium">Todas as Parcelas</div>
              <div className="text-sm text-muted-foreground">
                {isDelete 
                  ? `Deletar todas as ${totalInstallments} parcelas`
                  : `Editar todas as ${totalInstallments} parcelas`
                }
              </div>
            </div>
          </Button>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
