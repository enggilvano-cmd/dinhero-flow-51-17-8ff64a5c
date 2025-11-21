import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Category } from "@/types";
import { logger } from "@/lib/logger";
import { queryKeys } from '@/lib/queryClient';

export function useCategories() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) {
        logger.error('Error loading categories:', error);
        throw error;
      }
      
      return (data || []) as Category[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: query.data || [],
    loading: query.isLoading,
    refetch: query.refetch
  };
}