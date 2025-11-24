import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { loadXLSX } from "@/lib/lazyImports";
import { Upload, FileSpreadsheet, AlertCircle, Download } from "lucide-react";

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

export function ImportFixedTransactionsModal({
  open,
  onOpenChange,
  onImportComplete,
  accounts,
}: ImportFixedTransactionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo Excel para importar.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const XLSX = await loadXLSX();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importar",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      logger.info(`Processing ${jsonData.length} fixed transactions from Excel`);

      toast({
        title: "Importação em desenvolvimento",
        description: "Esta funcionalidade será implementada em breve.",
      });

      onImportComplete();
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      logger.error("Error importing fixed transactions:", error);
      toast({
        title: "Erro ao importar",
        description: "Não foi possível importar as transações fixas.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    onOpenChange(false);
  };

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
                  disabled={importing}
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
                      disabled={importing}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo de Exemplo
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={importing}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full sm:w-auto"
          >
            {importing ? "Importando..." : "Importar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
