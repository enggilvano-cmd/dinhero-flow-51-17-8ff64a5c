import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingReportsPage } from "@/components/AccountingReportsPage";
import { LedgerPage } from "@/components/LedgerPage";
import { PeriodClosurePage } from "@/components/PeriodClosurePage";
import { BookOpen, BookText, Calendar } from "lucide-react";

export function AccountingPage() {
  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 gap-2 h-auto p-2">
          <TabsTrigger 
            value="reports" 
            className="gap-1.5 px-2 py-2.5 text-xs sm:text-sm h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger 
            value="ledger" 
            className="gap-1.5 px-2 py-2.5 text-xs sm:text-sm h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <BookText className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Livro Razão</span>
          </TabsTrigger>
          <TabsTrigger 
            value="closure" 
            className="gap-1.5 px-2 py-2.5 text-xs sm:text-sm h-auto col-span-2 sm:col-span-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Fechamento</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-6">
          <AccountingReportsPage />
        </TabsContent>

        <TabsContent value="ledger" className="mt-6">
          <LedgerPage />
        </TabsContent>

        <TabsContent value="closure" className="mt-6">
          <PeriodClosurePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
