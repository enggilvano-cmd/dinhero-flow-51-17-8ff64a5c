import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MarkAsPaidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any | null;
  accounts: any[];
  onConfirm: (transactionId: string, date: Date, amount: number, accountId: string) => void;
}

export function MarkAsPaidModal({
  open,
  onOpenChange,
  transaction,
  accounts,
  onConfirm,
}: MarkAsPaidModalProps) {
  const { t } = useTranslation();
  
  const [date, setDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");

  // Quando o modal abre, pré-preenche os valores
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && transaction) {
      setDate(new Date());
      setAmount((transaction.amount / 100).toFixed(2));
      setAccountId(transaction.account_id);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (!transaction || !accountId) return;
    
    const amountInCents = Math.round(parseFloat(amount) * 100);
    onConfirm(transaction.id, date, amountInCents, accountId);
    onOpenChange(false);
  };

  const handleAmountChange = (value: string) => {
    // Permitir apenas números e ponto/vírgula
    const sanitized = value.replace(/[^\d.,]/g, "").replace(",", ".");
    setAmount(sanitized);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("transactions.markAsPaid")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Data */}
          <div className="grid gap-2">
            <Label htmlFor="date">{t("transactions.date")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : t("common.selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Valor */}
          <div className="grid gap-2">
            <Label htmlFor="amount">{t("transactions.amount")}</Label>
            <Input
              id="amount"
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Conta */}
          <div className="grid gap-2">
            <Label htmlFor="account">{t("transactions.account")}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t("transactions.selectAccount")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!accountId || !amount || parseFloat(amount) <= 0}
          >
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
