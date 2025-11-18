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
// ATUALIZADO: Agora usa journal_entries ao invés de transactions
export function generateDRE(
  journalEntries: any[],
  chartOfAccounts: any[],
  _startDate: Date,
  _endDate: Date
): DREReport {
  // Receitas (contas de revenue com crédito)
  const revenueAccounts = chartOfAccounts.filter(acc => acc.category === 'revenue');
  const revenueByCategory = revenueAccounts.map(account => {
    const accountEntries = journalEntries.filter(
      je => je.account_id === account.id && je.entry_type === 'credit'
    );
    const amount = accountEntries.reduce((sum, je) => sum + je.amount, 0);
    return {
      category: `${account.code} - ${account.name}`,
      amount
    };
  }).filter(item => item.amount > 0);

  const totalRevenue = revenueByCategory.reduce((sum, item) => sum + item.amount, 0);

  // Despesas (contas de expense com débito)
  const expenseAccounts = chartOfAccounts.filter(acc => acc.category === 'expense');
  const expensesByCategory = expenseAccounts.map(account => {
    const accountEntries = journalEntries.filter(
      je => je.account_id === account.id && je.entry_type === 'debit'
    );
    const amount = accountEntries.reduce((sum, je) => sum + je.amount, 0);
    return {
      category: `${account.code} - ${account.name}`,
      amount: -amount // Negativo para exibição
    };
  }).filter(item => item.amount < 0);

  const totalExpenses = expensesByCategory.reduce((sum, item) => sum + item.amount, 0);

  // Resultado Líquido (Receitas - Despesas)
  const netResult = totalRevenue + totalExpenses; // totalExpenses já é negativo

  return {
    totalRevenue,
    totalExpenses,
    netResult,
    revenueByCategory,
    expensesByCategory,
  };
}

// Gerar Balanço Patrimonial
// ATUALIZADO: Agora usa chart_of_accounts e journal_entries
export function generateBalanceSheet(
  journalEntries: any[],
  chartOfAccounts: any[],
  _referenceDate: Date
): BalanceSheetReport {
  // Calcular saldo de cada conta contábil
  const accountBalances = new Map<string, number>();
  
  chartOfAccounts.forEach(account => {
    const entries = journalEntries.filter(je => je.account_id === account.id);
    
    let balance = 0;
    entries.forEach(entry => {
      if (account.nature === 'debit') {
        // Contas de natureza devedora: débito aumenta, crédito diminui
        balance += entry.entry_type === 'debit' ? entry.amount : -entry.amount;
      } else {
        // Contas de natureza credora: crédito aumenta, débito diminui
        balance += entry.entry_type === 'credit' ? entry.amount : -entry.amount;
      }
    });
    
    if (balance !== 0) {
      accountBalances.set(account.id, balance);
    }
  });

  // Ativo Circulante (contas de asset)
  const assetAccounts = chartOfAccounts.filter(acc => acc.category === 'asset');
  const currentAssets = assetAccounts.map(account => ({
    account: `${account.code} - ${account.name}`,
    balance: accountBalances.get(account.id) || 0
  })).filter(item => item.balance > 0);

  const totalCurrentAssets = currentAssets.reduce((sum, item) => sum + item.balance, 0);

  // Investimentos (subcategoria de ativos, se existir)
  const investments = assetAccounts
    .filter(acc => acc.name.toLowerCase().includes('investimento') || acc.code.startsWith('1.02'))
    .map(account => ({
      account: `${account.code} - ${account.name}`,
      balance: accountBalances.get(account.id) || 0
    }))
    .filter(item => item.balance > 0);

  const totalInvestments = investments.reduce((sum, item) => sum + item.balance, 0);

  // Passivo Circulante (contas de liability)
  const liabilityAccounts = chartOfAccounts.filter(acc => acc.category === 'liability');
  const currentLiabilities = liabilityAccounts.map(account => ({
    account: `${account.code} - ${account.name}`,
    balance: accountBalances.get(account.id) || 0
  })).filter(item => item.balance > 0);

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

  // Filtrar transações do período
  const periodTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= startDate && date <= endDate;
  });

  // CORREÇÃO: Calcular saldo inicial baseado em TODAS as transações ATÉ a data inicial
  const transactionsUntilStart = transactions.filter((t) => {
    const date = new Date(t.date);
    return date < startDate && operationalAccounts.some((a) => a.id === t.account_id);
  });

  const openingBalance = transactionsUntilStart.reduce((sum, t) => sum + t.amount, 0);

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
