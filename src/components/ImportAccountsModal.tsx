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

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  limit_amount?: number;
  due_date?: number;
  closing_date?: number;
  color: string;
}

interface ImportAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onImportAccounts: (accounts: any[], accountsToReplace: string[]) => void;
}

interface ImportedAccount {
  nome: string;
  tipo: string;
  saldo: number;
  limite: number;
  fechamento: number;
  vencimento: number;
  cor: string;
  isValid: boolean;
  errors: string[];
  parsedType?: 'checking' | 'savings' | 'credit' | 'investment';
  isDuplicate: boolean;
  existingAccountId?: string;
  resolution: 'skip' | 'add' | 'replace';
}

export function ImportAccountsModal({ 
  open, 
  onOpenChange, 
  accounts,
  onImportAccounts 
}: ImportAccountsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedAccount[]>([]);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const validateAccountType = (tipo: string): 'checking' | 'savings' | 'credit' | 'investment' | null => {
    const normalizedType = tipo.toLowerCase().trim();
    if (['conta corrente', 'corrente', 'checking'].includes(normalizedType)) return 'checking';
    if (['poupança', 'poupanca', 'savings'].includes(normalizedType)) return 'savings';
    if (['cartão de crédito', 'cartao de credito', 'cartão', 'cartao', 'credit'].includes(normalizedType)) return 'credit';
    if (['investimento', 'investment'].includes(normalizedType)) return 'investment';
    return null;
  };

  const isValidColor = (color: string): boolean => {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  };

  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const validateAndCheckDuplicate = (row: any): ImportedAccount => {
    const errors: string[] = [];
    let isValid = true;

    const nome = (row.Nome || row.nome || '').toString().trim();
    const tipo = (row.Tipo || row.tipo || '').toString().trim();
    const saldo = parseNumber(row.Saldo || row.saldo || 0);
    const limite = parseNumber(row.Limite || row.limite || 0);
    const fechamento = parseInt((row.Fechamento || row.fechamento || 0).toString()) || 0;
    const vencimento = parseInt((row.Vencimento || row.vencimento || 0).toString()) || 0;
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

    const parsedType = validateAccountType(tipo);
    if (!parsedType) {
      errors.push('Tipo inválido. Use: Conta Corrente, Poupança, Cartão de Crédito ou Investimento');
      isValid = false;
    }

    if (cor && !isValidColor(cor)) {
      errors.push('Cor deve estar no formato hexadecimal (#RRGGBB)');
      isValid = false;
    }

    if (parsedType === 'credit') {
      if (fechamento && (fechamento < 1 || fechamento > 31)) {
        errors.push('Fechamento deve estar entre 1 e 31');
        isValid = false;
      }
      if (vencimento && (vencimento < 1 || vencimento > 31)) {
        errors.push('Vencimento deve estar entre 1 e 31');
        isValid = false;
      }
    }

    // Verificação de duplicata (por nome)
    let isDuplicate = false;
    let existingAccountId: string | undefined;
    
    if (isValid && nome) {
      const existingAccount = accounts.find(acc => 
        acc.name.trim().toLowerCase() === nome.toLowerCase()
      );

      if (existingAccount) {
        isDuplicate = true;
        existingAccountId = existingAccount.id;
      }
    }

    return {
      nome,
      tipo,
      saldo,
      limite,
      fechamento,
      vencimento,
      cor,
      isValid,
      errors,
      parsedType: parsedType || undefined,
      isDuplicate,
      existingAccountId,
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
    const accountsToAdd = importedData
      .filter((a, index) => 
        !excludedIndexes.has(index) && 
        a.isValid && 
        (!a.isDuplicate || a.resolution === 'add' || a.resolution === 'replace')
      )
      .map(a => {
        // Converter valores para centavos
        const balanceInCents = Math.round(a.saldo * 100);
        const limitInCents = a.limite > 0 ? Math.round(a.limite * 100) : null;

        return {
          name: a.nome.trim(),
          type: a.parsedType as 'checking' | 'savings' | 'credit' | 'investment',
          balance: balanceInCents,
          limit_amount: limitInCents,
          closing_date: a.parsedType === 'credit' && a.fechamento > 0 ? a.fechamento : null,
          due_date: a.parsedType === 'credit' && a.vencimento > 0 ? a.vencimento : null,
          color: a.cor.toUpperCase(),
        };
      });

    const accountsToReplaceIds = importedData
      .filter((a, index) => 
        !excludedIndexes.has(index) && 
        a.isValid && 
        a.isDuplicate && 
        a.resolution === 'replace' && 
        a.existingAccountId
      )
      .map(a => a.existingAccountId!);

    onImportAccounts(accountsToAdd, accountsToReplaceIds);
    
    toast({
      title: "Contas importadas",
      description: `${accountsToAdd.length} contas foram processadas com sucesso.`,
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
        'Nome': 'Conta Corrente Principal',
        'Tipo': 'Conta Corrente',
        'Saldo': 5000.00,
        'Limite': 0,
        'Fechamento': '',
        'Vencimento': '',
        'Cor': '#3b82f6'
      },
      {
        'Nome': 'Poupança',
        'Tipo': 'Poupança',
        'Saldo': 10000.00,
        'Limite': 0,
        'Fechamento': '',
        'Vencimento': '',
        'Cor': '#22c55e'
      },
      {
        'Nome': 'Cartão Visa',
        'Tipo': 'Cartão de Crédito',
        'Saldo': -1500.00,
        'Limite': 5000.00,
        'Fechamento': 15,
        'Vencimento': 25,
        'Cor': '#ef4444'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");

    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 20 }, // Tipo
      { wch: 15 }, // Saldo
      { wch: 15 }, // Limite
      { wch: 12 }, // Fechamento
      { wch: 12 }, // Vencimento
      { wch: 12 }, // Cor
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'modelo-importacao-contas.xlsx');

    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como exemplo para importar suas contas.",
    });
  };

  const summary = useMemo(() => {
    return importedData.reduce((acc, a, index) => {
      if (excludedIndexes.has(index)) {
        acc.excluded++;
      } else if (!a.isValid) {
        acc.invalid++;
      } else if (a.isDuplicate) {
        acc.duplicates++;
      } else {
        acc.new++;
      }
      return acc;
    }, { new: 0, duplicates: 0, invalid: 0, excluded: 0 });
  }, [importedData, excludedIndexes]);

  const accountsToImportCount = useMemo(() => {
    return importedData.filter((a, index) => 
      !excludedIndexes.has(index) && 
      a.isValid && 
      (!a.isDuplicate || a.resolution === 'add' || a.resolution === 'replace')
    ).length;
  }, [importedData, excludedIndexes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contas do Excel
          </DialogTitle>
          <DialogDescription>
            Faça o upload de um arquivo Excel (.xlsx ou .xls) para importar múltiplas contas de uma vez.
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
                        <li><strong>Nome:</strong> Nome da conta</li>
                        <li><strong>Tipo:</strong> Conta Corrente, Poupança, Cartão de Crédito ou Investimento</li>
                        <li><strong>Saldo:</strong> Saldo atual em Reais (negativo para cartões utilizados)</li>
                        <li><strong>Limite:</strong> Limite em Reais (opcional, principalmente para cartões)</li>
                        <li><strong>Fechamento:</strong> Dia do fechamento (1-31, opcional, apenas para cartões)</li>
                        <li><strong>Vencimento:</strong> Dia do vencimento (1-31, opcional, apenas para cartões)</li>
                        <li><strong>Cor:</strong> Cor em hexadecimal (ex: #3b82f6)</li>
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
                        Novas Contas
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
                <CardTitle>Prévia das Contas ({importedData.length} total)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Limite</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead className="w-[180px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedData.map((account, index) => {
                        const isExcluded = excludedIndexes.has(index);
                        
                        return (
                          <TableRow 
                            key={index} 
                            className={isExcluded ? "opacity-50 bg-muted/50" : ""}
                          >
                            <TableCell>
                              {isExcluded ? (
                                <Badge variant="outline" className="bg-muted">Excluída</Badge>
                              ) : !account.isValid ? (
                                <Badge variant="destructive">Erro</Badge>
                              ) : account.isDuplicate ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">Duplicata</Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Nova</Badge>
                              )}
                            </TableCell>
                            <TableCell>{account.nome}</TableCell>
                            <TableCell>{account.tipo}</TableCell>
                            <TableCell className={account.saldo < 0 ? "text-destructive font-medium" : "text-success font-medium"}>
                              {formatCurrency(account.saldo)}
                            </TableCell>
                            <TableCell>
                              {account.limite > 0 ? formatCurrency(account.limite) : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {account.cor && isValidColor(account.cor) && (
                                  <div 
                                    className="w-4 h-4 rounded-full border"
                                    style={{ backgroundColor: account.cor }}
                                  />
                                )}
                                <span className="text-xs font-mono">{account.cor}</span>
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
                                
                                {!isExcluded && !account.isValid && (
                                  <div className="text-xs text-destructive space-y-1">
                                    {account.errors.map((error, i) => (
                                      <div key={i}>{error}</div>
                                    ))}
                                  </div>
                                )}
                                
                                {!isExcluded && account.isDuplicate && account.isValid && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="text-xs h-7">
                                        {account.resolution === 'skip' && 'Ignorar'}
                                        {account.resolution === 'add' && 'Adicionar'}
                                        {account.resolution === 'replace' && 'Substituir'}
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
            disabled={accountsToImportCount === 0 || isProcessing}
          >
            Importar {accountsToImportCount} Contas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
