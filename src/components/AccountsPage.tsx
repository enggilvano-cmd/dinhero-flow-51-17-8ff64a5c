import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CreditCard,
  PiggyBank,
  Wallet,
  MoreVertical,
  ArrowRight,
  DollarSign,
  TrendingUp,
  FileDown,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAccountStore } from "@/stores/AccountStore";
import { ImportAccountsModal } from "@/components/ImportAccountsModal";
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { useSettings } from "@/context/SettingsContext";

interface AccountsPageProps {
  onAddAccount: () => void;
  onEditAccount: (account: any) => void;
  onDeleteAccount: (accountId: string) => void;
  onPayCreditCard?: (account: any) => void;
  onTransfer?: () => void;
  onImportAccounts?: (accounts: any[], accountsToReplace: string[]) => void;
  initialFilterType?: "all" | "checking" | "savings" | "credit" | "investment";
}

export function AccountsPage({
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onPayCreditCard,
  onTransfer,
  onImportAccounts,
  initialFilterType = "all",
}: AccountsPageProps) {
  const accounts = useAccountStore((state) => state.accounts);
  const { t } = useTranslation();
  const { formatCurrency: formatCurrencyFromSettings } = useSettings();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "checking" | "savings" | "credit" | "investment"
  >(initialFilterType);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return formatCurrencyFromSettings(value);
  };

  const formatCents = (valueInCents: number) =>
    formatCurrency(valueInCents / 100);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "checking":
        return <Wallet className="h-5 w-5" />;
      case "savings":
        return <PiggyBank className="h-5 w-5" />;
      case "credit":
        return <CreditCard className="h-5 w-5" />;
      case "investment":
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "checking":
        return t('accounts.checking');
      case "savings":
        return t('accounts.savings');
      case "credit":
        return t('accounts.credit');
      case "investment":
        return t('accounts.investment');
      default:
        return type;
    }
  };

  const getAccountTypeBadge = (type: string) => {
    const variants = {
      checking: "default",
      savings: "secondary",
      credit: "destructive",
      investment: "secondary", // Corrigido de 'outline' para 'secondary'
    } as const;
    return variants[type as keyof typeof variants] || "default";
  };

  const filteredAccounts = accounts
    .filter((account) => {
      const matchesSearch = account.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || account.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );

  const handleDeleteAccount = (account: any) => {
    if (
      window.confirm(t('accounts.confirmDelete') + ` "${account.name}"?`)
    ) {
      onDeleteAccount(account.id);
      toast({
        title: t('accounts.accountDeleted'),
        description: t('accounts.accountDeletedDesc').replace('{name}', account.name),
      });
    }
  };

  // Os totais agora são calculados a partir das 'filteredAccounts'
  const totalBalance = filteredAccounts
    .filter((acc) => acc.type !== "credit")
    .reduce((sum, acc) => sum + acc.balance, 0);

  const creditUsed = filteredAccounts
    .filter((acc) => acc.type === "credit")
    .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);

  const exportToExcel = () => {
    const dataToExport = filteredAccounts.map((account) => ({
      [t('accounts.accountName')]: account.name,
      [t('accounts.accountType')]: getAccountTypeLabel(account.type),
      [t('accounts.balance')]: account.balance / 100, // Converter para Reais
      [t('accounts.limit')]: account.limit_amount ? account.limit_amount / 100 : 0,
      [t('accounts.closingDate')]: account.closing_date || '',
      [t('accounts.dueDate')]: account.due_date || '',
      [t('accounts.color')]: account.color,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('accounts.title'));

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

    // Formatar colunas de valores como moeda
    for (let i = 2; i <= dataToExport.length + 1; i++) {
      const saldoCell = `C${i}`;
      const limiteCell = `D${i}`;
      if (ws[saldoCell]) {
        ws[saldoCell].t = "n";
        ws[saldoCell].z = "R$ #,##0.00";
      }
      if (ws[limiteCell]) {
        ws[limiteCell].t = "n";
        ws[limiteCell].z = "R$ #,##0.00";
      }
    }

    let fileName = t('accounts.title').toLowerCase();
    if (filterType !== "all") fileName += `_${filterType}`;
    fileName += ".xlsx";

    XLSX.writeFile(wb, fileName);

    toast({
      title: t('common.success'),
      description: t('accounts.exportSuccess', { count: filteredAccounts.length }),
    });
  };

  const handleImportAccounts = (accountsToAdd: any[], accountsToReplaceIds: string[]) => {
    if (onImportAccounts) {
      onImportAccounts(accountsToAdd, accountsToReplaceIds);
    }
  };

  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0 w-full">
          <h1 className="text-system-h1 leading-tight">{t('accounts.title')}</h1>
          <p className="text-sm text-muted-foreground leading-tight">
            {t('accounts.subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:grid-cols-4 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button
            onClick={exportToExcel}
            variant="outline"
            className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
            disabled={accounts.length === 0}
          >
            <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t('common.export')}</span>
          </Button>
          <Button
            onClick={() => setImportModalOpen(true)}
            variant="outline"
            className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t('common.import')}</span>
          </Button>
          {onTransfer && (
            <Button
              onClick={onTransfer}
              variant="outline"
              className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
            >
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{t('dashboard.transfer')}</span>
            </Button>
          )}
          <Button onClick={onAddAccount} className="gap-2 apple-interaction h-9 text-xs sm:text-sm">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{t('accounts.addAccount')}</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards - Layout otimizado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('accounts.totalBalance')}
                </p>
                <div
                  className={`text-base sm:text-lg lg:text-xl font-bold ${
                    totalBalance >= 0 ? "balance-positive" : "balance-negative"
                  } leading-tight`}
                >
                  {formatCents(totalBalance)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('accounts.creditUsed')}
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold balance-negative leading-tight">
                  {formatCents(creditUsed)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('accounts.totalAccounts')}
                </p>
                <div className="text-base sm:text-lg lg:text-xl font-bold leading-tight">
                  {filteredAccounts.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search" className="text-caption">{t('common.search')} {t('accounts.title').toLowerCase()}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('accounts.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filter" className="text-caption">{t('accounts.filterByType')}</Label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger id="filter" className="touch-target mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="checking">{t('accounts.checking')}</SelectItem>
                  <SelectItem value="savings">{t('accounts.savings')}</SelectItem>
                  <SelectItem value="credit">{t('accounts.credit')}</SelectItem>
                  <SelectItem value="investment">{t('accounts.investment')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      {filteredAccounts.length === 0 ? (
        <Card className="financial-card">
          <CardContent className="text-center py-12">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || filterType !== "all"
                ? t('messages.noDataFound')
                : t('accounts.noAccounts')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== "all"
                ? t('common.filter')
                : t('accounts.addFirstAccount')}
            </p>
            {!searchTerm && filterType === "all" && (
              <Button onClick={onAddAccount}>{t('accounts.addAccount')}</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredAccounts.map((account) => (
            <Card
              key={account.id}
              className="financial-card apple-interaction group"
            >
              <CardContent className="p-3 sm:p-4">
                {/* Layout Mobile vs Desktop */}
                <div className="space-y-3">
                  {/* Header com Ícone, Nome e Menu */}
                  <div className="flex items-center gap-3">
                    {/* Ícone da Conta */}
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: account.color || "#6b7280" }}
                    >
                      {getAccountIcon(account.type)}
                    </div>

                    {/* Nome e Badge */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold truncate mb-1">
                        {account.name}
                      </h3>
                      <Badge
                        variant={getAccountTypeBadge(account.type)}
                        className="text-xs h-5 px-2 inline-flex"
                      >
                        {getAccountTypeLabel(account.type)}
                      </Badge>
                    </div>

                    {/* Menu de Ações */}
                    <div className="flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:opacity-70 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onEditAccount(account)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          {account.type === "credit" &&
                            account.balance < 0 &&
                            onPayCreditCard && (
                              <DropdownMenuItem
                                onClick={() => onPayCreditCard(account)}
                              >
                                <DollarSign className="h-4 w-4 mr-2" />
                                {t('accounts.payBill')}
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteAccount(account)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Saldo e Informações Financeiras */}
                  <div className="flex flex-col gap-2">
                    {/* Para cartões de crédito */}
                    {account.type === "credit" ? (
                      <>
                        {/* Dívida ou Crédito a favor */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                            {account.balance < 0 ? t('accounts.debt') : t('accounts.creditInFavor')}:
                          </span>
                          <span
                            className={`text-sm sm:text-base font-bold ${
                              account.balance < 0 ? "text-destructive" : "text-emerald-600"
                            }`}
                          >
                            {formatCents(Math.abs(account.balance))}
                          </span>
                        </div>
                        
                        {/* Limite disponível */}
                        {account.limit_amount && account.limit_amount > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {t('accounts.available')}:
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-blue-600">
                              {formatCents((account.limit_amount || 0) - Math.abs(Math.min(account.balance, 0)))}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      /* Outras contas: comportamento normal */
                      <>
                        {/* Saldo */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                            {t('accounts.balance')}:
                          </span>
                          <span
                            className={`text-sm sm:text-base font-bold ${
                              account.balance >= 0
                                ? "balance-positive"
                                : "balance-negative"
                            }`}
                          >
                            {formatCents(account.balance)}
                          </span>
                        </div>

                        {/* Disponível (com limite) */}
                        {account.limit_amount && account.limit_amount > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {t('accounts.available')}:
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-blue-600">
                              {formatCents(account.balance + (account.limit_amount || 0))}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Barra de progresso de uso */}
                    {account.limit_amount && account.limit_amount > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {account.type === "credit" ? t('accounts.used') : t('accounts.limit')}:
                          </span>
                          <span className="text-xs font-medium">
                            {formatCents(account.limit_amount || 0)}
                          </span>
                        </div>

                        {/* Barra de progresso */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                account.type === "credit"
                                  ? "bg-destructive"
                                  : "bg-warning"
                              }`}
                              style={{
                                width: `${Math.min(
                                  account.type === "credit"
                                    ? (Math.abs(Math.min(account.balance, 0)) /
                                        (account.limit_amount || 1)) *
                                      100
                                    : account.balance < 0
                                    ? (Math.abs(account.balance) /
                                        (account.limit_amount || 1)) *
                                      100
                                    : 0,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium">
                            {account.type === "credit"
                              ? `${Math.round(
                                  (Math.abs(Math.min(account.balance, 0)) /
                                    (account.limit_amount || 1)) *
                                    100
                                )}%`
                              : account.balance < 0
                              ? `${Math.round(
                                  (Math.abs(account.balance) /
                                    (account.limit_amount || 1)) *
                                    100
                                )}%`
                              : "0%"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Import Modal */}
      <ImportAccountsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        accounts={accounts}
        onImportAccounts={handleImportAccounts}
      />
    </div>
  );
}