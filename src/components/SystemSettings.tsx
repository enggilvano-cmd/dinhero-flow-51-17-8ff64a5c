import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "./UserManagement";
import { DatabasePerformanceTest } from "./DatabasePerformanceTest";
import { Settings, Users, Database } from "lucide-react";

export default function SystemSettings() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Configurações do Sistema</h1>
        <p className="text-muted-foreground">
          Gerencie usuários, permissões e teste a performance do banco de dados
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <DatabasePerformanceTest />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Configurações adicionais em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
