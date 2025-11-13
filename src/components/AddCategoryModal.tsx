import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Category, PREDEFINED_COLORS } from "@/types";
import { ColorPicker } from "@/components/forms/ColorPicker";
import { useTranslation } from "react-i18next";

interface AddCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCategory: (category: Omit<Category, "id" | "user_id">) => void;
}


export function AddCategoryModal({ open, onOpenChange, onAddCategory }: AddCategoryModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "" as Category["type"] | "",
    color: PREDEFINED_COLORS[0]
  });
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.type) {
      toast({
        title: t("common.error"),
        description: t("modals.addCategory.errors.required"),
        variant: "destructive"
      });
      return;
    }

    onAddCategory({
      name: formData.name.trim(),
      type: formData.type,
      color: formData.color
    });

    // Reset form
    setFormData({
      name: "",
      type: "",
      color: PREDEFINED_COLORS[0]
    });
    
    onOpenChange(false);
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      type: "",
      color: PREDEFINED_COLORS[0]
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("modals.addCategory.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.addCategory.subtitle")}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <form onSubmit={handleSubmit} className="space-y-6 pr-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("modals.addCategory.fields.name.label")}</Label>
            <Input
              id="name"
              placeholder={t("modals.addCategory.fields.name.placeholder")}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t("modals.addCategory.fields.type.label")}</Label>
            <Select value={formData.type} onValueChange={(value: Category["type"]) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={t("modals.addCategory.fields.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t("transactions.income")}</SelectItem>
                <SelectItem value="expense">{t("transactions.expense")}</SelectItem>
                <SelectItem value="both">{t("modals.addCategory.fields.type.both")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ColorPicker
            value={formData.color}
            onChange={(color) => setFormData(prev => ({ ...prev, color }))}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("modals.addCategory.actions.add")}
            </Button>
          </div>
        </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}