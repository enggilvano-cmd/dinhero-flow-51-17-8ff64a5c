import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Search, Tag, TrendingUp, TrendingDown, ArrowUpDown, FileDown, Upload, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AddCategoryModal } from "@/components/AddCategoryModal";
import { EditCategoryModal } from "@/components/EditCategoryModal";
import { ImportCategoriesModal } from "@/components/ImportCategoriesModal";
import * as XLSX from 'xlsx';

interface CategoriesPageProps {}

export function CategoriesPage({}: CategoriesPageProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "both">("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) return;
    
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading categories:', error);
        } else {
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [user]);

  const handleAddCategory = async (categoryData: any) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          ...categoryData,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding category:', error);
        toast({
          title: t("common.error"),
          description: t("messages.errorOccurred"),
          variant: "destructive"
        });
        return;
      }

      setCategories(prev => [...prev, data]);
      
      toast({
        title: t("categories.categoryAdded"),
        description: t("messages.saveSuccess"),
      });
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: t("common.error"),
        description: t("messages.errorOccurred"),
        variant: "destructive"
      });
    }
  };

  const handleEditCategory = async (updatedCategory: any) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('categories')
        .update(updatedCategory)
        .eq('id', updatedCategory.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating category:', error);
        toast({
          title: t("common.error"),
          description: t("messages.errorOccurred"),
          variant: "destructive"
        });
        return;
      }

      setCategories(prev => prev.map(cat => 
        cat.id === updatedCategory.id ? { ...cat, ...updatedCategory } : cat
      ));
      setEditingCategory(null);
      
      toast({
        title: t("categories.categoryUpdated"),
        description: t("messages.updateSuccess"),
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: t("common.error"),
        description: t("messages.errorOccurred"),
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return;
    
    try {
      // Check if category is being used in transactions
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('id')
        .eq('category_id', categoryId)
        .eq('user_id', user.id)
        .limit(1);
      
      if (transError) {
        console.error('Error checking transactions:', transError);
        return;
      }

      if (transactions && transactions.length > 0) {
        toast({
          title: t("common.error"),
          description: t("messages.errorOccurred"),
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting category:', error);
        toast({
          title: t("common.error"),
          description: t("messages.errorOccurred"),
          variant: "destructive"
        });
        return;
      }

      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      
      toast({
        title: t("categories.categoryDeleted"),
        description: t("messages.deleteSuccess"),
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: t("common.error"),
        description: t("messages.errorOccurred"),
        variant: "destructive"
      });
    }
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setEditModalOpen(true);
  };

  const handleImportCategories = async (categoriesToAdd: any[], categoriesToReplaceIds: string[]) => {
    if (!user) return;

    try {
      // Deletar categorias que serão substituídas
      if (categoriesToReplaceIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .in('id', categoriesToReplaceIds)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting categories:', deleteError);
          toast({
            title: t("common.error"),
            description: t("messages.errorOccurred"),
            variant: "destructive"
          });
          return;
        }
      }

      // Inserir novas categorias
      if (categoriesToAdd.length > 0) {
        const { data, error } = await supabase
          .from('categories')
          .insert(categoriesToAdd.map(cat => ({
            ...cat,
            user_id: user.id
          })))
          .select();

        if (error) {
          console.error('Error importing categories:', error);
          toast({
            title: t("common.error"),
            description: t("messages.errorOccurred"),
            variant: "destructive"
          });
          return;
        }

        // Atualizar lista local
        setCategories(prev => {
          const filtered = prev.filter(cat => !categoriesToReplaceIds.includes(cat.id));
          return [...filtered, ...(data || [])];
        });

        toast({
          title: t("common.success"),
          description: `${categoriesToAdd.length} ${t("categories.title").toLowerCase()}`,
        });
      }
    } catch (error) {
      console.error('Error importing categories:', error);
      toast({
        title: t("common.error"),
        description: t("messages.errorOccurred"),
        variant: "destructive"
      });
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredCategories.map((category) => ({
      [t('categories.categoryName')]: category.name,
      [t('categories.categoryType')]: getTypeLabel(category.type),
      [t('categories.categoryColor')]: category.color,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('categories.title'));

    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 15 }, // Tipo
      { wch: 15 }, // Cor
    ];
    ws['!cols'] = colWidths;

    let fileName = t('categories.title').toLowerCase();
    if (filterType !== "all") fileName += `_${filterType}`;
    fileName += ".xlsx";

    XLSX.writeFile(wb, fileName);

    toast({
      title: t("common.success"),
      description: t('categories.exportSuccess', { count: filteredCategories.length }),
    });
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || category.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "income":
        return <TrendingUp className="h-4 w-4" />;
      case "expense":
        return <TrendingDown className="h-4 w-4" />;
      case "both":
        return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income":
        return t("transactions.income");
      case "expense":
        return t("transactions.expense");
      case "both":
        return t("categories.both");
    }
  };

  const getTypeVariant = (type: string) => {
    switch (type) {
      case "income":
        return "default";
      case "expense":
        return "destructive";
      case "both":
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="spacing-responsive-md fade-in pb-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0 w-full">
          <h1 className="text-system-h1 leading-tight">{t("categories.title")}</h1>
          <p className="text-sm text-muted-foreground leading-tight">
            {t("categories.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:grid-cols-3 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button 
            variant="outline" 
            onClick={exportToExcel}
            className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
            disabled={categories.length === 0}
          >
            <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t("common.export")}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setImportModalOpen(true)}
            className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t("common.import")}</span>
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="gap-2 apple-interaction h-9 text-xs sm:text-sm col-span-2 md:col-span-1">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t("categories.addCategory")}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">{t("common.total")}</p>
                  <div className="text-responsive-xl font-bold leading-tight">{categories.length}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">{t("dashboard.revenues")}</p>
                  <div className="text-responsive-xl font-bold balance-positive leading-tight">
                    {categories.filter(c => c.type === "income" || c.type === "both").length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">{t("dashboard.expenses")}</p>
                  <div className="text-responsive-xl font-bold balance-negative leading-tight">
                    {categories.filter(c => c.type === "expense" || c.type === "both").length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ArrowUpDown className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">{t("categories.both")}</p>
                  <div className="text-responsive-xl font-bold text-primary leading-tight">
                    {categories.filter(c => c.type === "both").length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="search" className="text-caption">{t("categories.searchPlaceholder")}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t("categories.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label htmlFor="filter" className="text-caption">{t("accounts.filterByType")}</Label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="touch-target mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="income">{t("transactions.income")}</SelectItem>
                  <SelectItem value="expense">{t("transactions.expense")}</SelectItem>
                  <SelectItem value="both">{t("categories.both")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-headline font-semibold mb-2">{t("categories.noCategories")}</h3>
            <p className="text-body text-muted-foreground mb-4">
              {searchTerm || filterType !== "all" 
                ? t("messages.noDataFound")
                : t("categories.addFirstCategory")
              }
            </p>
            {(!searchTerm && filterType === "all") && (
              <Button onClick={() => setAddModalOpen(true)} className="gap-2 apple-interaction">
                <Plus className="h-4 w-4" />
                {t("categories.addCategory")}
              </Button>
            )}
          </div>
        ) : (
          filteredCategories.map((category) => (
            <Card key={category.id} className="financial-card apple-interaction group">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-3">
                  {/* Header com Ícone, Nome e Menu */}
                  <div className="flex items-center gap-3">
                    {/* Ícone da Categoria */}
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: category.color }}
                    >
                      <Tag className="h-5 w-5 text-white" />
                    </div>

                    {/* Nome e Badge */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold truncate mb-1">
                        {category.name}
                      </h3>
                      <Badge variant={getTypeVariant(category.type)} className="gap-1 text-xs h-5 px-2 inline-flex">
                        {getTypeIcon(category.type)}
                        <span>{getTypeLabel(category.type)}</span>
                      </Badge>
                    </div>

                    {/* Menu de Ações */}
                    <div className="flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:opacity-70 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(category)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setCategoryToDelete(category);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Informações Adicionais */}
                  <div className="pl-[52px] sm:pl-[60px]">
                    <p className="text-xs text-muted-foreground">
                      Criada em {new Date(category.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      <AddCategoryModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAddCategory={handleAddCategory}
      />

      <EditCategoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onEditCategory={handleEditCategory}
        category={editingCategory}
      />

      <ImportCategoriesModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        categories={categories}
        onImportCategories={handleImportCategories}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("categories.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (categoryToDelete) {
                  handleDeleteCategory(categoryToDelete.id);
                  setDeleteDialogOpen(false);
                  setCategoryToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}