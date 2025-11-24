import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { loadXLSX } from "@/lib/lazyImports";
import { Upload, FileSpreadsheet, AlertCircle, Download, PlusCircle, Copy, AlertTriangle, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
}

interface ImportFixedTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  accounts: Account[];
}

interface ImportedFixedTransaction {
  descricao: string;
  valor: number;
  tipo: string;
  conta: string;
  categoria: string;
  diaDoMes: number;
  status?: string;
  isValid: boolean;
  errors: string[];
  accountId?: string;
  parsedType?: 'income' | 'expense';
  parsedStatus?: 'completed' | 'pending';
  isDuplicate: boolean;
  existingTransactionId?: string;
  resolution: 'skip' | 'add' | 'replace';
}

export function ImportFixedTransactionsModal({
  open,
  onOpenChange,
  onImportComplete,
  accounts,
}: ImportFixedTransactionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedData, setImportedData] = useState<ImportedFixedTransaction[]>([]);
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set());
  const [existingTransactions, setExistingTransactions] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Normalizar string para comparação
  const normalizeString = (str: string): string => {
    return str
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Validar tipo de transação
  const validateTransactionType = (tipo: string): 'income' | 'expense' | null => {
    const normalizedType = normalizeString(tipo);
    if (['receita', 'receitas', 'income', 'entrada', 'entradas'].includes(normalizedType)) return 'income';
    if (['despesa', 'despesas', 'expense', 'expenses', 'saida', 'saidas'].includes(normalizedType)) return 'expense';
    return null;
  };

  // Validar status
  const validateStatus = (status: string): 'completed' | 'pending' | null => {
    if (!status) return 'pending'; // padrão para fixas
    const normalizedStatus = normalizeString(status);
    if (['concluida', 'completed', 'finalizada'].includes(normalizedStatus)) return 'completed';
    if (['pendente', 'pending'].includes(normalizedStatus)) return 'pending';
    return null;
  };

  // Encontrar conta por nome
  const findAccountByName = (accountName: string): Account | null => {
    const normalizedName = normalizeString(accountName);
    return accounts.find(acc => normalizeString(acc.name) === normalizedName) || null;
  };

  // Extrair valor da célula (suporta diferentes formatos)
  const extractValue = (row: Record<string, unknown>, keys: string[]): any => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
      const lowerKey = key.toLowerCase();
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase() === lowerKey) {
          return row[rowKey];
        }
      }
    }
    return '';
  };

  // Carregar transações fixas existentes
  const loadExistingTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_fixed", true)
        .is("parent_transaction_id", null);

      if (error) throw error;
      setExistingTransactions(data || []);
    } catch (error) {
      logger.error("Error loading existing fixed transactions:", error);
    }
  };

  // Validar e verificar duplicata
  const validateAndCheckDuplicate = (row: Record<string, unknown>): ImportedFixedTransaction => {
    const errors: string[] = [];
    let isValid = true;

    const descricao = extractValue(row, ['Descrição', 'Description', 'descricao', 'description']) as string;
    
    // Parse valor com suporte ao formato brasileiro (vírgula como decimal)
    const rawValor = String(extractValue(row, ['Valor', 'Amount', 'valor', 'amount']) || '0');
    const valor = parseFloat(rawValor.replace(/\./g, '').replace(',', '.'));
    
    const tipo = extractValue(row, ['Tipo', 'Type', 'tipo', 'type']) as string;
    const conta = extractValue(row, ['Conta', 'Account', 'conta', 'account']) as string;
    const categoria = extractValue(row, ['Categoria', 'Category', 'categoria', 'category']) as string;
    const diaDoMes = parseInt(extractValue(row, ['Dia do Mês', 'Day of Month', 'diaDoMes', 'dia']) || '0');
    const status = extractValue(row, ['Status', 'status']) as string || 'pending';

    // Validações
    if (!descricao) {
      errors.push('Descrição é obrigatória');
      isValid = false;
    }

    if (isNaN(valor) || valor <= 0) {
      errors.push('Valor inválido (deve ser > 0)');
      isValid = false;
    }

    if (!tipo) {
      errors.push('Tipo é obrigatório');
      isValid = false;
    }

    if (!conta) {
      errors.push('Conta é obrigatória');
      isValid = false;
    }

    if (!categoria) {
      errors.push('Categoria é obrigatória');
      isValid = false;
    }

    if (isNaN(diaDoMes) || diaDoMes < 1 || diaDoMes > 31) {
      errors.push('Dia do mês inválido (1-31)');
      isValid = false;
    }

    const parsedType = validateTransactionType(tipo);
    if (!parsedType) {
      errors.push('Tipo inválido (use: Receita ou Despesa)');
      isValid = false;
    }

    const account = findAccountByName(conta);
    if (!account) {
      errors.push('Conta não encontrada');
      isValid = false;
    }

    const parsedStatus = validateStatus(status);
    if (!parsedStatus) {
      errors.push('Status inválido (use: Pendente ou Concluída)');
      isValid = false;
    }

    // Verificar duplicata
    let isDuplicate = false;
    let existingTransactionId: string | undefined;

    if (isValid && account) {
      const valorInCents = Math.round(Math.abs(valor) * 100);
      const existing = existingTransactions.find(tx => {
        const isSameDescription = normalizeString(tx.description) === normalizeString(descricao);
        const isSameAmount = Math.abs(tx.amount) === valorInCents;
        const isSameAccount = tx.account_id === account.id;
        const txDate = new Date(tx.date);
        const isSameDay = txDate.getDate() === diaDoMes;
        
        return isSameDescription && isSameAmount && isSameAccount && isSameDay;
      });

      if (existing) {
        isDuplicate = true;
        existingTransactionId = existing.id;
      }
    }

    return {
      descricao,
      valor,
      tipo,
      conta,
      categoria,
      diaDoMes,
      status,
      isValid,
      errors,
      accountId: account?.id,
      parsedType: parsedType || undefined,
      parsedStatus: parsedStatus || undefined,
      isDuplicate,
      existingTransactionId,
      resolution: isDuplicate ? 'skip' : 'add',
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
        toast({
          title: "Arquivo inválido",
          description: "Selecione um arquivo Excel (.xlsx ou .xls)",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      setIsProcessing(true);

      try {
        // Carregar transações existentes
        await loadExistingTransactions();

        const XLSX = await loadXLSX();
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
          toast({
            title: "Arquivo vazio",
            description: "O arquivo não contém dados para importar",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        const validatedData = rawData.map((row: unknown) => 
          validateAndCheckDuplicate(row as Record<string, unknown>)
        );

        setImportedData(validatedData);

        const summary = validatedData.reduce((acc, t) => {
          if (!t.isValid) acc.invalid++;
          else if (t.isDuplicate) acc.duplicates++;
          else acc.new++;
          return acc;
        }, { new: 0, duplicates: 0, invalid: 0 });

        toast({
          title: "Arquivo processado",
          description: `${summary.new} novas, ${summary.duplicates} duplicadas, ${summary.invalid} com erros`,
        });

      } catch (error) {
        logger.error("Error processing file:", error);
        toast({
          title: "Erro ao processar arquivo",
          description: "Verifique o formato e tente novamente",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await loadXLSX();
      
      const templateData = [
        {
          'Descrição': 'Aluguel',
          'Valor': 1500.00,
          'Tipo': 'Despesa',
          'Conta': accounts[0]?.name || 'Conta Corrente',
          'Categoria': 'Habitação',
          'Dia do Mês': 5,
          'Status': 'Pendente'
        },
        {
          'Descrição': 'Salário',
          'Valor': 5000.00,
          'Tipo': 'Receita',
          'Conta': accounts[0]?.name || 'Conta Corrente',
          'Categoria': 'Salário',
          'Dia do Mês': 1,
          'Status': 'Pendente'
        },
        {
          'Descrição': 'Internet',
          'Valor': 99.90,
          'Tipo': 'Despesa',
          'Conta': accounts[0]?.name || 'Conta Corrente',
          'Categoria': 'Serviços',
          'Dia do Mês': 10,
          'Status': 'Pendente'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transações Fixas");

      // Configurar largura das colunas
      const colWidths = [
        { wch: 30 }, // Descrição
        { wch: 12 }, // Valor
        { wch: 12 }, // Tipo
        { wch: 25 }, // Conta
        { wch: 20 }, // Categoria
        { wch: 12 }, // Dia do Mês
        { wch: 12 }  // Status
      ];
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, 'modelo-transacoes-fixas.xlsx');

      toast({
        title: "Modelo baixado",
        description: "O arquivo modelo foi baixado com sucesso",
      });
    } catch (error) {
      logger.error("Error downloading template:", error);
      toast({
        title: "Erro ao baixar modelo",
        description: "Não foi possível baixar o modelo de importação",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    const transactionsToAdd = importedData
      .filter((t, index) => 
        !excludedIndexes.has(index) && 
        t.isValid && 
        (t.resolution === 'add' || t.resolution === 'replace')
      );

    const transactionsToReplaceIds = importedData
      .filter((t, index) => 
        !excludedIndexes.has(index) && 
        t.isValid && 
        t.isDuplicate && 
        t.resolution === 'replace' && 
        t.existingTransactionId
      )
      .map(t => t.existingTransactionId!);

    if (transactionsToAdd.length === 0 && transactionsToReplaceIds.length === 0) {
      toast({
        title: "Nenhuma transação para importar",
        description: "Selecione pelo menos uma transação válida",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Carregar categorias existentes
      const { data: existingCategories } = await supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", user.id);

      const categoryMap = new Map(existingCategories?.map(c => [normalizeString(c.name), c.id]) || []);

      // Coletar categorias únicas necessárias
      const uniqueCategoryNames = new Set(transactionsToAdd.map(t => t.categoria.trim()));
      const categoriesToCreate = Array.from(uniqueCategoryNames).filter(
        name => !categoryMap.has(normalizeString(name))
      );

      // Criar categorias em batch se necessário
      if (categoriesToCreate.length > 0) {
        const { data: newCategories, error: createError } = await supabase
          .from("categories")
          .insert(
            categoriesToCreate.map(name => ({
              user_id: user.id,
              name: name,
              type: 'both' as const,
              color: '#6b7280',
            }))
          )
          .select();

        if (createError) {
          logger.error("Error creating categories:", createError);
          throw createError;
        }

        // Adicionar ao mapa
        newCategories?.forEach(cat => categoryMap.set(normalizeString(cat.name), cat.id));
      }

      // Deletar transações marcadas para substituição
      if (transactionsToReplaceIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .in("id", transactionsToReplaceIds)
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;
      }

      // Criar transações fixas
      let successCount = 0;
      let errorCount = 0;

      for (const t of transactionsToAdd) {
        try {
          // Calcular a data inicial (dia do mês atual ou próximo mês)
          const today = new Date();
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth();
          let initialDate = new Date(currentYear, currentMonth, t.diaDoMes);
          
          // Se a data já passou, iniciar no próximo mês
          if (initialDate < today) {
            initialDate = new Date(currentYear, currentMonth + 1, t.diaDoMes);
          }

          const amount = Math.round(Math.abs(t.valor) * 100);
          const categoryId = categoryMap.get(normalizeString(t.categoria)) || null;

          const { data, error } = await supabase.functions.invoke('atomic-create-fixed', {
            body: {
              description: t.descricao.trim(),
              amount: amount,
              date: initialDate.toISOString().split('T')[0],
              type: t.parsedType,
              category_id: categoryId,
              account_id: t.accountId,
              status: t.parsedStatus || 'pending',
            },
          });

          if (error) {
            logger.error("Error creating fixed transaction:", error);
            errorCount++;
          } else if (data?.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          logger.error("Error importing transaction:", error);
          errorCount++;
        }
      }

      toast({
        title: successCount > 0 ? "Importação concluída" : "Erro na importação",
        description: `${successCount} transação(ões) importada(s)${errorCount > 0 ? `, ${errorCount} com erro` : ''}`,
        variant: errorCount > 0 && successCount === 0 ? "destructive" : "default",
      });

      if (successCount > 0) {
        // Invalidar todas as queries relacionadas
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
          queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
          queryClient.refetchQueries({ queryKey: ['transactions-totals'] }),
        ]);
        
        onImportComplete();
        setFile(null);
        setImportedData([]);
        setExcludedIndexes(new Set());
        onOpenChange(false);
      }
    } catch (error) {
      logger.error("Error importing fixed transactions:", error);
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Não foi possível importar as transações",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
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

  const summary = useMemo(() => {
    return importedData.reduce((acc, t, index) => {
      if (excludedIndexes.has(index)) {
        acc.excluded++;
      } else if (!t.isValid) {
        acc.invalid++;
      } else if (t.isDuplicate) {
        acc.duplicates++;
      } else {
        acc.new++;
      }
      return acc;
    }, { new: 0, duplicates: 0, invalid: 0, excluded: 0 });
  }, [importedData, excludedIndexes]);

  const transactionsToImportCount = useMemo(() => {
    return importedData.filter((t, index) => 
      !excludedIndexes.has(index) && 
      t.isValid && 
      (t.resolution === 'add' || t.resolution === 'replace')
    ).length;
  }, [importedData, excludedIndexes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-headline">
            <Upload className="h-5 w-5" />
            Importar Transações Fixas
          </DialogTitle>
          <DialogDescription className="text-body">
            Importe transações fixas em lote a partir de um arquivo Excel
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={importing || isProcessing}
                  className="cursor-pointer"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted rounded-md">
                    <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <AlertDescription>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm mb-2">Formato esperado:</p>
                      <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                        <li><strong>Descrição:</strong> Nome da transação fixa</li>
                        <li><strong>Valor:</strong> Valor numérico (ex: 1500.00)</li>
                        <li><strong>Tipo:</strong> Receita ou Despesa</li>
                        <li><strong>Conta:</strong> Nome da conta (deve existir)</li>
                        <li><strong>Categoria:</strong> Categoria da transação</li>
                        <li><strong>Dia do Mês:</strong> Número de 1 a 31</li>
                        <li><strong>Status:</strong> Pendente ou Concluída (opcional)</li>
                      </ul>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadTemplate}
                      className="w-full sm:w-auto"
                      disabled={importing || isProcessing}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo de Exemplo
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {importedData.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-primary">{summary.new}</div>
                      <p className="text-xs text-muted-foreground">Novas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-amber-500">{summary.duplicates}</div>
                      <p className="text-xs text-muted-foreground">Duplicadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-destructive">{summary.invalid}</div>
                      <p className="text-xs text-muted-foreground">Com Erros</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-muted-foreground">{summary.excluded}</div>
                      <p className="text-xs text-muted-foreground">Excluídas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Duplicates Alert */}
          {importedData.length > 0 && summary.duplicates > 0 && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <p className="font-semibold text-sm mb-1">
                  {summary.duplicates} duplicatas encontradas
                </p>
                <p className="text-xs">
                  Escolha uma ação: <strong>Pular</strong>, <strong>Adicionar</strong> ou <strong>Substituir</strong>
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          {importedData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prévia ({importedData.length} transações)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead className="w-16">Dia</TableHead>
                        <TableHead className="w-36">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedData.map((transaction, index) => {
                        const isExcluded = excludedIndexes.has(index);
                        
                        return (
                          <TableRow 
                            key={index} 
                            className={isExcluded ? "opacity-50 bg-muted/50" : ""}
                          >
                            <TableCell>
                              {isExcluded ? (
                                <Badge variant="outline" className="bg-muted text-xs">Excluída</Badge>
                              ) : !transaction.isValid ? (
                                <Badge variant="destructive" className="text-xs">Erro</Badge>
                              ) : transaction.isDuplicate ? (
                                <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">Duplicata</Badge>
                              ) : (
                                <Badge variant="default" className="bg-success/10 text-success text-xs">Nova</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{transaction.descricao}</TableCell>
                            <TableCell className="text-sm">R$ {transaction.valor.toFixed(2)}</TableCell>
                            <TableCell className="text-sm">{transaction.tipo}</TableCell>
                            <TableCell className="text-sm">{transaction.conta}</TableCell>
                            <TableCell className="text-sm text-center">{transaction.diaDoMes}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant={isExcluded ? "outline" : "ghost"}
                                  size="sm"
                                  onClick={() => handleToggleExclude(index)}
                                  className="h-7 text-xs px-2"
                                >
                                  {isExcluded ? "Incluir" : "Excluir"}
                                </Button>
                                
                                {!isExcluded && !transaction.isValid && (
                                  <div className="text-xs text-destructive">
                                    {transaction.errors[0]}
                                  </div>
                                )}
                                
                                {!isExcluded && transaction.isDuplicate && transaction.isValid && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                                        {transaction.resolution === 'skip' && 'Pular'}
                                        {transaction.resolution === 'add' && 'Adicionar'}
                                        {transaction.resolution === 'replace' && 'Substituir'}
                                        <MoreVertical className="h-3 w-3 ml-1" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="z-50 bg-popover">
                                      <DropdownMenuItem onClick={() => handleResolutionChange(index, 'skip')}>
                                        Pular
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleResolutionChange(index, 'add')}>
                                        Adicionar como Nova
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleResolutionChange(index, 'replace')}
                                        className="text-destructive"
                                      >
                                        Substituir
                                      </DropdownMenuItem>
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

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={importing || isProcessing}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={transactionsToImportCount === 0 || importing || isProcessing}
            className="w-full sm:w-auto"
          >
            {importing ? "Importando..." : `Importar ${transactionsToImportCount} transação${transactionsToImportCount !== 1 ? 'ões' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
