import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  Download,
  CalendarIcon,
  TrendingUp,
  TrendingDown,
  Scale,
  Waves,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { 
  generateDRE, 
  generateBalanceSheet, 
  generateCashFlow,
  exportReportToPDF 
} from "@/lib/accountingReports";

interface ReportsPageProps {
  transactions: any[];
  accounts: any[];
  categories: any[];
}

export function ReportsPage({
  transactions,
  accounts,
  categories,
}: ReportsPageProps) {
  const { t } = useTranslation();

  const [periodType, setPeriodType] = useState<"month" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  // Atualizar datas quando mudar o tipo de período
  const handlePeriodTypeChange = (type: "month" | "year" | "custom") => {
    setPeriodType(type);
    const now = new Date();
    if (type === "month") {
      setStartDate(startOfMonth(now));
      setEndDate(endOfMonth(now));
    } else if (type === "year") {
      setStartDate(startOfYear(now));
      setEndDate(endOfYear(now));
    }
  };

  // Filtrar transações pelo período
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = new Date(t.date);
      return date >= startDate && date <= endDate && t.status === "completed";
    });
  }, [transactions, startDate, endDate]);

  // Gerar relatórios
  const dreReport = useMemo(() => {
    return generateDRE(filteredTransactions, categories, startDate, endDate);
  }, [filteredTransactions, categories, startDate, endDate]);

  const balanceSheetReport = useMemo(() => {
    return generateBalanceSheet(accounts, filteredTransactions, endDate);
  }, [accounts, filteredTransactions, endDate]);

  const cashFlowReport = useMemo(() => {
    return generateCashFlow(filteredTransactions, accounts, startDate, endDate);
  }, [filteredTransactions, accounts, startDate, endDate]);

  // Exportar para PDF
  const handleExportPDF = (reportType: "dre" | "balance" | "cashflow") => {
    try {
      const reportData = {
        dre: dreReport,
        balance: balanceSheetReport,
        cashflow: cashFlowReport,
      }[reportType];

      exportReportToPDF(
        reportType,
        reportData,
        startDate,
        endDate,
        t
      );
    } catch (error) {
      logger.error("Error exporting PDF:", error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("reports.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
        </div>
      </div>

      {/* Filtros de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {t("reports.period")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo de Período */}
            <div className="space-y-2">
              <Label>{t("reports.periodType")}</Label>
              <Select value={periodType} onValueChange={(value: any) => handlePeriodTypeChange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{t("reports.currentMonth")}</SelectItem>
                  <SelectItem value="year">{t("reports.currentYear")}</SelectItem>
                  <SelectItem value="custom">{t("reports.customPeriod")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data Início */}
            <div className="space-y-2">
              <Label>{t("common.startDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Fim */}
            <div className="space-y-2">
              <Label>{t("common.endDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abas de Relatórios */}
      <Tabs defaultValue="dre" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dre" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("reports.dre")}
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            {t("reports.balanceSheet")}
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="flex items-center gap-2">
            <Waves className="w-4 h-4" />
            {t("reports.cashFlow")}
          </TabsTrigger>
        </TabsList>

        {/* DRE */}
        <TabsContent value="dre" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("reports.dre")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
                </p>
              </div>
              <Button onClick={() => handleExportPDF("dre")} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {t("common.exportPDF")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Receitas */}
              <div>
                <div className="flex items-center justify-between py-2 border-b-2 border-success/30 mb-3">
                  <h3 className="text-lg font-semibold text-success flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {t("reports.revenue")}
                  </h3>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(dreReport.totalRevenue)}
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  {dreReport.revenueByCategory.map((item) => (
                    <div key={item.category} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.category}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Despesas */}
              <div>
                <div className="flex items-center justify-between py-2 border-b-2 border-destructive/30 mb-3">
                  <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    {t("reports.expenses")}
                  </h3>
                  <span className="text-lg font-bold text-destructive">
                    {formatCurrency(Math.abs(dreReport.totalExpenses))}
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  {dreReport.expensesByCategory.map((item) => (
                    <div key={item.category} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.category}</span>
                      <span className="font-medium">{formatCurrency(Math.abs(item.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resultado */}
              <div className="pt-4 border-t-2 border-border">
                <div className="flex items-center justify-between py-3 bg-muted/50 px-4 rounded-lg">
                  <h3 className="text-xl font-bold">{t("reports.netResult")}</h3>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      dreReport.netResult >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatCurrency(dreReport.netResult)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balanço Patrimonial */}
        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("reports.balanceSheet")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("reports.positionAt")} {format(endDate, "dd/MM/yyyy")}
                </p>
              </div>
              <Button onClick={() => handleExportPDF("balance")} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {t("common.exportPDF")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ativo */}
                <div>
                  <div className="flex items-center justify-between py-2 border-b-2 border-primary/30 mb-3">
                    <h3 className="text-lg font-semibold text-primary">
                      {t("reports.assets")}
                    </h3>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(balanceSheetReport.totalAssets)}
                    </span>
                  </div>
                  
                  {/* Ativo Circulante */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2 ml-2">{t("reports.currentAssets")}</h4>
                    <div className="space-y-1 ml-6">
                      {balanceSheetReport.currentAssets.map((item) => (
                        <div key={item.account} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.account}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t mt-2">
                        <span>{t("reports.subtotal")}</span>
                        <span>{formatCurrency(balanceSheetReport.totalCurrentAssets)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Investimentos */}
                  {balanceSheetReport.investments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 ml-2">{t("reports.investments")}</h4>
                      <div className="space-y-1 ml-6">
                        {balanceSheetReport.investments.map((item) => (
                          <div key={item.account} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.account}</span>
                            <span className="font-medium">{formatCurrency(item.balance)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold pt-1 border-t mt-2">
                          <span>{t("reports.subtotal")}</span>
                          <span>{formatCurrency(balanceSheetReport.totalInvestments)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Passivo */}
                <div>
                  <div className="flex items-center justify-between py-2 border-b-2 border-warning/30 mb-3">
                    <h3 className="text-lg font-semibold text-warning">
                      {t("reports.liabilities")}
                    </h3>
                    <span className="text-lg font-bold text-warning">
                      {formatCurrency(Math.abs(balanceSheetReport.totalLiabilities))}
                    </span>
                  </div>
                  
                  {/* Passivo Circulante */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 ml-2">{t("reports.currentLiabilities")}</h4>
                    <div className="space-y-1 ml-6">
                      {balanceSheetReport.currentLiabilities.map((item) => (
                        <div key={item.account} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.account}</span>
                          <span className="font-medium">{formatCurrency(Math.abs(item.balance))}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t mt-2">
                        <span>{t("reports.subtotal")}</span>
                        <span>{formatCurrency(Math.abs(balanceSheetReport.totalCurrentLiabilities))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patrimônio Líquido */}
              <div className="pt-4 border-t-2 border-border">
                <div className="flex items-center justify-between py-3 bg-muted/50 px-4 rounded-lg">
                  <h3 className="text-xl font-bold">{t("reports.equity")}</h3>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      balanceSheetReport.equity >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatCurrency(balanceSheetReport.equity)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fluxo de Caixa */}
        <TabsContent value="cashflow" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("reports.cashFlow")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
                </p>
              </div>
              <Button onClick={() => handleExportPDF("cashflow")} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {t("common.exportPDF")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Saldo Inicial */}
              <div className="flex items-center justify-between py-3 bg-muted/30 px-4 rounded-lg">
                <h3 className="font-semibold">{t("reports.openingBalance")}</h3>
                <span className="font-bold">{formatCurrency(cashFlowReport.openingBalance)}</span>
              </div>

              {/* Atividades Operacionais */}
              <div>
                <div className="flex items-center justify-between py-2 border-b-2 border-primary/30 mb-3">
                  <h3 className="text-lg font-semibold">{t("reports.operatingActivities")}</h3>
                  <span className="text-lg font-bold">
                    {formatCurrency(cashFlowReport.operatingActivities)}
                  </span>
                </div>
                <div className="space-y-2 ml-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("reports.cashInflows")}</span>
                    <span className="font-medium text-success">{formatCurrency(cashFlowReport.inflows)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("reports.cashOutflows")}</span>
                    <span className="font-medium text-destructive">
                      {formatCurrency(Math.abs(cashFlowReport.outflows))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Atividades de Investimento */}
              {cashFlowReport.investmentActivities !== 0 && (
                <div>
                  <div className="flex items-center justify-between py-2 border-b-2 border-secondary/30 mb-3">
                    <h3 className="text-lg font-semibold">{t("reports.investmentActivities")}</h3>
                    <span className="text-lg font-bold">
                      {formatCurrency(cashFlowReport.investmentActivities)}
                    </span>
                  </div>
                </div>
              )}

              {/* Fluxo de Caixa Líquido */}
              <div className="pt-4 border-t-2 border-border">
                <div className="flex items-center justify-between py-3 bg-muted/50 px-4 rounded-lg mb-3">
                  <h3 className="text-xl font-bold">{t("reports.netCashFlow")}</h3>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      cashFlowReport.netCashFlow >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatCurrency(cashFlowReport.netCashFlow)}
                  </span>
                </div>

                {/* Saldo Final */}
                <div className="flex items-center justify-between py-3 bg-primary/10 px-4 rounded-lg">
                  <h3 className="text-xl font-bold">{t("reports.closingBalance")}</h3>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(cashFlowReport.closingBalance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
