import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Category, PREDEFINED_COLORS } from "@/types";
import { ColorPicker } from "@/components/forms/ColorPicker";
import { useTranslation } from "react-i18next";

interface EditCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCategory: (category: Category) => void;
  category: Category | null;
}

export function EditCategoryModal({ open, onOpenChange, onEditCategory, category }: EditCategoryModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "" as Category["type"] | "",
    color: PREDEFINED_COLORS[0]
  });
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        type: category.type,
        color: category.color
      });
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category) return;
    
    if (!formData.name.trim() || !formData.type) {
      toast({
        title: t("common.error"),
        description: t("modals.editCategory.errors.required"),
        variant: "destructive"
      });
      return;
    }

    onEditCategory({
      ...category,
      name: formData.name.trim(),
      type: formData.type,
      color: formData.color
    });

    onOpenChange(false);
  };

  const handleCancel = () => {
    if (category) {
      setFormData({
        name: category.name,
        type: category.type,
        color: category.color
      });
    }
    onOpenChange(false);
  };

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("modals.editCategory.title")}</DialogTitle>
          <DialogDescription>
            {t("modals.editCategory.subtitle")}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t("modals.editCategory.fields.name.label")}</Label>
            <Input
              id="name"
              placeholder={t("modals.editCategory.fields.name.placeholder")}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t("modals.editCategory.fields.type.label")}</Label>
            <Select value={formData.type} onValueChange={(value: Category["type"]) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={t("modals.editCategory.fields.type.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t("transactions.income")}</SelectItem>
                <SelectItem value="expense">{t("transactions.expense")}</SelectItem>
                <SelectItem value="both">{t("modals.editCategory.fields.type.both")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ColorPicker
            value={formData.color}
            onChange={handleColorChange}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("modals.editCategory.actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}