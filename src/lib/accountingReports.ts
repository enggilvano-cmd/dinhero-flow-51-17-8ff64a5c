import { loadJsPDF } from "./lazyImports";
import { format } from "date-fns";
import { formatCurrency } from "./formatters";

// Interfaces
export interface DREReport {
  // Receitas
  receitaBruta: number;
  deducoesReceita: number;
  receitaLiquida: number;
  
  // CMV
  cmv: number;
  
  // Lucro Bruto
  lucroBruto: number;
  
  // Despesas Operacionais
  despesasVendas: number;
  despesasAdministrativas: number;
  despesasFinanceiras: number;
  outrasDespesasOperacionais: number;
  totalDespesasOperacionais: number;
  
  // EBIT (Lucro Operacional)
  ebit: number;
  
  // Receitas/Despesas Não-Operacionais
  receitasNaoOperacionais: number;
  despesasNaoOperacionais: number;
  resultadoNaoOperacional: number;
  
  // Lucro antes do IR
  lucroAntesIR: number;
  
  // Impostos
  provisaoIR: number;
  
  // Lucro Líquido
  lucroLiquido: number;
  
  // Detalhamento por conta (para exibição detalhada)
  receitaBrutaDetalhada: Array<{ code: string; name: string; amount: number }>;
  deducoesDetalhadas: Array<{ code: string; name: string; amount: number }>;
  cmvDetalhado: Array<{ code: string; name: string; amount: number }>;
  despesasVendasDetalhadas: Array<{ code: string; name: string; amount: number }>;
  despesasAdministrativasDetalhadas: Array<{ code: string; name: string; amount: number }>;
  despesasFinanceirasDetalhadas: Array<{ code: string; name: string; amount: number }>;
  outrasDespesasDetalhadas: Array<{ code: string; name: string; amount: number }>;
  receitasNaoOperacionaisDetalhadas: Array<{ code: string; name: string; amount: number }>;
  despesasNaoOperacionaisDetalhadas: Array<{ code: string; name: string; amount: number }>;
  provisaoIRDetalhada: Array<{ code: string; name: string; amount: number }>;
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
  
  // Helper para calcular saldo de contas por código
  const calcularSaldoContas = (codigoInicio: string, tipo: 'debit' | 'credit') => {
    const contas = chartOfAccounts.filter(acc => acc.code.startsWith(codigoInicio));
    return contas.map(account => {
      const entries = journalEntries.filter(
        je => je.account_id === account.id && je.entry_type === tipo
      );
      const amount = entries.reduce((sum, je) => sum + je.amount, 0);
      return {
        code: account.code,
        name: account.name,
        amount
      };
    }).filter(item => item.amount > 0);
  };

  // 1. RECEITA BRUTA (4.01.xx - créditos)
  const receitaBrutaDetalhada = calcularSaldoContas('4.01', 'credit');
  const receitaBruta = receitaBrutaDetalhada.reduce((sum, item) => sum + item.amount, 0);

  // 2. DEDUÇÕES DA RECEITA (4.02.xx - débitos, pois reduzem receita)
  const deducoesDetalhadas = calcularSaldoContas('4.02', 'debit');
  const deducoesReceita = deducoesDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  // 3. RECEITA LÍQUIDA
  const receitaLiquida = receitaBruta - deducoesReceita;

  // 4. CMV/CSV (5.02.xx - débitos)
  const cmvDetalhado = calcularSaldoContas('5.02', 'debit');
  const cmv = cmvDetalhado.reduce((sum, item) => sum + item.amount, 0);

  // 5. LUCRO BRUTO
  const lucroBruto = receitaLiquida - cmv;

  // 6. DESPESAS OPERACIONAIS
  // 6.1 Despesas com Vendas (5.03.xx)
  const despesasVendasDetalhadas = calcularSaldoContas('5.03', 'debit');
  const despesasVendas = despesasVendasDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  // 6.2 Despesas Administrativas (5.04.xx)
  const despesasAdministrativasDetalhadas = calcularSaldoContas('5.04', 'debit');
  const despesasAdministrativas = despesasAdministrativasDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  // 6.3 Despesas Financeiras (5.05.xx)
  const despesasFinanceirasDetalhadas = calcularSaldoContas('5.05', 'debit');
  const despesasFinanceiras = despesasFinanceirasDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  // 6.4 Outras Despesas Operacionais (5.01.xx e 5.99.xx)
  const outras501 = calcularSaldoContas('5.01', 'debit');
  const outras599 = calcularSaldoContas('5.99', 'debit');
  const outrasDespesasDetalhadas = [...outras501, ...outras599];
  const outrasDespesasOperacionais = outrasDespesasDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  const totalDespesasOperacionais = despesasVendas + despesasAdministrativas + 
                                    despesasFinanceiras + outrasDespesasOperacionais;

  // 7. EBIT (Lucro Operacional / Earnings Before Interest and Taxes)
  const ebit = lucroBruto - totalDespesasOperacionais;

  // 8. RECEITAS E DESPESAS NÃO-OPERACIONAIS (6.01.xx)
  // Receitas não-operacionais (6.01.xx com crédito)
  const receitasNaoOperacionaisDetalhadas = chartOfAccounts
    .filter(acc => acc.code.startsWith('6.01') && acc.category === 'revenue')
    .map(account => {
      const entries = journalEntries.filter(
        je => je.account_id === account.id && je.entry_type === 'credit'
      );
      const amount = entries.reduce((sum, je) => sum + je.amount, 0);
      return { code: account.code, name: account.name, amount };
    })
    .filter(item => item.amount > 0);
  const receitasNaoOperacionais = receitasNaoOperacionaisDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  // Despesas não-operacionais (6.01.xx com débito)
  const despesasNaoOperacionaisDetalhadas = chartOfAccounts
    .filter(acc => acc.code.startsWith('6.01') && acc.category === 'expense')
    .map(account => {
      const entries = journalEntries.filter(
        je => je.account_id === account.id && je.entry_type === 'debit'
      );
      const amount = entries.reduce((sum, je) => sum + je.amount, 0);
      return { code: account.code, name: account.name, amount };
    })
    .filter(item => item.amount > 0);
  const despesasNaoOperacionais = despesasNaoOperacionaisDetalhadas.reduce((sum, item) => sum + item.amount, 0);

  const resultadoNaoOperacional = receitasNaoOperacionais - despesasNaoOperacionais;

  // 9. LUCRO ANTES DO IR
  const lucroAntesIR = ebit + resultadoNaoOperacional;

  // 10. PROVISÃO PARA IR E CSLL (7.01.xx)
  const provisaoIRDetalhada = calcularSaldoContas('7.01', 'debit');
  const provisaoIR = provisaoIRDetalhada.reduce((sum, item) => sum + item.amount, 0);

  // 11. LUCRO LÍQUIDO DO EXERCÍCIO
  const lucroLiquido = lucroAntesIR - provisaoIR;

  return {
    receitaBruta,
    deducoesReceita,
    receitaLiquida,
    cmv,
    lucroBruto,
    despesasVendas,
    despesasAdministrativas,
    despesasFinanceiras,
    outrasDespesasOperacionais,
    totalDespesasOperacionais,
    ebit,
    receitasNaoOperacionais,
    despesasNaoOperacionais,
    resultadoNaoOperacional,
    lucroAntesIR,
    provisaoIR,
    lucroLiquido,
    receitaBrutaDetalhada,
    deducoesDetalhadas,
    cmvDetalhado,
    despesasVendasDetalhadas,
    despesasAdministrativasDetalhadas,
    despesasFinanceirasDetalhadas,
    outrasDespesasDetalhadas,
    receitasNaoOperacionaisDetalhadas,
    despesasNaoOperacionaisDetalhadas,
    provisaoIRDetalhada,
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

function exportDREtoPDF(doc: any, data: DREReport, startY: number) {
  let y = startY;

  // Receita Bruta
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RECEITA BRUTA", 20, y);
  doc.text(formatCurrency(data.receitaBruta), 170, y, { align: "right" });
  y += 6;

  // (-) Deduções
  doc.setFont("helvetica", "normal");
  doc.text("(-) Deduções da Receita", 20, y);
  doc.text(formatCurrency(data.deducoesReceita), 170, y, { align: "right" });
  y += 5;

  // (=) Receita Líquida
  doc.setFont("helvetica", "bold");
  doc.text("(=) RECEITA LÍQUIDA", 20, y);
  doc.text(formatCurrency(data.receitaLiquida), 170, y, { align: "right" });
  y += 6;

  // (-) CMV
  doc.setFont("helvetica", "normal");
  doc.text("(-) CMV/CSV", 20, y);
  doc.text(formatCurrency(data.cmv), 170, y, { align: "right" });
  y += 5;

  // (=) Lucro Bruto
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("(=) LUCRO BRUTO", 20, y);
  doc.text(formatCurrency(data.lucroBruto), 170, y, { align: "right" });
  y += 8;

  // Despesas Operacionais
  doc.setFontSize(11);
  doc.text("(-) DESPESAS OPERACIONAIS", 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("    Despesas com Vendas", 25, y);
  doc.text(formatCurrency(data.despesasVendas), 170, y, { align: "right" });
  y += 4;
  doc.text("    Despesas Administrativas", 25, y);
  doc.text(formatCurrency(data.despesasAdministrativas), 170, y, { align: "right" });
  y += 4;
  doc.text("    Despesas Financeiras", 25, y);
  doc.text(formatCurrency(data.despesasFinanceiras), 170, y, { align: "right" });
  y += 4;
  doc.text("    Outras Despesas", 25, y);
  doc.text(formatCurrency(data.outrasDespesasOperacionais), 170, y, { align: "right" });
  y += 6;

  // (=) EBIT
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("(=) LUCRO OPERACIONAL (EBIT)", 20, y);
  doc.text(formatCurrency(data.ebit), 170, y, { align: "right" });
  y += 8;

  // (+/-) Não-Operacional
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (data.resultadoNaoOperacional !== 0) {
    const sinal = data.resultadoNaoOperacional >= 0 ? "(+)" : "(-)";
    doc.text(`${sinal} Resultado Não-Operacional`, 20, y);
    doc.text(formatCurrency(Math.abs(data.resultadoNaoOperacional)), 170, y, { align: "right" });
    y += 5;
  }

  // (=) Lucro antes IR
  doc.setFont("helvetica", "bold");
  doc.text("(=) LUCRO ANTES DO IR/CS", 20, y);
  doc.text(formatCurrency(data.lucroAntesIR), 170, y, { align: "right" });
  y += 6;

  // (-) Provisão IR
  doc.setFont("helvetica", "normal");
  doc.text("(-) Provisão para IR e CSLL", 20, y);
  doc.text(formatCurrency(data.provisaoIR), 170, y, { align: "right" });
  y += 5;

  // (=) Lucro Líquido
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("(=) LUCRO LÍQUIDO", 20, y);
  doc.text(formatCurrency(data.lucroLiquido), 170, y, { align: "right" });
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
