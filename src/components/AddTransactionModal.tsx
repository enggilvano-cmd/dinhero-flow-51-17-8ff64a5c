import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { logger } from "@/lib/logger";
import {
  createDateFromString,
  getTodayString,
  addMonthsToDate,
  calculateInvoiceMonthByDue,
} from "@/lib/dateUtils";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { addTransactionSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { queryKeys } from "@/lib/queryClient";

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
  invoiceMonth?: string;
  invoiceMonthOverridden?: boolean;
  is_recurring?: boolean;
  recurrence_type?: "daily" | "weekly" | "monthly" | "yearly";
  recurrence_end_date?: string;
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
  onSuccess?: () => void; // Callback opcional após sucesso
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
  onSuccess,
  accounts,
  initialType = "",
  initialAccountType = "",
  lockType = false,
}: AddTransactionModalProps) {
  const queryClient = useQueryClient();
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
    isRecurring: false,
    recurrenceType: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    recurrenceEndDate: "",
    isFixed: false,
  });
  const [customInstallments, setCustomInstallments] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { categories } = useCategories();

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
        isRecurring: false,
        recurrenceType: "monthly",
        recurrenceEndDate: "",
        isFixed: false,
      });
      setCustomInstallments("");
      setValidationErrors({});
      
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

    // Limpar erros anteriores
    setValidationErrors({});

    // Validação com Zod
    try {
      const validationData = {
        description: formData.description,
        amount: formData.amount,
        date: formData.date,
        type: formData.type || undefined,
        category_id: formData.category_id,
        account_id: formData.account_id,
        status: formData.status,
        isInstallment: formData.isInstallment,
        installments: formData.installments,
        customInstallments: customInstallments,
        invoiceMonth: formData.invoiceMonth,
        isRecurring: formData.isRecurring,
        recurrenceType: formData.recurrenceType,
        recurrenceEndDate: formData.recurrenceEndDate,
        isFixed: formData.isFixed,
      };

      addTransactionSchema.parse(validationData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          errors[path] = err.message;
        });
        setValidationErrors(errors);

        // Exibir o primeiro erro em um toast
        const firstError = error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive",
        });
        
        logger.error("Validation errors:", errors);
        return;
      }
    }

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

    const numericAmount = formData.amount;
    logger.debug("Valor (em centavos) vindo do estado:", numericAmount);

    const installments = parseInt(installmentsString === "custom" ? customInstallments : installmentsString);
    if (
      isInstallment &&
      (isNaN(installments) || installments < 2 || installments > 360)
    ) {
      toast({
        title: "Erro",
        description: "Número de parcelas deve estar entre 2 e 360",
        variant: "destructive",
      });
      return;
    }

    const selectedAccount = accounts.find((acc) => acc.id === account_id);
    if (!selectedAccount) {
      toast({
        title: "Erro",
        description: "Conta não encontrada",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isInstallment) {
        // --- LÓGICA DE PARCELAMENTO UNIFICADA ---
        if (!onAddInstallmentTransactions) {
          // Garante que a função necessária para parcelamento existe.
          throw new Error("Função de parcelamento não disponível");
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

            // Para cartão de crédito, todas as parcelas são criadas com status concluída
            const installmentStatus: "completed" | "pending" = "completed";

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

            // Para contas comuns, a primeira parcela usa o status do formulário se for hoje ou passado
            // As demais parcelas são pendentes
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
          description: `${installments} parcelas criadas com sucesso`,
          variant: "default",
        });

      } else if (formData.isFixed) {
        // Fixed Transaction (monthly recurring without end date)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Gerar transações do mês atual até o final do ano corrente + todos os meses do próximo ano
        const transactionsToGenerate = [];
        // Parse da data de forma segura para evitar problemas de timezone
        const [year, month, day] = date.split('-').map(Number);
        const currentYear = year;
        const currentMonth = month - 1; // JavaScript usa 0-11 para meses
        const dayOfMonth = day;

        // Calcular meses restantes no ano corrente (incluindo o mês atual)
        const monthsLeftInCurrentYear = 12 - currentMonth;

        // Gerar transações para os meses restantes do ano corrente
        // A primeira transação (i=0) será a transação principal recorrente
        for (let i = 0; i < monthsLeftInCurrentYear; i++) {
          const nextDate = new Date(currentYear, currentMonth + i, dayOfMonth);
          
          // Ajustar para o dia correto do mês
          const targetMonth = nextDate.getMonth();
          nextDate.setDate(dayOfMonth);
          
          // Se o mês mudou (ex: 31 de janeiro -> 3 de março), ajustar para o último dia do mês anterior
          if (nextDate.getMonth() !== targetMonth) {
            nextDate.setDate(0);
          }

          const transactionDate = nextDate.toISOString().split('T')[0];
          const today = new Date().toISOString().split('T')[0];

          // A primeira transação é a principal com is_fixed = true
          if (i === 0) {
            transactionsToGenerate.push({
              description: description,
              amount: Math.abs(numericAmount),
              date: transactionDate,
              type: type as "income" | "expense",
              category_id: category_id,
              account_id: account_id,
              status: formData.status as "pending" | "completed",
              user_id: user.id,
              is_fixed: true,
            });
          } else {
            transactionsToGenerate.push({
              description: description,
              amount: Math.abs(numericAmount),
              date: transactionDate,
              type: type as "income" | "expense",
              category_id: category_id,
              account_id: account_id,
              status: (transactionDate <= today ? "completed" : "pending") as "completed" | "pending",
              user_id: user.id,
            });
          }
        }

        // Gerar transações para todos os 12 meses do próximo ano (todas como pendentes)
        const nextYear = currentYear + 1;
        for (let month = 0; month < 12; month++) {
          const nextDate = new Date(nextYear, month, dayOfMonth);
          
          // Ajustar para o dia correto do mês
          const targetMonth = nextDate.getMonth();
          nextDate.setDate(dayOfMonth);
          
          // Se o mês mudou (ex: 31 de janeiro -> 3 de março), ajustar para o último dia do mês anterior
          if (nextDate.getMonth() !== targetMonth) {
            nextDate.setDate(0);
          }

          transactionsToGenerate.push({
            description: description,
            amount: Math.abs(numericAmount),
            date: nextDate.toISOString().split('T')[0],
            type: type as "income" | "expense",
            category_id: category_id,
            account_id: account_id,
            status: "pending" as "pending",
            user_id: user.id,
          });
        }

        // Inserir todas as transações de uma vez
        const { error: insertError, data: insertedTransactions } = await supabase
          .from("transactions")
          .insert(transactionsToGenerate)
          .select();

        if (insertError) throw insertError;

        // Pegar o ID da transação principal (a primeira inserida)
        const recurringTransaction = insertedTransactions[0];

        // Atualizar as transações filhas com o parent_transaction_id
        const childTransactionIds = insertedTransactions.slice(1).map(t => t.id);
        
        if (childTransactionIds.length > 0) {
          const { error: updateError } = await supabase
            .from("transactions")
            .update({ parent_transaction_id: recurringTransaction.id })
            .in("id", childTransactionIds);

          if (updateError) {
            logger.error("Erro ao vincular transações filhas:", updateError);
          }
        }

        // 🔄 Invalidar e refazer fetch imediatamente para refletir as transações fixas
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.transactionsBase }),
          queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
        ]);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.transactionsBase }),
          queryClient.refetchQueries({ queryKey: queryKeys.accounts }),
        ]);

        toast({
          title: "Transação Fixa Adicionada",
          description: `${transactionsToGenerate.length} transações foram geradas (até o final de ${nextYear})`,
          variant: "default",
        });

        // Chamar callback de sucesso se fornecido
        if (onSuccess) {
          onSuccess();
        }

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
          is_recurring: formData.isRecurring || false,
          recurrence_type: formData.isRecurring ? formData.recurrenceType : undefined,
          recurrence_end_date: formData.isRecurring && formData.recurrenceEndDate 
            ? formData.recurrenceEndDate 
            : undefined,
        };

        await onAddTransaction(transactionPayload);

        toast({
          title: "Sucesso",
          description: "Transação criada com sucesso",
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
        isRecurring: false,
        recurrenceType: "monthly",
        recurrenceEndDate: "",
        isFixed: false,
      });
      setCustomInstallments("");
      onOpenChange(false);
    } catch (error) {
      logger.error("Error creating transaction(s):", error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialType === "income" 
              ? "Adicionar Receita"
              : initialType === "expense" 
              ? "Adicionar Despesa"
              : "Adicionar Transação"}
          </DialogTitle>
          <DialogDescription>
            {initialType === "income" 
              ? "Registre uma nova receita"
              : initialType === "expense" 
              ? "Registre uma nova despesa"
              : "Preencha os dados da nova transação"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Compra no mercado, salário, etc."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
            />
            {validationErrors.description && (
              <p className="text-sm text-destructive">{validationErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
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
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
              {validationErrors.type && (
                <p className="text-sm text-destructive">{validationErrors.type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor</Label>
              {/* 5. SUBSTITUIR O INPUT PELO CURRENCYINPUT */}
              <CurrencyInput
                id="amount"
                value={formData.amount}
                onValueChange={(centsValue) => {
                  setFormData((prev) => ({ ...prev, amount: centsValue }));
                }}
                className="h-10 sm:h-11"
              />
              {validationErrors.amount && (
                <p className="text-sm text-destructive">{validationErrors.amount}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Categoria</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category_id: value }))
                }
              >
                <SelectTrigger
                  disabled={!formData.type || formData.type === "transfer"}
                >
                  <SelectValue placeholder="Selecione uma categoria" />
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
              {validationErrors.category_id && (
                <p className="text-sm text-destructive">{validationErrors.category_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                className="[color-scheme:light] dark:[color-scheme:dark]"
              />
              {validationErrors.date && (
                <p className="text-sm text-destructive">{validationErrors.date}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_id">Conta</Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, account_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
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
              {validationErrors.account_id && (
                <p className="text-sm text-destructive">{validationErrors.account_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
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
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invoice Month Selection for Credit Cards */}
          {formData.account_id && 
           accounts.find(acc => acc.id === formData.account_id)?.type === "credit" && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="invoiceMonth">Mês da Fatura</Label>
              <Select
                value={formData.invoiceMonth}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, invoiceMonth: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
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
                Selecione para qual fatura esse gasto será lançado
              </p>
            </div>
          )}

          {/* Installment Options */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="installment" className="text-base font-semibold cursor-pointer">
                    Parcelamento
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.account_id &&
                  filteredAccounts.find((acc) => acc.id === formData.account_id)
                    ?.type === "credit" ? "Divida o valor em várias parcelas no cartão de crédito"
                    : "Divida o valor em várias parcelas mensais"}
                </p>
              </div>
              <Switch
                id="installment"
                checked={formData.isInstallment}
                disabled={formData.isRecurring || formData.isFixed}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    isInstallment: checked,
                  }))
                }
                className="mt-1 data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-primary/50"
              />
            </div>

            {formData.isInstallment && (
              <div className="space-y-4 pt-2 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="installments">Número de Parcelas</Label>
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
                      <SelectValue placeholder="Selecione o número de parcelas" />
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
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {formData.installments === "custom" && (
                    <div className="space-y-2 pt-2 animate-fade-in">
                      <Label htmlFor="customInstallments">Número personalizado de parcelas</Label>
                      <Input
                        id="customInstallments"
                        type="number"
                        min="61"
                        max="360"
                        placeholder="Ex: 120"
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
              </div>
            )}
          </div>

          {/* Recurring Transaction Options */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="recurring" className="text-base font-semibold cursor-pointer">
                    Transação Recorrente
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Crie transações que se repetem automaticamente
                </p>
              </div>
              <Switch
                id="recurring"
                checked={formData.isRecurring}
                disabled={formData.isInstallment || formData.isFixed}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    isRecurring: checked,
                  }))
                }
                className="mt-1 data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-primary/50"
              />
            </div>

            {formData.isRecurring && (
              <div className="space-y-4 pt-2 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="recurrenceType">Frequência</Label>
                  <Select
                    value={formData.recurrenceType}
                    onValueChange={(value: "daily" | "weekly" | "monthly" | "yearly") =>
                      setFormData((prev) => ({ ...prev, recurrenceType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrenceEndDate">Data de Término</Label>
                  <Input
                    id="recurrenceEndDate"
                    type="date"
                    value={formData.recurrenceEndDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))
                    }
                    min={getTodayString()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional - deixe em branco para recorrência indefinida
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Transaction Option */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="fixed" className="text-base font-semibold cursor-pointer">
                    Transação Fixa
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receitas ou despesas que se repetem todo mês, sem data de término (ex: salário, aluguel)
                </p>
              </div>
              <Switch
                id="fixed"
                checked={formData.isFixed}
                disabled={formData.isInstallment || formData.isRecurring}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    isFixed: checked,
                  }))
                }
                className="mt-1 data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-primary/50"
              />
            </div>

            {formData.isFixed && (
              <div className="space-y-2 pt-2 animate-fade-in">
                <p className="text-sm text-muted-foreground">
                  Esta transação será criada automaticamente todo dia {new Date(formData.date).getDate()} de cada mês.
                </p>
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
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}