import { loadJsPDF } from "./lazyImports";
import { format } from "date-fns";
import { formatCurrency } from "./formatters";

// Interfaces
export interface DREReport {
  // Receita Operacional Bruta
  grossRevenue: number;
  revenueItems: Array<{ code: string; name: string; amount: number }>;
  
  // Deduções da Receita Bruta
  revenueDeductions: number;
  deductionItems: Array<{ code: string; name: string; amount: number }>;
  
  // Receita Operacional Líquida
  netRevenue: number;
  
  // CMV/CSV
  cogs: number;
  cogsItems: Array<{ code: string; name: string; amount: number }>;
  
  // Lucro Bruto
  grossProfit: number;
  
  // Despesas Operacionais
  operatingExpenses: number;
  salesExpenses: number;
  salesExpenseItems: Array<{ code: string; name: string; amount: number }>;
  administrativeExpenses: number;
  administrativeExpenseItems: Array<{ code: string; name: string; amount: number }>;
  
  // Lucro Operacional (EBIT)
  ebit: number;
  
  // Resultado Financeiro
  financialResult: number;
  financialRevenue: number;
  financialRevenueItems: Array<{ code: string; name: string; amount: number }>;
  financialExpenses: number;
  financialExpenseItems: Array<{ code: string; name: string; amount: number }>;
  
  // Lucro antes de IR/CSLL
  profitBeforeTaxes: number;
  
  // Impostos sobre o Lucro
  incomeTaxes: number;
  incomeTaxItems: Array<{ code: string; name: string; amount: number }>;
  
  // Lucro Líquido
  netProfit: number;
  
  // Outras Receitas e Despesas (não-operacionais)
  otherRevenuesExpenses: number;
  otherRevenueItems: Array<{ code: string; name: string; amount: number }>;
  otherExpenseItems: Array<{ code: string; name: string; amount: number }>;
  
  // Resultado do Exercício
  finalResult: number;
  
  // EBITDA (informativo)
  ebitda: number;
  depreciation: number;
  depreciationItems: Array<{ code: string; name: string; amount: number }>;
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

// Gerar DRE (Demonstração do Resultado do Exercício) - Lei 6.404/76
// ATUALIZADO: Estrutura vertical com totalizadores intermediários
export function generateDRE(
  journalEntries: any[],
  chartOfAccounts: any[],
  _startDate: Date,
  _endDate: Date
): DREReport {
  const getAccountsByCodePrefix = (prefix: string) => {
    return chartOfAccounts.filter(acc => acc.code.startsWith(prefix));
  };

  const mapAccountsToItems = (accounts: any[], entryType: 'debit' | 'credit') => {
    return accounts
      .map(account => {
        const entries = journalEntries.filter(
          je => je.account_id === account.id && je.entry_type === entryType
        );
        const amount = entries.reduce((sum, je) => sum + je.amount, 0);
        return {
          code: account.code,
          name: account.name,
          amount
        };
      })
      .filter(item => item.amount > 0);
  };

  // 1. RECEITA OPERACIONAL BRUTA (4.01.xx)
  const grossRevenueAccounts = getAccountsByCodePrefix('4.01');
  const revenueItems = mapAccountsToItems(grossRevenueAccounts, 'credit');
  const grossRevenue = revenueItems.reduce((sum, item) => sum + item.amount, 0);

  // 2. DEDUÇÕES DA RECEITA BRUTA (4.02.xx)
  const deductionAccounts = getAccountsByCodePrefix('4.02');
  const deductionItems = mapAccountsToItems(deductionAccounts, 'debit');
  const revenueDeductions = deductionItems.reduce((sum, item) => sum + item.amount, 0);

  // 3. RECEITA OPERACIONAL LÍQUIDA
  const netRevenue = grossRevenue - revenueDeductions;

  // 4. CMV/CSV (5.02.xx)
  const cogsAccounts = getAccountsByCodePrefix('5.02');
  const cogsItems = mapAccountsToItems(cogsAccounts, 'debit');
  const cogs = cogsItems.reduce((sum, item) => sum + item.amount, 0);

  // 5. LUCRO BRUTO
  const grossProfit = netRevenue - cogs;

  // 6. DESPESAS OPERACIONAIS
  // 6.1. Despesas com Vendas (5.03.xx)
  const salesExpenseAccounts = getAccountsByCodePrefix('5.03');
  const salesExpenseItems = mapAccountsToItems(salesExpenseAccounts, 'debit');
  const salesExpenses = salesExpenseItems.reduce((sum, item) => sum + item.amount, 0);

  // 6.2. Despesas Administrativas (5.04.xx)
  const adminExpenseAccounts = getAccountsByCodePrefix('5.04');
  const administrativeExpenseItems = mapAccountsToItems(adminExpenseAccounts, 'debit');
  const administrativeExpenses = administrativeExpenseItems.reduce((sum, item) => sum + item.amount, 0);

  // Total Despesas Operacionais
  const operatingExpenses = salesExpenses + administrativeExpenses;

  // 7. LUCRO OPERACIONAL (EBIT)
  const ebit = grossProfit - operatingExpenses;

  // 8. RESULTADO FINANCEIRO
  // Receitas Financeiras (podem estar em 4.01.03 ou contas específicas)
  const financialRevenueAccounts = chartOfAccounts.filter(
    acc => acc.category === 'revenue' && 
    (acc.code.includes('4.01.03') || acc.name.toLowerCase().includes('financeira'))
  );
  const financialRevenueItems = mapAccountsToItems(financialRevenueAccounts, 'credit');
  const financialRevenue = financialRevenueItems.reduce((sum, item) => sum + item.amount, 0);

  // Despesas Financeiras (5.05.xx)
  const financialExpenseAccounts = getAccountsByCodePrefix('5.05');
  const financialExpenseItems = mapAccountsToItems(financialExpenseAccounts, 'debit');
  const financialExpenses = financialExpenseItems.reduce((sum, item) => sum + item.amount, 0);

  const financialResult = financialRevenue - financialExpenses;

  // 9. LUCRO ANTES DE IR/CSLL
  const profitBeforeTaxes = ebit + financialResult;

  // 10. IMPOSTOS SOBRE O LUCRO (7.01.xx)
  const incomeTaxAccounts = getAccountsByCodePrefix('7.01');
  const incomeTaxItems = mapAccountsToItems(incomeTaxAccounts, 'debit');
  const incomeTaxes = incomeTaxItems.reduce((sum, item) => sum + item.amount, 0);

  // 11. LUCRO LÍQUIDO
  const netProfit = profitBeforeTaxes - incomeTaxes;

  // 12. OUTRAS RECEITAS E DESPESAS (6.01.xx)
  const otherRevenueAccounts = chartOfAccounts.filter(
    acc => acc.code.startsWith('6.01') && 
    (acc.category === 'revenue' || acc.name.toLowerCase().includes('ganho') || acc.name.toLowerCase().includes('receita'))
  );
  const otherRevenueItems = mapAccountsToItems(otherRevenueAccounts, 'credit');
  const otherRevenues = otherRevenueItems.reduce((sum, item) => sum + item.amount, 0);

  const otherExpenseAccounts = chartOfAccounts.filter(
    acc => acc.code.startsWith('6.01') && 
    acc.category === 'expense'
  );
  const otherExpenseItems = mapAccountsToItems(otherExpenseAccounts, 'debit');
  const otherExpenses = otherExpenseItems.reduce((sum, item) => sum + item.amount, 0);

  const otherRevenuesExpenses = otherRevenues - otherExpenses;

  // 13. RESULTADO DO EXERCÍCIO
  const finalResult = netProfit + otherRevenuesExpenses;

  // 14. EBITDA (INFORMATIVO)
  // EBITDA = EBIT + Depreciação + Amortização
  const depreciationAccounts = chartOfAccounts.filter(
    acc => acc.code.startsWith('5.04.06') || 
    acc.name.toLowerCase().includes('depreciação') || 
    acc.name.toLowerCase().includes('amortização')
  );
  const depreciationItems = mapAccountsToItems(depreciationAccounts, 'debit');
  const depreciation = depreciationItems.reduce((sum, item) => sum + item.amount, 0);
  const ebitda = ebit + depreciation;

  return {
    grossRevenue,
    revenueItems,
    revenueDeductions,
    deductionItems,
    netRevenue,
    cogs,
    cogsItems,
    grossProfit,
    operatingExpenses,
    salesExpenses,
    salesExpenseItems,
    administrativeExpenses,
    administrativeExpenseItems,
    ebit,
    financialResult,
    financialRevenue,
    financialRevenueItems,
    financialExpenses,
    financialExpenseItems,
    profitBeforeTaxes,
    incomeTaxes,
    incomeTaxItems,
    netProfit,
    otherRevenuesExpenses,
    otherRevenueItems,
    otherExpenseItems,
    finalResult,
    ebitda,
    depreciation,
    depreciationItems,
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

  // Patrimônio Líquido = Ativos - Passivos
  // CORREÇÃO: Aplicar a equação contábil fundamental (ATIVO = PASSIVO + PL)
  // Portanto: PL = ATIVO - PASSIVO
  const equity = totalAssets - totalLiabilities;

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
// ATUALIZADO: Agora usa journal_entries e chart_of_accounts
export function generateCashFlow(
  journalEntries: any[],
  chartOfAccounts: any[],
  startDate: Date,
  endDate: Date
): CashFlowReport {
  // Identificar contas de caixa/banco (ativos circulantes líquidos)
  const cashAccounts = chartOfAccounts.filter(
    (acc) => 
      acc.category === 'asset' && 
      (acc.code.startsWith('1.01.01') || // Caixa
       acc.code.startsWith('1.01.02') || // Banco Corrente
       acc.code.startsWith('1.01.03'))   // Banco Poupança
  );

  const cashAccountIds = cashAccounts.map(acc => acc.id);

  // Filtrar journal entries de contas de caixa
  const cashEntries = journalEntries.filter(je => 
    cashAccountIds.includes(je.account_id)
  );

  // Calcular saldo inicial (até a data inicial)
  const entriesUntilStart = cashEntries.filter((je) => {
    const date = new Date(je.entry_date);
    return date < startDate;
  });

  let openingBalance = 0;
  entriesUntilStart.forEach(entry => {
    const account = cashAccounts.find(acc => acc.id === entry.account_id);
    if (account) {
      if (account.nature === 'debit') {
        // Conta devedora: débito aumenta, crédito diminui
        openingBalance += entry.entry_type === 'debit' ? entry.amount : -entry.amount;
      } else {
        // Conta credora: crédito aumenta, débito diminui
        openingBalance += entry.entry_type === 'credit' ? entry.amount : -entry.amount;
      }
    }
  });

  // Filtrar entries do período
  const periodEntries = cashEntries.filter((je) => {
    const date = new Date(je.entry_date);
    return date >= startDate && date <= endDate;
  });

  // Calcular entradas (débitos nas contas de caixa/banco)
  const inflows = periodEntries
    .filter(je => je.entry_type === 'debit')
    .reduce((sum, je) => sum + je.amount, 0);

  // Calcular saídas (créditos nas contas de caixa/banco)
  const outflows = periodEntries
    .filter(je => je.entry_type === 'credit')
    .reduce((sum, je) => sum + je.amount, 0);

  // Atividades Operacionais (entradas - saídas)
  const operatingActivities = inflows - outflows;

  // Atividades de Investimento
  // Buscar contas de investimento
  const investmentAccounts = chartOfAccounts.filter(
    (acc) => acc.category === 'asset' && acc.code.startsWith('1.01.04')
  );

  const investmentAccountIds = investmentAccounts.map(acc => acc.id);

  const investmentEntries = journalEntries.filter((je) => {
    const date = new Date(je.entry_date);
    return date >= startDate && date <= endDate && investmentAccountIds.includes(je.account_id);
  });

  // Investimentos: débitos em contas de investimento = aplicação (saída)
  //                créditos em contas de investimento = resgate (entrada)
  const investmentActivities = investmentEntries.reduce((sum, je) => {
    if (je.entry_type === 'debit') {
      return sum - je.amount; // Aplicação é saída de caixa
    } else {
      return sum + je.amount; // Resgate é entrada de caixa
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
export async function exportReportToPDF(
  reportType: "dre" | "balance" | "cashflow",
  reportData: any,
  startDate: Date,
  endDate: Date,
  t: any
) {
  const { jsPDF } = await loadJsPDF();
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
    exportDREtoPDF(doc, reportData, yPos);
  } else if (reportType === "balance") {
    exportBalanceSheetToPDF(doc, reportData, yPos, t);
  } else if (reportType === "cashflow") {
    exportCashFlowToPDF(doc, reportData, yPos, t);
  }

  // Salvar
  const filename = `${title.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}

function exportDREtoPDF(doc: any, data: DREReport, startY: number) {
  let y = startY;
  const leftMargin = 20;
  const indent1 = 25;
  const indent2 = 30;
  const rightAlign = 170;

  doc.setFontSize(10);

  // 1. Receita Operacional Bruta
  doc.setFont("helvetica", "bold");
  doc.text("RECEITA OPERACIONAL BRUTA", leftMargin, y);
  doc.text(formatCurrency(data.grossRevenue), rightAlign, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  data.revenueItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent1, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  y += 2;

  // 2. Deduções
  doc.setFont("helvetica", "bold");
  doc.text("(-) DEDUÇÕES DA RECEITA BRUTA", leftMargin, y);
  doc.text(formatCurrency(data.revenueDeductions), rightAlign, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  data.deductionItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent1, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  y += 2;

  // 3. Receita Líquida
  doc.setFont("helvetica", "bold");
  doc.text("= RECEITA OPERACIONAL LÍQUIDA", leftMargin, y);
  doc.text(formatCurrency(data.netRevenue), rightAlign, y, { align: "right" });
  y += 7;

  // 4. CMV/CSV
  doc.text("(-) CMV/CSV", leftMargin, y);
  doc.text(formatCurrency(data.cogs), rightAlign, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  data.cogsItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent1, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  y += 2;

  // 5. Lucro Bruto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("= LUCRO BRUTO", leftMargin, y);
  doc.text(formatCurrency(data.grossProfit), rightAlign, y, { align: "right" });
  y += 7;

  // 6. Despesas Operacionais
  doc.setFontSize(10);
  doc.text("(-) DESPESAS OPERACIONAIS", leftMargin, y);
  doc.text(formatCurrency(data.operatingExpenses), rightAlign, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  doc.text("Despesas com Vendas", indent1, y);
  y += 4;
  data.salesExpenseItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent2, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  
  doc.text("Despesas Administrativas", indent1, y);
  y += 4;
  data.administrativeExpenseItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent2, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  y += 2;

  // 7. EBIT
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("= LUCRO OPERACIONAL (EBIT)", leftMargin, y);
  doc.text(formatCurrency(data.ebit), rightAlign, y, { align: "right" });
  y += 7;

  // 8. Resultado Financeiro
  doc.setFontSize(10);
  doc.text("(+/-) RESULTADO FINANCEIRO", leftMargin, y);
  doc.text(formatCurrency(data.financialResult), rightAlign, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  if (data.financialRevenueItems.length > 0) {
    doc.text("Receitas Financeiras", indent1, y);
    y += 4;
    data.financialRevenueItems.forEach(item => {
      doc.text(`${item.code} - ${item.name}`, indent2, y);
      doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
      y += 4;
    });
  }
  
  doc.text("(-) Despesas Financeiras", indent1, y);
  y += 4;
  data.financialExpenseItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent2, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  y += 2;

  // 9. Lucro antes IR
  doc.setFont("helvetica", "bold");
  doc.text("= LUCRO ANTES DO IR/CSLL", leftMargin, y);
  doc.text(formatCurrency(data.profitBeforeTaxes), rightAlign, y, { align: "right" });
  y += 7;

  // 10. Impostos
  doc.text("(-) PROVISÃO PARA IR E CSLL", leftMargin, y);
  doc.text(formatCurrency(data.incomeTaxes), rightAlign, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  data.incomeTaxItems.forEach(item => {
    doc.text(`${item.code} - ${item.name}`, indent1, y);
    doc.text(formatCurrency(item.amount), rightAlign, y, { align: "right" });
    y += 4;
  });
  y += 2;

  // 11. Lucro Líquido
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("= LUCRO LÍQUIDO DO EXERCÍCIO", leftMargin, y);
  doc.text(formatCurrency(data.netProfit), rightAlign, y, { align: "right" });
  y += 8;

  // 12. Outras receitas/despesas
  if (data.otherRevenuesExpenses !== 0) {
    doc.setFontSize(10);
    doc.text("(+/-) OUTRAS RECEITAS/DESPESAS", leftMargin, y);
    doc.text(formatCurrency(data.otherRevenuesExpenses), rightAlign, y, { align: "right" });
    y += 7;
  }

  // 13. Resultado Final
  doc.setFontSize(13);
  doc.text("= RESULTADO DO EXERCÍCIO", leftMargin, y);
  doc.text(formatCurrency(data.finalResult), rightAlign, y, { align: "right" });
  y += 10;

  // EBITDA (informativo)
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(`EBITDA (informativo): ${formatCurrency(data.ebitda)}`, leftMargin, y);
}

function exportBalanceSheetToPDF(doc: any, data: BalanceSheetReport, startY: number, t: any) {
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

function exportCashFlowToPDF(doc: any, data: CashFlowReport, startY: number, t: any) {
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
