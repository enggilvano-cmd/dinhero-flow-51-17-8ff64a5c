import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export type EditScope = "current" | "current-and-remaining" | "all";

interface InstallmentEditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScopeSelected: (scope: EditScope) => void;
  currentInstallment: number;
  totalInstallments: number;
}

export function InstallmentEditScopeDialog({
  open,
  onOpenChange,
  onScopeSelected,
  currentInstallment,
  totalInstallments
}: InstallmentEditScopeDialogProps) {
  const { t } = useTranslation();
  
  const handleScopeSelection = (scope: EditScope) => {
    onScopeSelected(scope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("modals.installmentScope.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.installmentScope.subtitle", { 
              current: currentInstallment, 
              total: totalInstallments 
            })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4"
            onClick={() => handleScopeSelection("current")}
          >
            <div className="text-left">
              <div className="font-medium">{t("modals.installmentScope.options.current.label")}</div>
              <div className="text-sm text-muted-foreground">
                {t("modals.installmentScope.options.current.description", { 
                  current: currentInstallment, 
                  total: totalInstallments 
                })}
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
                <div className="font-medium">{t("modals.installmentScope.options.remaining.label")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("modals.installmentScope.options.remaining.description", { 
                    current: currentInstallment, 
                    total: totalInstallments 
                  })}
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
              <div className="font-medium">{t("modals.installmentScope.options.all.label")}</div>
              <div className="text-sm text-muted-foreground">
                {t("modals.installmentScope.options.all.description", { 
                  total: totalInstallments 
                })}
              </div>
            </div>
          </Button>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}