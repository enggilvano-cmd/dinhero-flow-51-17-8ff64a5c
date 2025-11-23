import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingReportsPage } from "@/components/AccountingReportsPage";
import { LedgerPage } from "@/components/LedgerPage";
import { PeriodClosurePage } from "@/components/PeriodClosurePage";
import { BookOpen, BookText, Calendar } from "lucide-react";

export function AccountingPage() {
  return (
    <div className="spacing-responsive-lg fade-in pb-6 sm:pb-8">

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-2 h-auto p-1">
          <TabsTrigger 
            value="reports" 
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
            <span className="sm:hidden">Rel.</span>
          </TabsTrigger>
          <TabsTrigger 
            value="ledger" 
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <BookText className="h-4 w-4" />
            <span className="hidden sm:inline">Livro Razão</span>
            <span className="sm:hidden">Razão</span>
          </TabsTrigger>
          <TabsTrigger 
            value="closure" 
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Fechamento</span>
            <span className="sm:hidden">Fech.</span>
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
