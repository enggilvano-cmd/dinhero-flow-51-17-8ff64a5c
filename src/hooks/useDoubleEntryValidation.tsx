import { useMemo } from "react";
import { logger } from "@/lib/logger";

interface JournalEntry {
  id: string;
  transaction_id: string | null;
  entry_type: "debit" | "credit";
  amount: number;
  description: string;
  entry_date: string;
}

interface ValidationResult {
  transactionId: string | null;
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  description: string;
  entryDate: string;
}

export function useDoubleEntryValidation(journalEntries: JournalEntry[]) {
  const validationResults = useMemo<ValidationResult[]>(() => {
    // Agrupar journal_entries por transaction_id
    const transactionGroups = new Map<string | null, JournalEntry[]>();
    
    journalEntries.forEach(entry => {
      const key = entry.transaction_id;
      if (!transactionGroups.has(key)) {
        transactionGroups.set(key, []);
      }
      transactionGroups.get(key)!.push(entry);
    });

    // Validar cada grupo
    const results: ValidationResult[] = [];
    
    transactionGroups.forEach((entries, transactionId) => {
      const totalDebits = entries
        .filter(e => e.entry_type === "debit")
        .reduce((sum, e) => sum + e.amount, 0);
      
      const totalCredits = entries
        .filter(e => e.entry_type === "credit")
        .reduce((sum, e) => sum + e.amount, 0);
      
      const difference = Math.abs(totalDebits - totalCredits);
      const isValid = difference < 0.01; // Tolerância de 1 centavo para arredondamento

      if (!isValid) {
        logger.warn("Partida dobrada desbalanceada detectada:", {
          transactionId,
          totalDebits,
          totalCredits,
          difference,
        });
      }

      results.push({
        transactionId,
        isValid,
        totalDebits,
        totalCredits,
        difference,
        description: entries[0]?.description || "Sem descrição",
        entryDate: entries[0]?.entry_date || "",
      });
    });

    return results.filter(r => !r.isValid); // Retornar apenas transações desbalanceadas
  }, [journalEntries]);

  const totalUnbalancedTransactions = validationResults.length;
  const hasUnbalancedEntries = totalUnbalancedTransactions > 0;

  return {
    validationResults,
    totalUnbalancedTransactions,
    hasUnbalancedEntries,
  };
}
