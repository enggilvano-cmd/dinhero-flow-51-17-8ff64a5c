import { useState, useMemo, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, AlertCircle, MoreVertical, Copy, AlertTriangle, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import * as XLSX from 'xlsx';

interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
}

interface ImportCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImportCategories: (categories: any[], categoriesToReplace: string[]) => void;
}

interface ImportedCategory {
  nome: string;
  tipo: string;
  cor: string;
  isValid: boolean;
  errors: string[];
  parsedType?: 'income' | 'expense' | 'both';
  isDuplicate: boolean;
  existingCategoryId?: string;
  resolution: 'skip' | 'add' | 'replace';
}

export function ImportCategoriesModal({ 
  open, 
  onOpenChange, 
  categories,
  onImportCategories 
}: ImportCategoriesModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedCategory[]>([]);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const previewSectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para preview após processar
  useEffect(() => {
    if (importedData.length > 0 && previewSectionRef.current) {
      setTimeout(() => {
        previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [importedData.length]);

  // Suporte a cabeçalhos exportados em diferentes idiomas e por páginas do app
  const HEADERS = {
    name: ['Nome', 'Name', 'Nombre', 'Nome da Categoria', 'Category Name', 'Nombre de la Categoría', t('categories.categoryName')],
    type: ['Tipo', 'Type', 'Tipo', 'Tipo da Categoria', 'Category Type', 'Tipo de la Categoría', t('categories.categoryType')],
    color: ['Cor', 'Color', 'Color', 'Cor da Categoria', 'Category Color', 'Color de la Categoría', t('categories.categoryColor')]
  } as const;

  // Normalizadores (definidos antes de usar)
  const normalizeString = (str: string): string => {
    return (str ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  };
  const normalizeKey = (str: string): string => normalizeString(str).replace(/[^a-z0-9]/g, '');

  const pick = (row: any, keys: readonly string[]) => {
    // Mapa normalizado de chaves do Excel -> valor
    const keyMap = new Map<string, any>();
    for (const k of Object.keys(row)) {
      keyMap.set(normalizeKey(k), row[k]);
    }
    for (const key of keys) {
      const candidates = [key, key.toLowerCase()];
      for (const c of candidates) {
        const nk = normalizeKey(c);
        if (keyMap.has(nk)) {
          return keyMap.get(nk);
        }
      }
    }
    return '';
  };
  const validateCategoryType = (tipo: string): 'income' | 'expense' | 'both' | null => {
    const normalizedType = normalizeString(tipo);
    // Suporte para PT-BR, EN-US, ES-ES (singular e plural)
    if (['receita', 'receitas', 'income', 'entrada', 'entradas', 'ingreso', 'ingresos'].includes(normalizedType)) return 'income';
    if (['despesa', 'despesas', 'expense', 'expenses', 'saida', 'saidas', 'gasto', 'gastos'].includes(normalizedType)) return 'expense';
    if (['ambos', 'both', 'misto', 'mista'].includes(normalizedType)) return 'both';
    return null;
  };

  const isValidColor = (color: string): boolean => {
    // Valida cor em formato hexadecimal (#RRGGBB ou #RGB)
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  };

  const validateAndCheckDuplicate = (row: any): ImportedCategory => {
    const errors: string[] = [];
    let isValid = true;

    // Usar o mapeador de cabeçalhos para suportar diferentes idiomas
    const nome = pick(row, HEADERS.name).toString().trim();
    const tipo = pick(row, HEADERS.type).toString().trim();
    const cor = pick(row, HEADERS.color).toString().trim();

    if (!nome) {
      errors.push(t('modals.import.errors.nameRequired'));
      isValid = false;
    }

    if (!tipo) {
      errors.push(t('modals.import.errors.typeRequired'));
      isValid = false;
    }

    if (!cor) {
      errors.push(t('modals.import.errors.colorRequired'));
      isValid = false;
    }

    const parsedType = validateCategoryType(tipo);
    if (!parsedType) {
      errors.push(t('modals.import.errors.invalidCategoryType'));
      isValid = false;
    }

    if (cor && !isValidColor(cor)) {
      errors.push(t('modals.import.errors.invalidColorFormat'));
      isValid = false;
    }

    // Verificação de duplicata (por nome normalizado)
    let isDuplicate = false;
    let existingCategoryId: string | undefined;
    
    if (isValid && nome) {
      const normalizedNome = normalizeString(nome);
      const existingCategory = categories.find(cat => 
        normalizeString(cat.name) === normalizedNome
      );

      if (!existingCategory) {
        // Logs de diagnóstico para entender por que não casou
        const candidatos = categories
          .filter(cat => normalizeString(cat.name).includes(normalizedNome.substring(0, Math.min(5, normalizedNome.length))))
          .map(cat => ({ id: cat.id, name: cat.name, normalized: normalizeString(cat.name), type: cat.type, color: cat.color }));
        console.info('[ImportCat] Sem duplicata. Contexto:', {
          nome,
          normalizedNome,
          tipo: parsedType,
          cor,
          candidatos
        });
      }

      if (existingCategory) {
        isDuplicate = true;
        existingCategoryId = existingCategory.id;
        console.info('[ImportCat] Duplicata encontrada:', { nome, existingCategory });
      }
    }

    return {
      nome,
      tipo,
      cor,
      isValid,
      errors,
      parsedType: parsedType || undefined,
      isDuplicate,
      existingCategoryId,
      resolution: isDuplicate ? 'skip' : 'add',
    };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: t('common.error'),
        description: t('modals.import.errorInvalidFile'),
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      if (rawData.length === 0) {
        toast({
          title: t('common.error'),
          description: t('modals.import.errorEmpty'),
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      const validatedData = rawData.map((row) => validateAndCheckDuplicate(row));
      setImportedData(validatedData);

      const summary = validatedData.reduce((acc, t) => {
        if (!t.isValid) acc.invalid++;
        else if (t.isDuplicate) acc.duplicates++;
        else acc.new++;
        return acc;
      }, { new: 0, duplicates: 0, invalid: 0 });

      toast({
        title: t('modals.import.fileProcessed'),
        description: t('modals.import.summaryDesc', {
          new: summary.new,
          duplicates: summary.duplicates,
          errors: summary.invalid
        }),
      });

    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('modals.import.errorReadFile'),
        variant: "destructive"
      });
    }

    setIsProcessing(false);
  };

  const handleImport = () => {    
    const categoriesToAdd = importedData
      .filter((c, index) => 
        !excludedIndexes.has(index) && 
        c.isValid && 
        (!c.isDuplicate || c.resolution === 'add' || c.resolution === 'replace')
      )
      .map(c => ({
        name: c.nome.trim(),
        type: c.parsedType as 'income' | 'expense' | 'both',
        color: c.cor.trim().toUpperCase(),
      }));

    const categoriesToReplaceIds = importedData
      .filter((c, index) => 
        !excludedIndexes.has(index) && 
        c.isValid && 
        c.isDuplicate && 
        c.resolution === 'replace' && 
        c.existingCategoryId
      )
      .map(c => c.existingCategoryId!);

    if (categoriesToAdd.length === 0 && categoriesToReplaceIds.length === 0) {
      toast({
        title: t('common.error'),
        description: t('modals.import.noItemsToImport'),
        variant: "destructive",
      });
      return;
    }

    onImportCategories(categoriesToAdd, categoriesToReplaceIds);
    
    toast({
      title: t('common.success'),
      description: t('modals.import.categoriesImported', { count: categoriesToAdd.length }),
    });

    // Reset
    setFile(null);
    setImportedData([]);
    setExcludedIndexes(new Set());
    onOpenChange(false);
  };

  const handleCancel = () => {
    setFile(null);
    setImportedData([]);
    setExcludedIndexes(new Set());
    onOpenChange(false);
  };

  const handleToggleExclude = (index: number) => {
    setExcludedIndexes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleResolutionChange = (rowIndex: number, resolution: 'skip' | 'add' | 'replace') => {
    setImportedData(prev => prev.map((row, idx) => 
      idx === rowIndex ? { ...row, resolution } : row
    ));
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Nome': 'Salário',
        'Tipo': 'Receita',
        'Cor': '#22c55e'
      },
      {
        'Nome': 'Alimentação',
        'Tipo': 'Despesa',
        'Cor': '#ef4444'
      },
      {
        'Nome': 'Investimentos',
        'Tipo': 'Ambos',
        'Cor': '#3b82f6'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");

    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 15 }, // Tipo
      { wch: 15 }, // Cor
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'modelo-importacao-categorias.xlsx');

    toast({
      title: t('common.success'),
      description: t('modals.import.templateDownloaded'),
    });
  };

  const summary = useMemo(() => {
    return importedData.reduce((acc, c, index) => {
      if (excludedIndexes.has(index)) {
        acc.excluded++;
      } else if (!c.isValid) {
        acc.invalid++;
      } else if (c.isDuplicate) {
        acc.duplicates++;
      } else {
        acc.new++;
      }
      return acc;
    }, { new: 0, duplicates: 0, invalid: 0, excluded: 0 });
  }, [importedData, excludedIndexes]);

  const categoriesToImportCount = useMemo(() => {
    return importedData.filter((c, index) => 
      !excludedIndexes.has(index) && 
      c.isValid && 
      (!c.isDuplicate || c.resolution === 'add' || c.resolution === 'replace')
    ).length;
  }, [importedData, excludedIndexes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('modals.import.titleCategories')}
          </DialogTitle>
          <DialogDescription>
            {t('modals.import.subtitleCategories')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                  {file && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      {file.name}
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Formato esperado:</strong> O arquivo deve ter as colunas:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li><strong>Nome:</strong> Nome da categoria</li>
                        <li><strong>Tipo:</strong> Receita, Despesa ou Ambos</li>
                        <li><strong>Cor:</strong> Cor em hexadecimal (ex: #22c55e)</li>
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadTemplate()}
                        className="mt-2"
                      >
                        Baixar Modelo de Exemplo
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {importedData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {summary.new}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Novas Categorias
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Copy className="h-5 w-5 text-amber-500" />
                    <div>
                      <div className="text-2xl font-bold text-amber-500">
                        {summary.duplicates}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Duplicatas Encontradas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <div className="text-2xl font-bold text-destructive">
                        {summary.invalid}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Com Erros
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">
                        {summary.excluded}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Excluídas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Banner de Ação para Duplicadas */}
          {importedData.length > 0 && summary.duplicates > 0 && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30" ref={previewSectionRef}>
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <div className="space-y-2">
                  <p className="font-semibold text-base">
                    {t('modals.import.duplicatesFound')}: {summary.duplicates} {t('modals.import.typeCategories').toLowerCase()}
                  </p>
                  <p className="text-sm">
                    Para cada item duplicado, escolha uma ação clicando no menu ao lado: <strong>Pular</strong> (ignorar), <strong>Adicionar</strong> (criar novo) ou <strong>Substituir</strong> (sobrescrever existente).
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          {importedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prévia das Categorias ({importedData.length} total)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead className="w-[180px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedData.map((category, index) => {
                        const isExcluded = excludedIndexes.has(index);
                        
                        return (
                          <TableRow 
                            key={index} 
                            className={isExcluded ? "opacity-50 bg-muted/50" : ""}
                          >
                            <TableCell>
                              {isExcluded ? (
                                <Badge variant="outline" className="bg-muted">Excluída</Badge>
                              ) : !category.isValid ? (
                                <Badge variant="destructive">Erro</Badge>
                              ) : category.isDuplicate ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">Duplicata</Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Nova</Badge>
                              )}
                            </TableCell>
                            <TableCell>{category.nome}</TableCell>
                            <TableCell>{category.tipo}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {category.cor && isValidColor(category.cor) && (
                                  <div 
                                    className="w-4 h-4 rounded-full border"
                                    style={{ backgroundColor: category.cor }}
                                  />
                                )}
                                <span className="text-xs font-mono">{category.cor}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant={isExcluded ? "outline" : "ghost"}
                                  size="sm"
                                  onClick={() => handleToggleExclude(index)}
                                  className="h-7 text-xs"
                                >
                                  {isExcluded ? "Incluir" : "Excluir"}
                                </Button>
                                
                                {!isExcluded && !category.isValid && (
                                  <div className="text-xs text-destructive space-y-1">
                                    {category.errors.map((error, i) => (
                                      <div key={i}>{error}</div>
                                    ))}
                                  </div>
                                )}
                                
                                {!isExcluded && category.isDuplicate && category.isValid && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="text-xs h-7">
                                        {category.resolution === 'skip' && 'Ignorar'}
                                        {category.resolution === 'add' && 'Adicionar'}
                                        {category.resolution === 'replace' && 'Substituir'}
                                        <MoreVertical className="h-3 w-3 ml-1" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => handleResolutionChange(index, 'skip')}>Ignorar</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleResolutionChange(index, 'add')}>Adicionar como Nova</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleResolutionChange(index, 'replace')} className="text-destructive">Substituir</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleImport}
            disabled={categoriesToImportCount === 0 || isProcessing}
          >
            {t('modals.import.importButton', { count: categoriesToImportCount, type: t('modals.import.typeCategories') })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
