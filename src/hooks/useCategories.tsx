import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Category } from "@/types";
import { logger } from "@/lib/logger";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadCategories = async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) {
        logger.error('Error loading categories:', error);
        return;
      }
      
      setCategories(data || []);
    } catch (error) {
      logger.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [user]);

  return {
    categories,
    loading,
    refetch: loadCategories
  };
}