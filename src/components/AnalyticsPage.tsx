import { createDateFromString } from "@/lib/dateUtils";

import { useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar as CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useChartResponsive } from "@/hooks/useChartResponsive";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  formatCurrencyForAxis,
  getBarChartAxisProps,
  getComposedChartMargins,
} from "@/lib/chartUtils";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  isSameMonth,
  isSameYear,
  format,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
  limit_amount?: number;
  due_date?: number;
  closing_date?: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date | string;
  type: "income" | "expense" | "transfer";
  category: string;
  category_id?: string;
  accountId?: string;
  account_id?: string;
  status: "pending" | "completed";
  to_account_id?: string;
}

interface AnalyticsPageProps {
  transactions: Transaction[];
  accounts: Account[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
];
// Cor de fallback caso uma categoria não tenha cor definida
const FALLBACK_COLOR = "#8884d8";

export default function AnalyticsPage({
  transactions,
  accounts,
}: AnalyticsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "income" | "expense" | "transfer"
  >("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "completed"
  >("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "current_month" | "month_picker" | "custom"
  >("all");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    undefined
  );
  const { toast } = useToast();
  const {
    chartConfig: responsiveConfig,
    isMobile,
  } = useChartResponsive();
  const { categories } = useCategories();

  const [categoryChartType, setCategoryChartType] = useState<
    "expense" | "income"
  >("expense");
  
  const contentRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value); // Esta função espera o valor em REAIS
  };

  const getTransactionAccountId = (transaction: Transaction) => {
    return transaction.account_id || transaction.accountId || "";
  };

  const getTransactionCategory = (transaction: Transaction) => {
    // Check if it's a transfer
    if (transaction.type === "transfer" || transaction.to_account_id) {
      return "Transferência";
    }

    // Prioritize category_id for more reliable mapping
    if (transaction.category_id) {
      const category = categories.find(
        (cat) => cat.id === transaction.category_id
      );
      return category?.name || "Sem categoria";
    }

    // Fallback to transaction.category if it exists and is not an ID-like string
    if (
      transaction.category &&
      typeof transaction.category === "string" &&
      !transaction.category.match(/^[0-9a-f-]{36}$/i)
    ) {
      return transaction.category;
    }

    return "Sem categoria";
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const transactionDate =
        typeof transaction.date === "string"
          ? createDateFromString(transaction.date)
          : transaction.date;

      const matchesSearch =
        !searchTerm ||
        transaction.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        getTransactionCategory(transaction)
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type === filterType;
      const matchesAccount =
        filterAccount === "all" ||
        getTransactionAccountId(transaction) === filterAccount;
      const matchesCategory =
        filterCategory === "all" ||
        transaction.category_id === filterCategory;
      const matchesStatus =
        filterStatus === "all" || transaction.status === filterStatus;

      let matchesPeriod = true;
      if (dateFilter === "current_month") {
        matchesPeriod =
          isSameMonth(transactionDate, new Date()) &&
          isSameYear(transactionDate, new Date());
      } else if (dateFilter === "month_picker") {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        matchesPeriod = isWithinInterval(transactionDate, { start, end });
      } else if (dateFilter === "custom" && customStartDate && customEndDate) {
        matchesPeriod =
          transactionDate >= customStartDate && transactionDate <= customEndDate;
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesAccount &&
        matchesCategory &&
        matchesStatus &&
        matchesPeriod
      );
    });
  }, [
    transactions,
    searchTerm,
    filterType,
    filterAccount,
    filterCategory,
    filterStatus,
    dateFilter,
    selectedMonth,
    customStartDate,
    customEndDate,
    categories,
  ]);

  const categoryData = useMemo(() => {
    const typeFilteredTransactions = filteredTransactions.filter(
      (t) => t.type === categoryChartType
    );

    const categoryFilteredTransactions = typeFilteredTransactions.filter((t) => {
      const category = getTransactionCategory(t);
      return category !== "Pagamento de Fatura";
    });

    if (categoryFilteredTransactions.length === 0) {
      return [];
    }

    // 1. LÓGICA DE AGRUPAMENTO ATUALIZADA PARA USAR A COR DA CATEGORIA
    const categoryTotals = categoryFilteredTransactions.reduce(
      (acc, transaction) => {
        // Encontra a categoria real a partir do ID
        const categoryObj = categories.find(
          (c) => c.id === transaction.category_id
        );
        // Usa o nome da categoria encontrada, ou um fallback
        const categoryName = categoryObj?.name || "Sem categoria";
        // Usa a cor da categoria encontrada, ou um fallback
        const categoryColor = categoryObj?.color || FALLBACK_COLOR;

        if (!acc[categoryName]) {
          acc[categoryName] = { amount: 0, color: categoryColor };
        }
        // CORREÇÃO: Usar o valor absoluto para despesas, pois o gráfico de pizza
        // não lida com valores negativos. O valor original é negativo.
        const value = categoryChartType === 'expense' ? Math.abs(transaction.amount) : transaction.amount;
        acc[categoryName].amount += value;

        return acc;
      },
      {} as Record<string, { amount: number; color: string }>
    );

    const totalAmount = Object.values(categoryTotals).reduce(
      (sum, data) => sum + data.amount,
      0
    );

    const report = Object.entries(categoryTotals)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        color: data.color, // Passa a cor da categoria para o relatório
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
        transactions: categoryFilteredTransactions.filter(
          (t) => getTransactionCategory(t) === category
        ).length,
      }))
      .sort((a, b) => b.amount - a.amount);

    return report.map((item, index) => ({
      ...item,
      // Define o 'fill' com a cor da categoria
      fill: item.color || COLORS[index % COLORS.length], // Fallback para cores padrão
    }));
  }, [filteredTransactions, categoryChartType, categories]);

  const monthlyData = useMemo(() => {
    // O gráfico agora obedece aos filtros da página.
    // Usamos 'filteredTransactions' em vez de 'transactions'.
    const monthlyTotals = filteredTransactions.reduce((acc, transaction) => {
      const transactionDate =
        typeof transaction.date === "string"
          ? createDateFromString(transaction.date)
          : transaction.date;
      const monthKey = format(transactionDate, "yyyy-MM");

      if (!acc[monthKey]) {
        acc[monthKey] = { income: 0, expenses: 0 };
      }

      if (transaction.type === "income") {
        acc[monthKey].income += transaction.amount;
      } else if (transaction.type === "expense") {
        acc[monthKey].expenses += transaction.amount;
      }

      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);

    const sortedEntries = Object.entries(monthlyTotals).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    let saldoAcumulado = 0;

    const sortedMonths = sortedEntries.map(([monthKey, data]) => {
      const saldoMensal = data.income + data.expenses; // expenses já são negativas
      saldoAcumulado += saldoMensal;
      const [year, month] = monthKey
        .split("-")
        .map((num) => parseInt(num, 10));

      return {
        month: format(new Date(year, month - 1, 1), "MMM/yy", {
          locale: ptBR,
        }),
        receitas: data.income,
        despesas: Math.abs(data.expenses), // Exibir despesas como valor positivo para comparação
        saldo: saldoAcumulado,
      };
    });

    return sortedMonths;
  }, [filteredTransactions]);

  const totalsByType = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else if (transaction.type === "expense") {
          acc.expenses += transaction.amount;
        }
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [filteredTransactions]);

  const accountBalanceData = useMemo(() => {
    return accounts
      .filter((acc) => acc.type !== "credit")
      .map((account) => ({
        name: account.name.split(" - ")[0] || account.name,
        balance: account.balance,
        type: account.type,
        color: account.color || "hsl(var(--primary))",
      }));
  }, [accounts]);

  // Chart config específico para o gráfico de saldos de contas
  const accountChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    accountBalanceData.forEach((account) => {
      config[account.name] = {
        label: account.name,
        color: account.color,
      };
    });
    return config;
  }, [accountBalanceData]);

  const handleExportPDF = async () => {
    if (!contentRef.current) {
      toast({
        title: "Erro",
        description: "Conteúdo não encontrado para exportação.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto preparamos o relatório completo.",
    });

    try {
      // Scroll to top and force resize
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("resize"));
      
      // Wait longer for charts to render
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Relatório de Análises Financeiras", pageWidth / 2, 15, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2,
        22,
        { align: "center" }
      );

      let currentY = 30;

      // Capture all sections
      const sections = contentRef.current.querySelectorAll(".analytics-section");
      
      console.log("Sections found:", sections.length);
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        
        console.log(`Section ${i}: ${section.offsetWidth}x${section.offsetHeight}`);
        
        // Skip invisible sections
        if (section.offsetWidth === 0 || section.offsetHeight === 0) {
          console.log(`Skipping section ${i} (no size)`);
          continue;
        }
        
        // Capture section as image with simpler config
        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: true,
          backgroundColor: "#ffffff",
          removeContainer: false,
        });

        console.log(`Canvas ${i}: ${canvas.width}x${canvas.height}`);

        if (canvas.width === 0 || canvas.height === 0) {
          console.log(`Skipping section ${i} (invalid canvas)`);
          continue;
        }

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Add new page if needed
        if (currentY + imgHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        // Add image to PDF
        pdf.addImage(imgData, "PNG", margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 5;
      }

      // Save PDF
      const periodLabel =
        dateFilter === "current_month"
          ? format(new Date(), "MMMM-yyyy", { locale: ptBR })
          : dateFilter === "month_picker"
          ? format(selectedMonth, "MMMM-yyyy", { locale: ptBR })
          : "completo";
      
      pdf.save(`relatorio-analises-${periodLabel}.pdf`);

      toast({
        title: "Relatório exportado",
        description: "O arquivo PDF foi baixado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const chartConfig = {
    receitas: {
      label: "Receitas",
      color: "hsl(var(--success))",
    },
    despesas: {
      label: "Despesas",
      color: "hsl(var(--destructive))",
    },
    saldo: {
      label: "Saldo",
      color: "hsl(var(--primary))",
    },
  };

  // Chart config específico para o gráfico de categorias
  const categoryChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    categoryData.forEach((item, index) => {
      config[item.category] = {
        label: item.category,
        color: item.fill || COLORS[index % COLORS.length],
      };
    });
    return config;
  }, [categoryData]);

  // Funções para navegação de mês
  const goToPreviousMonth = () => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  return (
    <div ref={contentRef} className="spacing-responsive-lg fade-in">{/*  Header */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0 w-full">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">Análises</h1>
          <p className="text-sm text-muted-foreground leading-tight">
            Relatórios e gráficos financeiros detalhados
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 w-full md:grid-cols-1 lg:flex lg:flex-nowrap lg:gap-2 lg:w-auto lg:ml-auto">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="gap-2 apple-interaction h-9 text-xs sm:text-sm"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Exportar PDF</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="search" className="text-caption">Buscar transações</label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Digite para buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-type" className="text-caption">Tipo</label>
              <Select
                value={filterType}
                onValueChange={(value: any) => setFilterType(value)}
              >
                <SelectTrigger id="filter-type" className="touch-target mt-2">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                  <SelectItem value="transfer">Transferências</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="filter-account" className="text-caption">Conta</label>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger id="filter-account" className="touch-target mt-2">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="filter-category" className="text-caption">Categoria</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="filter-category" className="touch-target mt-2">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: category.color || "#6b7280",
                          }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="filter-status" className="text-caption">Status</label>
              <Select
                value={filterStatus}
                onValueChange={(value: any) => setFilterStatus(value)}
              >
                <SelectTrigger id="filter-status" className="touch-target mt-2">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="filter-date" className="text-caption">Período</label>
              <Select
                value={dateFilter}
                onValueChange={(
                  value: "all" | "current_month" | "month_picker" | "custom"
                ) => setDateFilter(value)}
              >
                <SelectTrigger id="filter-date" className="touch-target mt-2">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="current_month">Mês Atual</SelectItem>
                  <SelectItem value="month_picker">Navegar por Mês</SelectItem>
                  <SelectItem value="custom">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {dateFilter === "month_picker" && (
            <div className="mt-4">
              <label className="text-caption">Selecionar mês</label>
              <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousMonth}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex-1 text-center text-sm font-medium min-w-[100px]">
                  {format(selectedMonth, "MMM/yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextMonth}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-caption">Data início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate
                        ? format(customStartDate, "dd/MM/yyyy")
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-caption">Data fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-2",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate
                        ? format(customEndDate, "dd/MM/yyyy")
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="analytics-section grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        <Card className="financial-card">
          <CardContent className="p-3 overflow-hidden">
            <div className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-1 items-center">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center col-start-1 row-span-2">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="col-start-2">
                <p className="text-sm font-semibold">Receitas</p>
                <p className="text-xs text-muted-foreground">Período Filtrado</p>
              </div>
              <div className="col-start-2 text-responsive-xl font-bold balance-positive leading-tight truncate max-w-full">
                {formatCurrency(totalsByType.income / 100)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3 overflow-hidden">
            <div className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-1 items-center">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center col-start-1 row-span-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="col-start-2">
                <p className="text-sm font-semibold">Despesas</p>
                <p className="text-xs text-muted-foreground">Período Filtrado</p>
              </div>
              <div className="col-start-2 text-responsive-xl font-bold balance-negative leading-tight truncate max-w-full">
                {formatCurrency(totalsByType.expenses / 100)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardContent className="p-3 overflow-hidden">
            <div className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-1 items-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center col-start-1 row-span-2">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="col-start-2">
                <p className="text-sm font-semibold">Saldo Líquido</p>
                <p className="text-xs text-muted-foreground">Período Filtrado</p>
              </div>
              <div className={`col-start-2 text-responsive-xl font-bold leading-tight truncate max-w-full ${
                totalsByType.income - totalsByType.expenses >= 0 ? "balance-positive" : "balance-negative"
              }`}>
                {formatCurrency((totalsByType.income - totalsByType.expenses) / 100)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="analytics-section grid grid-cols-1 gap-3 sm:gap-4 mt-6">
        {/* Category Pie Chart */}
        <Card className="financial-card">
          {/* 2. BOTÕES DE ALTERNÂNCIA ATUALIZADOS COM CORES */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4 sm:pt-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-medium">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5" />
              {categoryChartType === "income" ? "Receitas" : "Despesas"} por
              Categoria
            </CardTitle>

            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                size="sm"
                variant={
                  categoryChartType === "expense" ? "destructive" : "ghost"
                }
                onClick={() => setCategoryChartType("expense")}
                className="h-6 px-2 text-xs sm:h-7 sm:px-3"
              >
                Despesas
              </Button>
              <Button
                size="sm"
                variant={categoryChartType === "income" ? "default" : "ghost"}
                onClick={() => setCategoryChartType("income")}
                className={cn(
                  "h-6 px-2 text-xs sm:h-7 sm:px-3",
                  categoryChartType === "income" &&
                    "bg-success text-success-foreground hover:bg-success/90"
                )}
              >
                Receitas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer
              config={categoryChartConfig}
              className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}
            >
              <RechartsPieChart width={undefined} height={undefined}>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value / 100),
                    name,
                  ]}
                />
                <Pie
                  data={categoryData.map((item) => ({
                    ...item,
                    name: item.category,
                    value: item.amount,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={
                    responsiveConfig.showLabels && categoryData.length <= 6
                      ? ({ name, percentage }: any) =>
                          `${name}: ${percentage.toFixed(1)}%`
                      : false
                  }
                  outerRadius={responsiveConfig.outerRadius}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    // A cor agora vem de 'entry.fill', que definimos
                    // com a cor da categoria no 'useMemo'
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {responsiveConfig.showLegend && categoryData.length > 0 && (
                  <ChartLegend
                    content={<ChartLegendContent />}
                    wrapperStyle={{
                      paddingTop: responsiveConfig.showLabels ? "10px" : "20px",
                    }}
                    iconType="circle"
                  />
                )}
              </RechartsPieChart>
            </ChartContainer>
            {categoryData.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma transação encontrada para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Balances */}
        <Card className="financial-card">
          <CardHeader className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              Saldos por Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer
              config={accountChartConfig}
              className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={accountBalanceData}
                  margin={getComposedChartMargins(responsiveConfig)}
                >
                  <XAxis
                    dataKey="name"
                    {...getBarChartAxisProps(responsiveConfig).xAxis}
                  />
                  <YAxis
                    tickFormatter={(value) =>
                      formatCurrencyForAxis(value / 100, isMobile)
                    }
                    {...getBarChartAxisProps(responsiveConfig).yAxis}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [
                      formatCurrency(value / 100),
                      "Saldo",
                    ]}
                  />
                  <Bar dataKey="balance">
                    {accountBalanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="financial-card">
          <CardHeader className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Evolução Mensal - Receitas vs Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer
              config={chartConfig}
              className={`${responsiveConfig.containerHeight} w-full overflow-hidden`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyData}
                  margin={getComposedChartMargins(responsiveConfig)}
                >
                  {/* Definições de gradientes */}
                  <defs>
                    <linearGradient
                      id="colorReceitas"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--success))"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--success))"
                        stopOpacity={0.3}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorDespesas"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--destructive))"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--destructive))"
                        stopOpacity={0.3}
                      />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="month"
                    {...getBarChartAxisProps(responsiveConfig).xAxis}
                  />
                  <YAxis
                    tickFormatter={(value) =>
                      formatCurrencyForAxis(value / 100, isMobile)
                    }
                    {...getBarChartAxisProps(responsiveConfig).yAxis}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value / 100),
                      name === "receitas"
                        ? "Receitas"
                        : name === "despesas"
                        ? "Despesas"
                        : name === "saldo"
                        ? "Saldo Acumulado"
                        : name,
                    ]}
                    labelFormatter={(label) => `Mês de ${label}`}
                  />

                  {/* Legenda apenas no desktop */}
                  {!isMobile && (
                    <ChartLegend
                      content={
                        <ChartLegendContent className="flex justify-center gap-6" />
                      }
                      verticalAlign="top"
                    />
                  )}

                  {/* Barras de Receitas com gradiente */}
                  <Bar
                    dataKey="receitas"
                    fill="url(#colorReceitas)"
                    radius={[4, 4, 0, 0]}
                    name="Receitas"
                  />

                  {/* Barras de Despesas com gradiente */}
                  <Bar
                    dataKey="despesas"
                    fill="url(#colorDespesas)"
                    radius={[4, 4, 0, 0]}
                    name="Despesas"
                  />

                  {/* Linha de saldo com pontos condicionais */}
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="hsl(var(--primary))"
                    strokeWidth={isMobile ? 2 : 3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const saldo = payload?.saldo || 0;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isMobile ? 3 : 4}
                          fill={
                            saldo >= 0
                              ? "hsl(var(--primary))"
                              : "hsl(var(--destructive))"
                          }
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{
                      r: isMobile ? 5 : 6,
                      strokeWidth: 2,
                      fill: "hsl(var(--primary))",
                      stroke: "hsl(var(--background))",
                    }}
                    connectNulls={false}
                    name="Saldo Acumulado"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Indicadores visuais no mobile */}
            {isMobile && monthlyData.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="flex items-center gap-1 justify-center">
                  <div className="w-3 h-3 rounded bg-success flex-shrink-0"></div>
                  <span className="text-muted-foreground truncate">Receitas</span>
                </div>
                <div className="flex items-center gap-1 justify-center">
                  <div className="w-3 h-3 rounded bg-destructive flex-shrink-0"></div>
                  <span className="text-muted-foreground truncate">Despesas</span>
                </div>
                <div className="flex items-center gap-1 justify-center">
                  <div className="w-3 h-0.5 bg-primary flex-shrink-0"></div>
                  <span className="text-muted-foreground truncate">Saldo</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Details Table */}
      <Card className="financial-card">
        <CardHeader>
          <CardTitle className="text-sm sm:text-base">
            <span className="block sm:hidden">
              Detalhes -{" "}
              {categoryChartType === "income" ? "Receitas" : "Despesas"}
            </span>
            <span className="hidden sm:block">
              Detalhes por Categoria -{" "}
              {categoryChartType === "income" ? "Receitas" : "Despesas"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Nenhuma transação encontrada para o período selecionado
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs sm:text-sm">
                      Categoria
                    </th>
                    <th className="text-right py-2 text-xs sm:text-sm">
                      Valor
                    </th>
                    <th className="text-right py-2 text-xs sm:text-sm hidden sm:table-cell">
                      %
                    </th>
                    <th className="text-right py-2 text-xs sm:text-sm hidden md:table-cell">
                      Qtd
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((item) => (
                    <tr key={item.category} className="border-b last:border-b-0">
                      <td className="py-2 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                            {item.category}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-2 sm:py-3 font-medium text-xs sm:text-sm">
                        <div className="flex flex-col sm:block">
                          <span>{formatCurrency(item.amount / 100)}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {item.percentage.toFixed(1)}% • {item.transactions}x
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-2 sm:py-3 text-xs sm:text-sm hidden sm:table-cell">
                        {item.percentage.toFixed(1)}%
                      </td>
                      <td className="text-right py-2 sm:py-3 text-xs sm:text-sm hidden md:table-cell">
                        {item.transactions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}