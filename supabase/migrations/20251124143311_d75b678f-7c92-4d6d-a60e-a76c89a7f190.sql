-- ============================================
-- P0-3: Adicionar journal entries para transferências
-- ============================================

-- Recriar função atomic_create_transfer com suporte a journal entries
CREATE OR REPLACE FUNCTION public.atomic_create_transfer(
  p_user_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_outgoing_description TEXT,
  p_incoming_description TEXT,
  p_date DATE,
  p_status transaction_status
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  outgoing_transaction_id UUID,
  incoming_transaction_id UUID,
  from_balance NUMERIC,
  to_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outgoing_id UUID;
  v_incoming_id UUID;
  v_from_balance NUMERIC;
  v_to_balance NUMERIC;
  v_from_account_type account_type;
  v_to_account_type account_type;
  v_from_limit NUMERIC;
  v_from_chart_account_id UUID;
  v_to_chart_account_id UUID;
BEGIN
  -- Validar contas existem e pertencem ao usuário
  SELECT type, limit_amount INTO v_from_account_type, v_from_limit
  FROM accounts 
  WHERE id = p_from_account_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Source account not found'::TEXT, NULL::UUID, NULL::UUID, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  SELECT type INTO v_to_account_type
  FROM accounts 
  WHERE id = p_to_account_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Destination account not found'::TEXT, NULL::UUID, NULL::UUID, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Validar mesma conta
  IF p_from_account_id = p_to_account_id THEN
    RETURN QUERY SELECT false, 'Cannot transfer to the same account'::TEXT, NULL::UUID, NULL::UUID, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- Validar saldo (incluindo limite para cartões de crédito)
  SELECT balance INTO v_from_balance FROM accounts WHERE id = p_from_account_id;
  
  IF v_from_account_type = 'credit' THEN
    IF v_from_balance + COALESCE(v_from_limit, 0) < p_amount THEN
      RETURN QUERY SELECT false, 'Insufficient balance (including limit)'::TEXT, NULL::UUID, NULL::UUID, 0::NUMERIC, 0::NUMERIC;
      RETURN;
    END IF;
  ELSE
    IF v_from_balance < p_amount THEN
      RETURN QUERY SELECT false, 'Insufficient balance'::TEXT, NULL::UUID, NULL::UUID, 0::NUMERIC, 0::NUMERIC;
      RETURN;
    END IF;
  END IF;
  
  -- Criar transação de saída
  INSERT INTO transactions (
    user_id, account_id, type, amount, date, description, status, to_account_id
  ) VALUES (
    p_user_id, p_from_account_id, 'expense', -ABS(p_amount), p_date, p_outgoing_description, p_status, p_to_account_id
  ) RETURNING id INTO v_outgoing_id;
  
  -- Criar transação de entrada
  INSERT INTO transactions (
    user_id, account_id, type, amount, date, description, status, linked_transaction_id
  ) VALUES (
    p_user_id, p_to_account_id, 'income', ABS(p_amount), p_date, p_incoming_description, p_status, v_outgoing_id
  ) RETURNING id INTO v_incoming_id;
  
  -- Atualizar linked_transaction_id da saída
  UPDATE transactions SET linked_transaction_id = v_incoming_id WHERE id = v_outgoing_id;
  
  -- NOVO: Criar journal entries para transferência se status = completed
  IF p_status = 'completed' THEN
    -- Mapear conta origem para conta contábil
    IF v_from_account_type = 'checking' THEN
      SELECT id INTO v_from_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '1.01.02' AND is_active = true LIMIT 1;
    ELSIF v_from_account_type = 'savings' THEN
      SELECT id INTO v_from_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '1.01.03' AND is_active = true LIMIT 1;
    ELSIF v_from_account_type = 'investment' THEN
      SELECT id INTO v_from_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '1.01.04' AND is_active = true LIMIT 1;
    ELSIF v_from_account_type = 'credit' THEN
      SELECT id INTO v_from_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '2.01.01' AND is_active = true LIMIT 1;
    END IF;

    -- Mapear conta destino para conta contábil
    IF v_to_account_type = 'checking' THEN
      SELECT id INTO v_to_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '1.01.02' AND is_active = true LIMIT 1;
    ELSIF v_to_account_type = 'savings' THEN
      SELECT id INTO v_to_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '1.01.03' AND is_active = true LIMIT 1;
    ELSIF v_to_account_type = 'investment' THEN
      SELECT id INTO v_to_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '1.01.04' AND is_active = true LIMIT 1;
    ELSIF v_to_account_type = 'credit' THEN
      SELECT id INTO v_to_chart_account_id FROM chart_of_accounts 
      WHERE user_id = p_user_id AND code = '2.01.01' AND is_active = true LIMIT 1;
    END IF;

    -- Criar journal entries: Débito conta destino / Crédito conta origem
    IF v_from_chart_account_id IS NOT NULL AND v_to_chart_account_id IS NOT NULL THEN
      INSERT INTO journal_entries (user_id, transaction_id, account_id, entry_type, amount, description, entry_date)
      VALUES 
        (p_user_id, v_outgoing_id, v_to_chart_account_id, 'debit', ABS(p_amount), p_outgoing_description, p_date),
        (p_user_id, v_outgoing_id, v_from_chart_account_id, 'credit', ABS(p_amount), p_outgoing_description, p_date);
    END IF;
  END IF;
  
  -- Recalcular saldos se completed
  IF p_status = 'completed' THEN
    PERFORM recalculate_account_balance(p_from_account_id);
    PERFORM recalculate_account_balance(p_to_account_id);
    
    SELECT balance INTO v_from_balance FROM accounts WHERE id = p_from_account_id;
    SELECT balance INTO v_to_balance FROM accounts WHERE id = p_to_account_id;
  END IF;
  
  -- Retornar sucesso
  RETURN QUERY SELECT true, ''::TEXT, v_outgoing_id, v_incoming_id, v_from_balance, v_to_balance;
END;
$$;