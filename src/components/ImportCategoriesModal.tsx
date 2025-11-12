import { useState, useMemo } from "react";
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
  const [file, setFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedCategory[]>([]);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const validateCategoryType = (tipo: string): 'income' | 'expense' | 'both' | null => {
    const normalizedType = tipo.toLowerCase().trim();
    if (['receita', 'income', 'entrada'].includes(normalizedType)) return 'income';
    if (['despesa', 'expense', 'saída', 'saida'].includes(normalizedType)) return 'expense';
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

    const nome = (row.Nome || row.nome || '').toString().trim();
    const tipo = (row.Tipo || row.tipo || '').toString().trim();
    const cor = (row.Cor || row.cor || '').toString().trim();

    if (!nome) {
      errors.push('Nome é obrigatório');
      isValid = false;
    }

    if (!tipo) {
      errors.push('Tipo é obrigatório');
      isValid = false;
    }

    if (!cor) {
      errors.push('Cor é obrigatória');
      isValid = false;
    }

    const parsedType = validateCategoryType(tipo);
    if (!parsedType) {
      errors.push('Tipo deve ser: Receita, Despesa ou Ambos');
      isValid = false;
    }

    if (cor && !isValidColor(cor)) {
      errors.push('Cor deve estar no formato hexadecimal (#RRGGBB)');
      isValid = false;
    }

    // Verificação de duplicata (por nome)
    let isDuplicate = false;
    let existingCategoryId: string | undefined;
    
    if (isValid && nome) {
      const existingCategory = categories.find(cat => 
        cat.name.trim().toLowerCase() === nome.toLowerCase()
      );

      if (existingCategory) {
        isDuplicate = true;
        existingCategoryId = existingCategory.id;
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
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
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
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importar",
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
        title: "Arquivo processado",
        description: `${summary.new} novas, ${summary.duplicates} duplicadas, ${summary.invalid} com erros.`,
      });

    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível ler o arquivo Excel",
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
        color: c.cor.toUpperCase(),
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

    onImportCategories(categoriesToAdd, categoriesToReplaceIds);
    
    toast({
      title: "Categorias importadas",
      description: `${categoriesToAdd.length} categorias foram processadas com sucesso.`,
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
      title: "Modelo baixado",
      description: "Use este arquivo como exemplo para importar suas categorias.",
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Categorias do Excel
          </DialogTitle>
          <DialogDescription>
            Faça o upload de um arquivo Excel (.xlsx ou .xls) para importar múltiplas categorias de uma vez.
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
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={categoriesToImportCount === 0 || isProcessing}
          >
            Importar {categoriesToImportCount} Categorias
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
