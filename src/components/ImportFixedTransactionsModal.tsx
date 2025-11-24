import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { logger } from "@/lib/logger";

interface ImportFixedTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportFixedTransactionsModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportFixedTransactionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      logger.info(`Importing ${jsonData.length} fixed transactions from Excel`);

      toast({
        title: "Importação em desenvolvimento",
        description: "Esta funcionalidade será implementada em breve.",
      });

      onImportComplete();
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
      setFile(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-headline">Importar Transações Fixas</DialogTitle>
          <DialogDescription className="text-body">
            Importe transações fixas de um arquivo Excel (.xlsx)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file" className="text-caption">Arquivo Excel</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={importing}
            />
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-caption font-medium">Formato esperado:</p>
            <ul className="text-caption text-muted-foreground space-y-1 list-disc list-inside">
              <li>Descrição</li>
              <li>Valor (em reais)</li>
              <li>Tipo (receita/despesa)</li>
              <li>Conta</li>
              <li>Categoria (opcional)</li>
              <li>Dia do Mês</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
