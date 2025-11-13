import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  createDateFromString,
  getTodayString,
  addMonthsToDate,
  calculateInvoiceMonthByDue,
} from "@/lib/dateUtils";
import { useCategories } from "@/hooks/useCategories";
// 1. IMPORTAR O COMPONENTE DE MOEDA CORRETO
import { CurrencyInput } from "@/components/forms/CurrencyInput";
// 2. REMOVER A IMPORTAÇÃO DA FUNÇÃO DE CONVERSÃO ANTIGA
// import { currencyStringToCents } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Transaction {
  id?: string;
  description: string;
  // O amount aqui representa o valor em centavos, como um inteiro.
  amount: number;
  date: Date;
  type: "income" | "expense" | "transfer";
  category_id: string; // Corrigido para category_id
  account_id: string; // Corrigido para account_id
  status: "pending" | "completed";
  installments?: number; // Metadado para o total de parcelas
  currentInstallment?: number;
  parentTransactionId?: string;
  createdAt?: Date;
}

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
  closing_date?: number;
  due_date?: number;
  limit_amount?: number;
}

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // CORREÇÃO: A tipagem agora permite que todas as propriedades de uma transação,
  // exceto as geradas pelo DB, sejam passadas. Isso corrige o bug do parcelamento.
  onAddTransaction: (transaction: Omit<Transaction, "id" | "createdAt">) => void;
  onAddInstallmentTransactions?: (
    transactions: Omit<Transaction, "id" | "createdAt">[]
  ) => void; // Mantém a estrutura completa para parcelas
  accounts: Account[];
  initialType?: "income" | "expense" | ""; // Tipo inicial pré-selecionado
  initialAccountType?: "credit" | "checking" | ""; // Tipo de conta inicial
  lockType?: boolean; // Se true, trava o campo de tipo
}

export function AddTransactionModal({
  open,
  onOpenChange,
  onAddTransaction,
  onAddInstallmentTransactions,
  accounts,
  initialType = "",
  initialAccountType = "",
  lockType = false,
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    // 3. ALTERAR O ESTADO 'amount' PARA NÚMERO (CENTAVOS)
    amount: 0,
    date: getTodayString(),
    type: initialType as "income" | "expense" | "transfer" | "",
    category_id: "",
    account_id: "",
    status: "completed" as "pending" | "completed",
    isInstallment: false,
    installments: "2", // Padrão de 2 se parcelado
    invoiceMonth: "", // Mês da fatura (YYYY-MM)
  });
  const [customInstallments, setCustomInstallments] = useState("");
  const { toast } = useToast();
  const { categories } = useCategories();
  const { t } = useTranslation();

  // Atualiza o tipo inicial quando o modal é aberto e reseta quando fechar
  useEffect(() => {
    if (open) {
      // Reseta o formulário quando abre
      setFormData({
        description: "",
        amount: 0,
        date: getTodayString(),
        type: initialType || "",
        category_id: "",
        account_id: "",
        status: "completed",
        isInstallment: false,
        installments: "2",
        invoiceMonth: "", // Será calculado pelo próximo useEffect
      });
      setCustomInstallments("");
      
      // Pré-seleciona a conta se um tipo de conta foi especificado
      if (initialAccountType && accounts.length > 0) {
        const accountOfType = accounts.find(acc => acc.type === initialAccountType);
        if (accountOfType) {
          setFormData((prev) => ({ ...prev, account_id: accountOfType.id }));
        }
      }
    }
  }, [open, initialType, initialAccountType, accounts]);

  // Recalcula o mês da fatura quando a data ou conta mudam
  useEffect(() => {
    if (!formData.account_id || !formData.date) return;
    
    const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
    if (!selectedAccount || selectedAccount.type !== "credit" || !selectedAccount.closing_date) {
      // Não é cartão de crédito ou não tem data de fechamento
      setFormData(prev => ({ ...prev, invoiceMonth: "" }));
      return;
    }
    
    // Usa a data da transação (não hoje) para calcular o mês da fatura
    const transactionDate = createDateFromString(formData.date);
    const calculatedMonth = calculateInvoiceMonthByDue(
      transactionDate,
      selectedAccount.closing_date,
      selectedAccount.due_date || 1
    );
    
    setFormData(prev => ({ ...prev, invoiceMonth: calculatedMonth }));
  }, [formData.date, formData.account_id, accounts]);

  // Automatically set status based on transaction date
  useEffect(() => {
    if (formData.date) {
      const transactionDateStr = formData.date; // YYYY-MM-DD format
      const todayStr = getTodayString(); // YYYY-MM-DD format

      const newStatus = transactionDateStr <= todayStr ? "completed" : "pending";

      if (formData.status !== newStatus) {
        setFormData((prev) => ({ ...prev, status: newStatus }));
      }
    }
  }, [formData.date]);

  const filteredCategories = useMemo(() => {
    if (!formData.type || formData.type === "transfer") return [];
    return categories.filter(
      (cat) => cat.type === formData.type || cat.type === "both"
    );
  }, [categories, formData.type]);

  const filteredAccounts = useMemo(() => {
    if (initialAccountType === "credit") {
      return accounts.filter((acc) => acc.type === "credit");
    }
    if (initialAccountType === "checking") {
      return accounts.filter((acc) => acc.type !== "credit");
    }
    return accounts;
  }, [accounts, initialAccountType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      description,
      type,
      category_id,
      account_id,
      date,
      status,
      isInstallment,
      installments: installmentsString,
    } = formData;

    // 4. REMOVER A CONVERSÃO. O VALOR JÁ ESTÁ EM CENTAVOS.
    const numericAmount = formData.amount;
    console.log("DEBUG: Valor (em centavos) vindo do estado:", numericAmount);

    // Garantir que o valor convertido seja usado corretamente
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a descrição.",
        variant: "destructive",
      });
      return;
    }

    if (!type) {
      toast({
        title: "Erro",
        description: "Por favor, selecione o tipo de transação.",
        variant: "destructive",
      });
      return;
    }

    if (!category_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma categoria.",
        variant: "destructive",
      });
      return;
    }

    if (!account_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma conta.",
        variant: "destructive",
      });
      return;
    }

    const installments = parseInt(installmentsString === "custom" ? customInstallments : installmentsString);
    if (
      isInstallment &&
      (isNaN(installments) || installments < 2 || installments > 360)
    ) {
      toast({
        title: "Erro",
        description: "O número de parcelas deve ser entre 2 e 360.",
        variant: "destructive",
      });
      return;
    }

    const selectedAccount = accounts.find((acc) => acc.id === account_id);
    if (!selectedAccount) {
      toast({
        title: "Erro",
        description: "Conta selecionada não encontrada.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isInstallment) {
        // --- LÓGICA DE PARCELAMENTO UNIFICADA ---
        if (!onAddInstallmentTransactions) {
          // Garante que a função necessária para parcelamento existe.
          throw new Error("A função onAddInstallmentTransactions não foi fornecida.");
        }

        const baseDate = createDateFromString(date);
        const todayStr = getTodayString();
        const transactionsToCreate = [];

        // Para todos os tipos de conta, criaremos N transações.
        // A diferença é como o valor e o status são tratados.

        if (selectedAccount.type === 'credit') {
          // **Cenário 1: Parcelamento no Cartão de Crédito**
          // Lança N transações com o valor da parcela.
          // O saldo do cartão só é afetado pelas transações 'completed'.
          const baseInstallmentCents = Math.floor(numericAmount / installments);
          const remainderCents = numericAmount % installments;

          for (let i = 0; i < installments; i++) {
            const installmentAmount =
              i === 0
                ? baseInstallmentCents + remainderCents
                : baseInstallmentCents;
            const installmentDate = addMonthsToDate(baseDate, i);
            const installmentDateStr = installmentDate.toISOString().split("T")[0];

            // No cartão, a primeira parcela afeta o saldo se a data for hoje ou no passado.
            // As demais são sempre pendentes para aparecerem nas faturas futuras.
            const installmentStatus: "completed" | "pending" = (i === 0 && installmentDateStr <= todayStr) ? "completed" : "pending";

            // CORREÇÃO: Calcular o invoice_month para cada parcela baseado na sua data e regras de fechamento/vencimento
            const invoiceMonth = (selectedAccount.closing_date && selectedAccount.due_date)
              ? calculateInvoiceMonthByDue(installmentDate, selectedAccount.closing_date, selectedAccount.due_date)
              : undefined;

            const transaction = {
              description: `${description} (${i + 1}/${installments})`,
              // O valor é sempre positivo aqui. O backend aplicará o sinal.
              amount: installmentAmount,
              date: installmentDate,
              type: type as "income" | "expense",
              category_id: category_id,
              account_id: account_id,
              status: installmentStatus,
              installments: installments,
              currentInstallment: i + 1,
              parentTransactionId: undefined,
              invoiceMonth: invoiceMonth,
              invoiceMonthOverridden: false,
            };
            transactionsToCreate.push(transaction);
          }
        } else {
          // Cenário 2: Parcelamento em contas comuns (débito, etc.) - criar N lançamentos também
          const baseInstallmentCents = Math.floor(numericAmount / installments);
          const remainderCents = numericAmount % installments;

          for (let i = 0; i < installments; i++) {
            const installmentAmount =
              i === 0
                ? baseInstallmentCents + remainderCents
                : baseInstallmentCents;
            const installmentDate = addMonthsToDate(baseDate, i);
            const installmentDateStr = installmentDate.toISOString().split("T")[0];

            // Para contas comuns, seguimos a mesma regra de status
            const installmentStatus: "completed" | "pending" =
              i === 0 && installmentDateStr <= todayStr ? status : "pending";

            const transaction = {
              description: `${description} (${i + 1}/${installments})`,
              amount: installmentAmount,
              date: installmentDate,
              type: type as "income" | "expense",
              category_id: category_id,
              account_id: account_id,
              status: installmentStatus,
              installments: installments,
              currentInstallment: i + 1,
              parentTransactionId: undefined,
              invoiceMonth: undefined, // Contas comuns não usam invoice_month
              invoiceMonthOverridden: false,
            };
            transactionsToCreate.push(transaction);
          }
        }

        await onAddInstallmentTransactions(transactionsToCreate);
        toast({
          title: "Sucesso",
          description: `Transação dividida em ${installments}x adicionada com sucesso!`,
          variant: "default",
        });

      } else {
        // Cenário 3: Transação Única (sem parcelamento)
        const transactionPayload = {
          description: description,
          // O valor é sempre positivo aqui. O backend aplicará o sinal.
          amount: Math.abs(numericAmount),
          date: createDateFromString(date), // Passa o objeto Date diretamente
          type: type as "income" | "expense",
          category_id: category_id,
          account_id: account_id,
          status: status,
          invoiceMonth: formData.invoiceMonth || undefined,
          invoiceMonthOverridden: Boolean(formData.invoiceMonth),
        };

        await onAddTransaction(transactionPayload);

        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
          variant: "default",
        });
      }

      // Resetar form e fechar modal em caso de sucesso
      setFormData({
        description: "",
        amount: 0, // 6. ALTERAR RESET para 0
        date: getTodayString(),
        type: "",
        category_id: "",
        account_id: "",
        status: "completed",
        isInstallment: false,
        installments: "2",
        invoiceMonth: "",
      });
      setCustomInstallments("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating transaction(s):", error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialType === "income" 
              ? t("modals.addTransaction.titleIncome")
              : initialType === "expense" 
              ? t("modals.addTransaction.titleExpense")
              : t("modals.addTransaction.title")}
          </DialogTitle>
          <DialogDescription>
            {initialType === "income" 
              ? t("modals.addTransaction.subtitleIncome")
              : initialType === "expense" 
              ? t("modals.addTransaction.subtitleExpense")
              : t("modals.addTransaction.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">{t("modals.addTransaction.fields.description.label")}</Label>
            <Input
              id="description"
              placeholder={t("modals.addTransaction.fields.description.placeholder")}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t("modals.addTransaction.fields.type.label")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: value as any,
                    category_id: "",
                  }))
                }
                disabled={lockType}
              >
                <SelectTrigger disabled={lockType}>
                  <SelectValue placeholder={t("modals.addTransaction.fields.type.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t("transactions.income")}</SelectItem>
                  <SelectItem value="expense">{t("transactions.expense")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t("modals.addTransaction.fields.amount.label")}</Label>
              {/* 5. SUBSTITUIR O INPUT PELO CURRENCYINPUT */}
              <CurrencyInput
                id="amount"
                value={formData.amount}
                onValueChange={(centsValue) => {
                  setFormData((prev) => ({ ...prev, amount: centsValue }));
                }}
                className="h-10 sm:h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">{t("modals.addTransaction.fields.category.label")}</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category_id: value }))
                }
              >
                <SelectTrigger
                  disabled={!formData.type || formData.type === "transfer"}
                >
                  <SelectValue placeholder={t("modals.addTransaction.fields.category.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t("modals.addTransaction.fields.date.label")}</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                className="[color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_id">{t("modals.addTransaction.fields.account.label")}</Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, account_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("modals.addTransaction.fields.account.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: account.color || "#6b7280",
                          }}
                        />
                        {account.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("modals.addTransaction.fields.status.label")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: value as "pending" | "completed",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("modals.addTransaction.fields.status.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">{t("transactions.completed")}</SelectItem>
                  <SelectItem value="pending">{t("transactions.pending")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invoice Month Selection for Credit Cards */}
          {formData.account_id && 
           accounts.find(acc => acc.id === formData.account_id)?.type === "credit" && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="invoiceMonth">{t("modals.addTransaction.fields.invoiceMonth.label")}</Label>
              <Select
                value={formData.invoiceMonth}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, invoiceMonth: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("modals.addTransaction.fields.invoiceMonth.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const months = [];
                    const today = new Date();
                    for (let i = -2; i <= 12; i++) {
                      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
                      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      months.push(
                        <SelectItem key={value} value={value}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    }
                    return months;
                  })()}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("modals.addTransaction.fields.invoiceMonth.help")}
              </p>
            </div>
          )}

          {/* Installment Options */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="installment">{t("modals.addTransaction.fields.installment.label")}</Label>
                <p className="text-sm text-muted-foreground">
                  {formData.account_id &&
                  filteredAccounts.find((acc) => acc.id === formData.account_id)
                    ?.type === "credit" ? t("modals.addTransaction.fields.installment.creditHelp")
                    : t("modals.addTransaction.fields.installment.help")}
                </p>
              </div>
              <Switch
                id="installment"
                checked={formData.isInstallment}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    isInstallment: checked,
                  }))
                }
              />
            </div>

            {formData.isInstallment && (
              <div className="space-y-2">
                <Label htmlFor="installments">{t("modals.addTransaction.fields.installment.numberOfInstallments")}</Label>
                <Select
                  value={formData.installments}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, installments: value }));
                    if (value !== "custom") {
                      setCustomInstallments("");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("modals.addTransaction.fields.installment.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                        {Array.from({ length: 59 }, (_, i) => i + 2).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}x
                        {(() => {
                          const numericAmount = formData.amount;
                          return numericAmount > 0
                            ? ` de ${new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format((numericAmount / 100) / (num || 1))}`
                            : "";
                        })()}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t("modals.addTransaction.fields.installment.custom")}</SelectItem>
                  </SelectContent>
                </Select>
                
                {formData.installments === "custom" && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="customInstallments">{t("modals.addTransaction.fields.installment.customLabel")}</Label>
                    <Input
                      id="customInstallments"
                      type="number"
                      min="61"
                      max="360"
                      placeholder={t("modals.addTransaction.fields.installment.customPlaceholder")}
                      value={customInstallments}
                      onChange={(e) => setCustomInstallments(e.target.value)}
                    />
                    {customInstallments && parseInt(customInstallments) > 0 && formData.amount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {parseInt(customInstallments)}x de{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format((formData.amount / 100) / parseInt(customInstallments))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("modals.addTransaction.actions.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}