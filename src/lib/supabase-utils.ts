import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { PostgrestError } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

/**
 * Get authenticated user ID or throw error
 */
export async function getUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  
  return user.id;
}

/**
 * Unified error handler for Supabase operations
 */
export function handleSupabaseError(
  error: PostgrestError | Error | unknown,
  context: string = 'Operation',
  showToast: boolean = true
): string {
  let errorMessage = 'An unexpected error occurred';

  // Handle Supabase PostgrestError
  if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = (error as Error).message;
  }

  // Handle specific error codes
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as PostgrestError).code;
    
    switch (code) {
      case '23505':
        errorMessage = 'This record already exists';
        break;
      case '23503':
        errorMessage = 'Cannot delete: record is being used elsewhere';
        break;
      case '42501':
        errorMessage = 'Permission denied';
        break;
      case 'PGRST116':
        errorMessage = 'Record not found';
        break;
      default:
        break;
    }
  }

  // Log error
  logger.error(`${context}:`, error);

  // Show toast notification
  if (showToast) {
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive'
    });
  }

  return errorMessage;
}

/**
 * Wrapper for async Supabase operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  showToast: boolean = true
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await operation();
    return { data, error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error, context, showToast);
    return { data: null, error: errorMessage };
  }
}

// Note: Generic query/insert/update/delete functions removed due to TypeScript limitations
// with Supabase's strictly typed client. Use direct Supabase calls with getUserId() and
// handleSupabaseError() for proper type safety.
