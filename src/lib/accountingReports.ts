import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { formatCurrency } from "./formatters";

// Interfaces
export interface DREReport {
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  revenueByCategory: Array<{ category: string; amount: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
}

export interface BalanceSheetReport {
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  currentAssets: Array<{ account: string; balance: number }>;
  investments: Array<{ account: string; balance: number }>;
  currentLiabilities: Array<{ account: string; balance: number }>;
  totalCurrentAssets: number;
  totalInvestments: number;
  totalCurrentLiabilities: number;
}

export interface CashFlowReport {
  openingBalance: number;
  inflows: number;
  outflows: number;
  operatingActivities: number;
  investmentActivities: number;
  netCashFlow: number;
  closingBalance: number;
}

// Gerar DRE (Demonstração do Resultado do Exercício)
export function generateDRE(
  transactions: any[],
  categories: any[],
  _startDate: Date,
  _endDate: Date
): DREReport {
  // Receitas
  const revenueTransactions = transactions.filter((t) => t.type === "income");
  const totalRevenue = revenueTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Agrupar receitas por categoria
  const revenueByCategory = categories
    .filter((c) => c.type === "income" || c.type === "both")
    .map((category) => ({
      category: category.name,
      amount: revenueTransactions
        .filter((t) => t.category_id === category.id)
        .reduce((sum, t) => sum + t.amount, 0),
    }))
    .filter((item) => item.amount > 0);

  // Despesas
  const expenseTransactions = transactions.filter((t) => t.type === "expense");
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Agrupar despesas por categoria
  const expensesByCategory = categories
    .filter((c) => c.type === "expense" || c.type === "both")
    .map((category) => ({
      category: category.name,
      amount: expenseTransactions
        .filter((t) => t.category_id === category.id)
        .reduce((sum, t) => sum + t.amount, 0),
    }))
    .filter((item) => item.amount < 0);

  // Resultado Líquido
  const netResult = totalRevenue + totalExpenses;

  return {
    totalRevenue,
    totalExpenses,
    netResult,
    revenueByCategory,
    expensesByCategory,
  };
}

// Gerar Balanço Patrimonial
export function generateBalanceSheet(
  accounts: any[],
  _transactions: any[],
  _referenceDate: Date
): BalanceSheetReport {
  // Ativo Circulante (checking e savings com saldo positivo)
  const currentAssets = accounts
    .filter((a) => (a.type === "checking" || a.type === "savings") && a.balance >= 0)
    .map((account) => ({
      account: account.name,
      balance: account.balance,
    }));

  const totalCurrentAssets = currentAssets.reduce((sum, item) => sum + item.balance, 0);

  // Investimentos
  const investments = accounts
    .filter((a) => a.type === "investment")
    .map((account) => ({
      account: account.name,
      balance: account.balance,
    }));

  const totalInvestments = investments.reduce((sum, item) => sum + item.balance, 0);

  // Passivo Circulante (cartões de crédito com dívida)
  const currentLiabilities = accounts
    .filter((a) => a.type === "credit" && a.balance < 0)
    .map((account) => ({
      account: account.name,
      balance: account.balance,
    }));

  const totalCurrentLiabilities = currentLiabilities.reduce((sum, item) => sum + item.balance, 0);

  // Total de Ativos e Passivos
  const totalAssets = totalCurrentAssets + totalInvestments;
  const totalLiabilities = totalCurrentLiabilities;

  // Patrimônio Líquido (Ativos - Passivos)
  const equity = totalAssets + totalLiabilities; // totalLiabilities é negativo

  return {
    totalAssets,
    totalLiabilities,
    equity,
    currentAssets,
    investments,
    currentLiabilities,
    totalCurrentAssets,
    totalInvestments,
    totalCurrentLiabilities,
  };
}

// Gerar Fluxo de Caixa
export function generateCashFlow(
  transactions: any[],
  accounts: any[],
  startDate: Date,
  endDate: Date
): CashFlowReport {
  // Calcular saldo inicial (contas operacionais no início do período)
  const operationalAccounts = accounts.filter(
    (a) => a.type === "checking" || a.type === "savings"
  );

  // Saldo inicial = saldo atual - transações do período
  const periodTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= startDate && date <= endDate;
  });

  const periodChange = periodTransactions
    .filter((t) => 
      operationalAccounts.some((a) => a.id === t.account_id) && 
      t.type !== "transfer"
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = operationalAccounts.reduce((sum, a) => sum + a.balance, 0);
  const openingBalance = currentBalance - periodChange;

  // Entradas de Caixa (receitas)
  const inflows = periodTransactions
    .filter((t) => t.type === "income" && operationalAccounts.some((a) => a.id === t.account_id))
    .reduce((sum, t) => sum + t.amount, 0);

  // Saídas de Caixa (despesas)
  const outflows = periodTransactions
    .filter((t) => t.type === "expense" && operationalAccounts.some((a) => a.id === t.account_id))
    .reduce((sum, t) => sum + t.amount, 0);

  // Atividades Operacionais
  const operatingActivities = inflows + outflows;

  // Atividades de Investimento (transferências para/de contas de investimento)
  const investmentAccounts = accounts.filter((a) => a.type === "investment");
  const investmentActivities = periodTransactions
    .filter((t) => 
      t.type === "transfer" && 
      (investmentAccounts.some((a) => a.id === t.account_id) ||
       investmentAccounts.some((a) => a.id === t.to_account_id))
    )
    .reduce((sum, t) => {
      // Se é uma transferência PARA investimento, é saída (negativo)
      // Se é uma transferência DE investimento, é entrada (positivo)
      if (investmentAccounts.some((a) => a.id === t.to_account_id)) {
        return sum + t.amount; // amount já é negativo para expense
      } else {
        return sum - t.amount; // inverter o sinal
      }
    }, 0);

  // Fluxo de Caixa Líquido
  const netCashFlow = operatingActivities + investmentActivities;

  // Saldo Final
  const closingBalance = openingBalance + netCashFlow;

  return {
    openingBalance,
    inflows,
    outflows,
    operatingActivities,
    investmentActivities,
    netCashFlow,
    closingBalance,
  };
}

// Exportar relatório para PDF
export function exportReportToPDF(
  reportType: "dre" | "balance" | "cashflow",
  reportData: any,
  startDate: Date,
  endDate: Date,
  t: any
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Título
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const title = {
    dre: t("reports.dre"),
    balance: t("reports.balanceSheet"),
    cashflow: t("reports.cashFlow"),
  }[reportType];
  doc.text(title, pageWidth / 2, yPos, { align: "center" });

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const period =
    reportType === "balance"
      ? `${t("reports.positionAt")} ${format(endDate, "dd/MM/yyyy")}`
      : `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`;
  doc.text(period, pageWidth / 2, yPos, { align: "center" });

  yPos += 15;

  // Conteúdo específico de cada relatório
  if (reportType === "dre") {
    exportDREtoPDF(doc, reportData, yPos, t);
  } else if (reportType === "balance") {
    exportBalanceSheetToPDF(doc, reportData, yPos, t);
  } else if (reportType === "cashflow") {
    exportCashFlowToPDF(doc, reportData, yPos, t);
  }

  // Salvar
  const filename = `${title.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

function exportDREtoPDF(doc: jsPDF, data: DREReport, startY: number, t: any) {
  let y = startY;

  // Receitas
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.revenue"), 20, y);
  doc.text(formatCurrency(data.totalRevenue), 170, y, { align: "right" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  data.revenueByCategory.forEach((item) => {
    doc.text(`  ${item.category}`, 25, y);
    doc.text(formatCurrency(item.amount), 170, y, { align: "right" });
    y += 5;
  });

  y += 5;

  // Despesas
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.expenses"), 20, y);
  doc.text(formatCurrency(Math.abs(data.totalExpenses)), 170, y, { align: "right" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  data.expensesByCategory.forEach((item) => {
    doc.text(`  ${item.category}`, 25, y);
    doc.text(formatCurrency(Math.abs(item.amount)), 170, y, { align: "right" });
    y += 5;
  });

  y += 10;

  // Resultado Líquido
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.netResult"), 20, y);
  doc.text(formatCurrency(data.netResult), 170, y, { align: "right" });
}

function exportBalanceSheetToPDF(doc: jsPDF, data: BalanceSheetReport, startY: number, t: any) {
  let y = startY;

  // Ativo
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.assets"), 20, y);
  doc.text(formatCurrency(data.totalAssets), 90, y, { align: "right" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.currentAssets"), 25, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  data.currentAssets.forEach((item) => {
    doc.text(`  ${item.account}`, 30, y);
    doc.text(formatCurrency(item.balance), 90, y, { align: "right" });
    y += 5;
  });

  if (data.investments.length > 0) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.text(t("reports.investments"), 25, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    data.investments.forEach((item) => {
      doc.text(`  ${item.account}`, 30, y);
      doc.text(formatCurrency(item.balance), 90, y, { align: "right" });
      y += 5;
    });
  }

  y += 5;

  // Passivo
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.liabilities"), 110, startY);
  doc.text(formatCurrency(Math.abs(data.totalLiabilities)), 180, startY, { align: "right" });

  let yPassive = startY + 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.currentLiabilities"), 115, yPassive);
  yPassive += 5;

  doc.setFont("helvetica", "normal");
  data.currentLiabilities.forEach((item) => {
    doc.text(`  ${item.account}`, 120, yPassive);
    doc.text(formatCurrency(Math.abs(item.balance)), 180, yPassive, { align: "right" });
    yPassive += 5;
  });

  const maxY = Math.max(y, yPassive) + 10;

  // Patrimônio Líquido
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.equity"), 20, maxY);
  doc.text(formatCurrency(data.equity), 180, maxY, { align: "right" });
}

function exportCashFlowToPDF(doc: jsPDF, data: CashFlowReport, startY: number, t: any) {
  let y = startY;

  // Saldo Inicial
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.openingBalance"), 20, y);
  doc.text(formatCurrency(data.openingBalance), 170, y, { align: "right" });
  y += 10;

  // Atividades Operacionais
  doc.setFontSize(12);
  doc.text(t("reports.operatingActivities"), 20, y);
  doc.text(formatCurrency(data.operatingActivities), 170, y, { align: "right" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`  ${t("reports.cashInflows")}`, 25, y);
  doc.text(formatCurrency(data.inflows), 170, y, { align: "right" });
  y += 5;

  doc.text(`  ${t("reports.cashOutflows")}`, 25, y);
  doc.text(formatCurrency(Math.abs(data.outflows)), 170, y, { align: "right" });
  y += 8;

  // Atividades de Investimento
  if (data.investmentActivities !== 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(t("reports.investmentActivities"), 20, y);
    doc.text(formatCurrency(data.investmentActivities), 170, y, { align: "right" });
    y += 10;
  }

  y += 5;

  // Fluxo de Caixa Líquido
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(t("reports.netCashFlow"), 20, y);
  doc.text(formatCurrency(data.netCashFlow), 170, y, { align: "right" });
  y += 10;

  // Saldo Final
  doc.setFontSize(14);
  doc.text(t("reports.closingBalance"), 20, y);
  doc.text(formatCurrency(data.closingBalance), 170, y, { align: "right" });
}
