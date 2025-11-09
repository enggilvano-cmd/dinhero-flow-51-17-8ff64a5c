import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { createDateFromString, getTodayString, addMonthsToDate } from "@/lib/dateUtils";
import { useCategories } from "@/hooks/useCategories";
// 1. IMPORTAR O COMPONENTE DE MOEDA CORRETO
import { CurrencyInput } from "@/components/forms/CurrencyInput";
// 2. REMOVER A IMPORTAÇÃO DA FUNÇÃO DE CONVERSÃO ANTIGA
// import { currencyStringToCents } from "@/lib/utils";

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
}

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction: (transaction: Omit<Transaction, "id" | "createdAt" | "currentInstallment" | "parentTransactionId">) => void;
  onAddInstallmentTransactions?: (transactions: Omit<Transaction, "id" | "createdAt">[]) => void; // Mantém a estrutura completa para parcelas
  accounts: Account[];
}


export function AddTransactionModal({ 
  open, 
  onOpenChange, 
  onAddTransaction, 
  onAddInstallmentTransactions,
  accounts 
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    description: "",
    // 3. ALTERAR O ESTADO 'amount' PARA NÚMERO (CENTAVOS)
    amount: 0, 
    date: getTodayString(),
    type: "" as "income" | "expense" | "transfer" | "",
    category_id: "",
    account_id: "",
    status: "completed" as "pending" | "completed",
    isInstallment: false,
    installments: "2" // Padrão de 2 se parcelado
  });
  const { toast } = useToast();
  const { categories } = useCategories();

  // Automatically set status based on transaction date
  useEffect(() => {
    if (formData.date) {
      const transactionDateStr = formData.date; // YYYY-MM-DD format
      const todayStr = getTodayString(); // YYYY-MM-DD format
      
      const newStatus = transactionDateStr <= todayStr ? "completed" : "pending";
      
      if (formData.status !== newStatus) {
        setFormData(prev => ({ ...prev, status: newStatus }));
      }
    }
  }, [formData.date]);

  const filteredCategories = useMemo(() => {
    if (!formData.type || formData.type === "transfer") return [];
    return categories.filter(
      (cat) => cat.type === formData.type || cat.type === "both"
    );
  }, [categories, formData.type]);

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
      installments: installmentsString
    } = formData;

    // 4. REMOVER A CONVERSÃO. O VALOR JÁ ESTÁ EM CENTAVOS.
    const numericAmount = formData.amount;
    console.log("DEBUG: Valor (em centavos) vindo do estado:", numericAmount);

    // Garantir que o valor convertido seja usado corretamente
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido maior que zero.",
        variant: "destructive"
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a descrição.",
        variant: "destructive"
      });
      return;
    }

    if (!type) {
      toast({
        title: "Erro",
        description: "Por favor, selecione o tipo de transação.",
        variant: "destructive"
      });
      return;
    }

    if (!category_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma categoria.",
        variant: "destructive"
      });
      return;
    }

    if (!account_id) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma conta.",
        variant: "destructive"
      });
      return;
    }

    const installments = parseInt(installmentsString);
    if (isInstallment && (isNaN(installments) || installments < 2 || installments > 60)) {
      toast({
        title: "Erro",
        description: "O número de parcelas deve ser entre 2 e 60.",
        variant: "destructive"
      });
      return;
    }

    const selectedAccount = accounts.find(acc => acc.id === account_id);
    if (!selectedAccount) {
      toast({ title: "Erro", description: "Conta selecionada não encontrada.", variant: "destructive" });
      return;
    }

    // ------ LÓGICA DE PARCELAMENTO CORRIGIDA ------

    try {
      if (isInstallment) {
        // Cenário 1: Parcelamento no Cartão de Crédito
        // Lógica: Lançar UMA transação pelo valor TOTAL para reconciliação
        if (selectedAccount.type === 'credit' && onAddTransaction) {
          
          const transaction = {
            description: `${description} (Compra Total em ${installments}x)`, // Descrição mais clara para o cartão
            amount: numericAmount, // Valor já está em centavos
            date: createDateFromString(date), // Já é um objeto Date
            type: type as "income" | "expense",
            category_id: category_id,
            account_id: account_id,
            status: status,
            installments: installments, // Metadata: total de parcelas
            currentInstallment: 1,      // Metadata: parcela atual
            parentTransactionId: crypto.randomUUID() // ID único para agrupar
          };

          // DEBUG: Log do objeto enviado
          console.log("DEBUG: Enviando (Cartão) para onAddTransaction", transaction);
          await onAddTransaction(transaction);

          toast({
            title: "Sucesso",
            description: `Transação (Cartão de Crédito) adicionada com sucesso!`,
            variant: "default"
          });

        } 
        // Cenário 2: Parcelamento em outra conta (ex: "Pix Parcelado")
        // Lógica: Lançar N transações futuras, com valor corrigido
        else if (selectedAccount.type !== 'credit' && onAddInstallmentTransactions) {
          
          // Lógica de arredondamento para evitar perda de centavos
          const baseInstallmentCents = Math.floor(numericAmount / installments);
          const remainderCents = numericAmount % installments;
          
          const transactions = [];
          const baseDate = createDateFromString(date);
          const parentId = crypto.randomUUID();
          const todayStr = getTodayString();

          for (let i = 0; i < installments; i++) {
            // Adiciona o resto na primeira parcela
            const installmentAmount = i === 0 ? (baseInstallmentCents + remainderCents) : baseInstallmentCents;
            const installmentDate = addMonthsToDate(baseDate, i);
            const installmentDateStr = installmentDate.toISOString().split('T')[0];
            
            // Status baseado na data da *parcela*
            const installmentStatus = installmentDateStr <= todayStr ? "completed" : "pending";

            const transaction = {
              description: `${description} (${i + 1}/${installments})`,
              amount: installmentAmount,
              date: installmentDate,
              type: type as "income" | "expense",
              category_id: category_id,
              account_id: account_id,
              status: installmentStatus as "completed" | "pending",
              installments: installments,
              currentInstallment: i + 1,
              parentTransactionId: parentId
            };
            transactions.push(transaction);
          }

          // DEBUG: Log do objeto enviado
          console.log("DEBUG: Enviando (Parcelas) para onAddInstallmentTransactions", transactions);
          await onAddInstallmentTransactions(transactions);

          toast({
            title: "Sucesso",
            description: `Transação dividida em ${installments}x adicionada com sucesso!`,
            variant: "default"
          });
        }
      } else {
        // Cenário 3: Transação Única (sem parcelamento)
        const transactionPayload = {
          description: description,
          amount: numericAmount, // Valor já está em centavos
          date: createDateFromString(date), // Passa o objeto Date diretamente
          type: type as "income" | "expense",
          category_id: category_id,
          account_id: account_id,
          status: status
        };
        
        // DEBUG: Log do objeto enviado
        console.log("DEBUG: Enviando (Única) para onAddTransaction", transactionPayload);
        await onAddTransaction(transactionPayload);

        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
          variant: "default"
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
        installments: "2"
      });
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating transaction(s):', error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Transação</DialogTitle>
          <DialogDescription>
            Registre uma nova receita ou despesa, com opção de parcelamento.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Compra no supermercado"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any, category_id: "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              {/* 5. SUBSTITUIR O INPUT PELO CURRENCYINPUT */}
              <CurrencyInput
                id="amount"
                value={formData.amount}
                onValueChange={(centsValue) => {
                  setFormData(prev => ({ ...prev, amount: centsValue }));
                }}
                className="h-10 sm:h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Categoria</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                <SelectTrigger disabled={!formData.type || formData.type === "transfer"}>
                  <SelectValue placeholder="Selecione" />
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
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_id">Conta</Label>
              <Select value={formData.account_id} onValueChange={(value) => setFormData(prev => ({ ...prev, account_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: account.color || "#6b7280" }}
                          />
                          {account.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as "pending" | "completed" }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Efetuada</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


          {/* Installment Options */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="installment">Transação Parcelada</Label>
                <p className="text-sm text-muted-foreground">
                  {/* CORREÇÃO: Texto dinâmico */}
                  {formData.account_id && accounts.find(acc => acc.id === formData.account_id)?.type === 'credit' 
                    ? "Lançar compra parcelada no cartão"
                    : "Dividir esta transação em parcelas mensais"
                  }
                </p>
              </div>
              <Switch
                id="installment"
                checked={formData.isInstallment}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ 
                    ...prev, 
                    isInstallment: checked
                  }))
                }
              />
            </div>

            {formData.isInstallment && (
              <div className="space-y-2">
                <Label htmlFor="installments">Número de Parcelas</Label>
                <Select 
                  value={formData.installments} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, installments: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 59 }, (_, i) => i + 2).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}x
                        {/* A prévia do valor da parcela só é exibida se for
                          um parcelamento que GERA N transações (não cartão).
                        */}
                        {(() => {
                          // CORREÇÃO: Usar formData.amount (que agora são centavos)
                          const numericAmount = formData.amount; 
                          return numericAmount > 0 && (formData.account_id && accounts.find(acc => acc.id === formData.account_id)?.type !== 'credit') ?
                            ` de ${new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format((numericAmount / 100) / (num || 1))}`
                            : ''
                        })()
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Adicionar Transação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}