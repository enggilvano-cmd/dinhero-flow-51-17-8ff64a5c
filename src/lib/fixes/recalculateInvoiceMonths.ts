import { supabase } from "@/integrations/supabase/client";
import { calculateInvoiceMonthByDue, createDateFromString } from "@/lib/dateUtils";
import { useTransactionStore } from "@/stores/TransactionStore";
import type { Account, Transaction } from "@/types";

interface RecalcResult {
  scanned: number;
  eligible: number;
  updated: number;
  skippedNoAccount: number;
}

/**
 * Recalcula e atualiza o campo invoice_month de transações existentes
 * com base na data da transação e nas configurações (fechamento/vencimento)
 * das contas de cartão de crédito do usuário atual.
 */
export async function recalculateInvoiceMonthsForUser(): Promise<RecalcResult> {
  // 1) Usuário atual
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Usuário não autenticado");
  }

  // 2) Buscar contas de crédito do usuário (precisamos de closing_date e due_date)
  const { data: accounts, error: accError } = await supabase
    .from("accounts")
    .select("id, type, closing_date, due_date")
    .eq("user_id", user.id);
  if (accError) throw accError;

  const creditAccounts = (accounts || []).filter(
    (a) => a.type === "credit" && a.closing_date && a.due_date
  ) as Pick<Account, "id" | "closing_date" | "due_date" | "type">[];

  const accountMap = new Map(
    creditAccounts.map((a) => [a.id, { closing: a.closing_date!, due: a.due_date! }])
  );

  // 3) Buscar transações do usuário nessas contas
  //    Preferimos recalcular TODAS as transações dessas contas, mas você pode limitar a parceladas se quiser
  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select(
      "id, account_id, date, type, invoice_month, invoice_month_overridden, amount, description, user_id, category_id, status, installments, current_installment, parent_transaction_id"
    )
    .eq("user_id", user.id);
  if (txError) throw txError;

  const scanned = txs?.length || 0;

  // Filtrar apenas das contas de crédito elegíveis
  const eligibleTxs = (txs || []).filter(
    (t) => accountMap.has(t.account_id!) && t.type === 'expense' && (t.installments != null || t.current_installment != null || t.parent_transaction_id != null)
  );

  let updated = 0;
  let skippedNoAccount = scanned - eligibleTxs.length;

  // 4) Calcular novos invoice_month e montar payloads de atualização
  const updates: Pick<Transaction, "id" | "invoice_month">[] = [];

  for (const t of eligibleTxs) {
    const accCfg = accountMap.get(t.account_id!)!;
    const dateObj = createDateFromString(t.date);
    const newMonth = calculateInvoiceMonthByDue(dateObj, accCfg.closing, accCfg.due);
    if (!t.invoice_month_overridden && t.invoice_month !== newMonth) {
      updates.push({ id: t.id, invoice_month: newMonth });
    }
  }

  // 5) Atualizar em lotes via upsert (onConflict: id) para respeitar RLS
  const chunkSize = 200;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("transactions")
      // TS exige o tipo completo para upsert; porém no PostgREST é seguro enviar parciais.
      // Fazemos o cast para any para atualizar apenas invoice_month usando onConflict: id.
      .upsert(chunk as any, { onConflict: "id" });
    if (error) throw error;
    updated += chunk.length;
  }

  // 6) Atualizar o estado local (Zustand)
  if (updated > 0) {
    const current = useTransactionStore.getState().transactions;
    const map = new Map(updates.map((u) => [u.id, u.invoice_month]));

    const toUpdate = current
      .filter((t) => map.has(t.id))
      .map((t) => ({ ...t, invoice_month: map.get(t.id)! }));

    // updateTransactions aceita Transaction[]; manteremos os outros campos intocados
    useTransactionStore.getState().updateTransactions(toUpdate as unknown as Transaction[]);
  }

  return {
    scanned,
    eligible: eligibleTxs.length,
    updated,
    skippedNoAccount,
  };
}
