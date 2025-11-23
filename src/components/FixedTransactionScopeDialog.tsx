import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type FixedScope = "current" | "current-and-remaining" | "all";

interface FixedTransactionScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScopeSelected: (scope: FixedScope) => void;
  mode?: "edit" | "delete";
}

export function FixedTransactionScopeDialog({
  open,
  onOpenChange,
  onScopeSelected,
  mode = "edit",
}: FixedTransactionScopeDialogProps) {
  const handleScopeSelection = (scope: FixedScope) => {
    onScopeSelected(scope);
    onOpenChange(false);
  };

  const isDelete = mode === "delete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isDelete ? "Escolher escopo da exclusão" : "Escolher escopo da edição"}
          </DialogTitle>
          <DialogDescription>
            {isDelete 
              ? "Defina se deseja excluir apenas esta ocorrência ou toda a série de transações fixas."
              : "Defina se deseja editar apenas esta ocorrência ou toda a série de transações fixas."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4 hover:bg-accent"
            onClick={() => handleScopeSelection("current")}
          >
            <div className="text-left">
              <div className="font-medium">Apenas Esta Ocorrência</div>
              <div className="text-sm text-muted-foreground">
                {isDelete 
                  ? "Deletar apenas esta transação fixa"
                  : "Editar apenas esta transação fixa"
                }
              </div>
            </div>
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4 hover:bg-accent"
            onClick={() => handleScopeSelection("current-and-remaining")}
          >
            <div className="text-left">
              <div className="font-medium">Esta e Próximas Ocorrências</div>
              <div className="text-sm text-muted-foreground">
                {isDelete 
                  ? "Deletar esta e todas as próximas transações fixas"
                  : "Editar esta e todas as próximas transações fixas"
                }
              </div>
            </div>
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4 hover:bg-accent"
            onClick={() => handleScopeSelection("all")}
          >
            <div className="text-left">
              <div className="font-medium">Todas as Ocorrências</div>
              <div className="text-sm text-muted-foreground">
                {isDelete 
                  ? "Deletar toda a série de transações fixas"
                  : "Editar toda a série de transações fixas"
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
