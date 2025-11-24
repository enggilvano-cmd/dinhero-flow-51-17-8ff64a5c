-- Expandir plano de contas com subcategorias para DRE conforme Lei 6.404/76
-- Adiciona contas para: Deduções da Receita, CMV, Despesas classificadas (Vendas, Administrativas, Financeiras), IR/CS

-- NOTA: Esta migração adiciona contas para usuários existentes que já têm plano de contas inicializado
-- Para novos usuários, a função initialize_chart_of_accounts será atualizada

-- Verificar e adicionar contas para cada usuário que já tem plano de contas
DO $$
DECLARE
  v_user_record RECORD;
BEGIN
  -- Para cada usuário que tem plano de contas
  FOR v_user_record IN 
    SELECT DISTINCT user_id 
    FROM chart_of_accounts 
    WHERE is_active = true
  LOOP
    -- 4.02 - DEDUÇÕES DA RECEITA BRUTA
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '4.02.01', 'Impostos sobre Vendas', 'revenue', 'debit', 'ICMS, PIS, COFINS, ISS', true),
      (v_user_record.user_id, '4.02.02', 'Devoluções de Vendas', 'revenue', 'debit', 'Devoluções e cancelamentos', true),
      (v_user_record.user_id, '4.02.03', 'Abatimentos', 'revenue', 'debit', 'Descontos incondicionais', true)
    ON CONFLICT (user_id, code) DO NOTHING;

    -- 5.02 - CUSTO DAS MERCADORIAS/SERVIÇOS VENDIDOS (CMV/CSV)
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '5.02.01', 'CMV - Custo das Mercadorias Vendidas', 'expense', 'debit', 'Custo direto das mercadorias', true),
      (v_user_record.user_id, '5.02.02', 'CSV - Custo dos Serviços Vendidos', 'expense', 'debit', 'Custo direto dos serviços', true)
    ON CONFLICT (user_id, code) DO NOTHING;

    -- 5.03 - DESPESAS COM VENDAS
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '5.03.01', 'Comissões sobre Vendas', 'expense', 'debit', 'Comissões de vendedores', true),
      (v_user_record.user_id, '5.03.02', 'Marketing e Publicidade', 'expense', 'debit', 'Propaganda e marketing', true),
      (v_user_record.user_id, '5.03.03', 'Fretes sobre Vendas', 'expense', 'debit', 'Despesas com entrega', true)
    ON CONFLICT (user_id, code) DO NOTHING;

    -- 5.04 - DESPESAS ADMINISTRATIVAS
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '5.04.01', 'Salários e Encargos', 'expense', 'debit', 'Folha de pagamento administrativa', true),
      (v_user_record.user_id, '5.04.02', 'Aluguel', 'expense', 'debit', 'Aluguel de imóveis', true),
      (v_user_record.user_id, '5.04.03', 'Água, Luz e Telefone', 'expense', 'debit', 'Utilidades e telecomunicações', true),
      (v_user_record.user_id, '5.04.04', 'Material de Escritório', 'expense', 'debit', 'Papelaria e suprimentos', true),
      (v_user_record.user_id, '5.04.05', 'Serviços de Terceiros', 'expense', 'debit', 'Consultorias, contabilidade', true),
      (v_user_record.user_id, '5.04.06', 'Depreciação', 'expense', 'debit', 'Depreciação de ativos', true)
    ON CONFLICT (user_id, code) DO NOTHING;

    -- 5.05 - DESPESAS FINANCEIRAS
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '5.05.01', 'Juros sobre Empréstimos', 'expense', 'debit', 'Juros bancários', true),
      (v_user_record.user_id, '5.05.02', 'Juros sobre Cartões', 'expense', 'debit', 'Juros de cartões de crédito', true),
      (v_user_record.user_id, '5.05.03', 'Tarifas Bancárias', 'expense', 'debit', 'Taxas e tarifas bancárias', true),
      (v_user_record.user_id, '5.05.04', 'Variação Cambial', 'expense', 'debit', 'Perdas com câmbio', true)
    ON CONFLICT (user_id, code) DO NOTHING;

    -- 6.01 - OUTRAS RECEITAS E DESPESAS (NÃO-OPERACIONAIS)
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '6.01.01', 'Ganho na Venda de Ativos', 'revenue', 'credit', 'Receitas não-operacionais', true),
      (v_user_record.user_id, '6.01.02', 'Perda na Venda de Ativos', 'expense', 'debit', 'Despesas não-operacionais', true),
      (v_user_record.user_id, '6.01.03', 'Outras Receitas Eventuais', 'revenue', 'credit', 'Receitas esporádicas', true)
    ON CONFLICT (user_id, code) DO NOTHING;

    -- 7.01 - IMPOSTOS SOBRE O LUCRO
    INSERT INTO chart_of_accounts (user_id, code, name, category, nature, description, is_active)
    VALUES 
      (v_user_record.user_id, '7.01.01', 'Provisão para IR', 'expense', 'debit', 'Imposto de Renda', true),
      (v_user_record.user_id, '7.01.02', 'Provisão para CSLL', 'expense', 'debit', 'Contribuição Social sobre Lucro', true)
    ON CONFLICT (user_id, code) DO NOTHING;

  END LOOP;
END $$;

-- Atualizar a função initialize_chart_of_accounts para incluir as novas contas
CREATE OR REPLACE FUNCTION public.initialize_chart_of_accounts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1.01 - ATIVO CIRCULANTE
  INSERT INTO public.chart_of_accounts (user_id, code, name, category, nature, description) VALUES
  (p_user_id, '1.01.01', 'Caixa', 'asset', 'debit', 'Dinheiro em caixa'),
  (p_user_id, '1.01.02', 'Bancos Conta Corrente', 'asset', 'debit', 'Saldo em contas correntes'),
  (p_user_id, '1.01.03', 'Bancos Conta Poupança', 'asset', 'debit', 'Saldo em contas poupança'),
  (p_user_id, '1.01.04', 'Investimentos', 'asset', 'debit', 'Aplicações financeiras'),
  
  -- 2.01 - PASSIVO CIRCULANTE
  (p_user_id, '2.01.01', 'Cartões de Crédito', 'liability', 'credit', 'Dívidas com cartões'),
  (p_user_id, '2.01.02', 'Fornecedores a Pagar', 'liability', 'credit', 'Contas a pagar'),
  (p_user_id, '2.01.03', 'Empréstimos a Pagar', 'liability', 'credit', 'Empréstimos de curto prazo'),
  
  -- 3.01 - PATRIMÔNIO LÍQUIDO
  (p_user_id, '3.01.01', 'Capital Próprio', 'equity', 'credit', 'Capital inicial'),
  (p_user_id, '3.02.01', 'Lucros Acumulados', 'equity', 'credit', 'Resultado acumulado'),
  
  -- 4.01 - RECEITA BRUTA
  (p_user_id, '4.01.01', 'Receita de Salários', 'revenue', 'credit', 'Receitas de salário'),
  (p_user_id, '4.01.02', 'Receita de Freelance', 'revenue', 'credit', 'Receitas de trabalho autônomo'),
  (p_user_id, '4.01.03', 'Receita de Investimentos', 'revenue', 'credit', 'Rendimentos de investimentos'),
  (p_user_id, '4.01.99', 'Outras Receitas Brutas', 'revenue', 'credit', 'Outras receitas operacionais'),
  
  -- 4.02 - DEDUÇÕES DA RECEITA BRUTA
  (p_user_id, '4.02.01', 'Impostos sobre Vendas', 'revenue', 'debit', 'ICMS, PIS, COFINS, ISS'),
  (p_user_id, '4.02.02', 'Devoluções de Vendas', 'revenue', 'debit', 'Devoluções e cancelamentos'),
  (p_user_id, '4.02.03', 'Abatimentos', 'revenue', 'debit', 'Descontos incondicionais'),
  
  -- 5.01 - DESPESAS DIVERSAS (mantido para compatibilidade)
  (p_user_id, '5.01.01', 'Alimentação', 'expense', 'debit', 'Gastos com alimentação'),
  (p_user_id, '5.01.02', 'Transporte', 'expense', 'debit', 'Gastos com transporte'),
  (p_user_id, '5.01.03', 'Moradia', 'expense', 'debit', 'Aluguel e despesas residenciais'),
  (p_user_id, '5.01.04', 'Saúde', 'expense', 'debit', 'Gastos com saúde'),
  (p_user_id, '5.01.05', 'Educação', 'expense', 'debit', 'Gastos com educação'),
  (p_user_id, '5.01.06', 'Lazer', 'expense', 'debit', 'Gastos com entretenimento'),
  (p_user_id, '5.01.07', 'Vestuário', 'expense', 'debit', 'Gastos com roupas'),
  (p_user_id, '5.01.08', 'Tecnologia', 'expense', 'debit', 'Gastos com tecnologia'),
  (p_user_id, '5.01.99', 'Outras Despesas', 'expense', 'debit', 'Outras despesas'),
  
  -- 5.02 - CMV/CSV
  (p_user_id, '5.02.01', 'CMV - Custo das Mercadorias Vendidas', 'expense', 'debit', 'Custo direto das mercadorias'),
  (p_user_id, '5.02.02', 'CSV - Custo dos Serviços Vendidos', 'expense', 'debit', 'Custo direto dos serviços'),
  
  -- 5.03 - DESPESAS COM VENDAS
  (p_user_id, '5.03.01', 'Comissões sobre Vendas', 'expense', 'debit', 'Comissões de vendedores'),
  (p_user_id, '5.03.02', 'Marketing e Publicidade', 'expense', 'debit', 'Propaganda e marketing'),
  (p_user_id, '5.03.03', 'Fretes sobre Vendas', 'expense', 'debit', 'Despesas com entrega'),
  
  -- 5.04 - DESPESAS ADMINISTRATIVAS
  (p_user_id, '5.04.01', 'Salários e Encargos', 'expense', 'debit', 'Folha de pagamento administrativa'),
  (p_user_id, '5.04.02', 'Aluguel', 'expense', 'debit', 'Aluguel de imóveis'),
  (p_user_id, '5.04.03', 'Água, Luz e Telefone', 'expense', 'debit', 'Utilidades e telecomunicações'),
  (p_user_id, '5.04.04', 'Material de Escritório', 'expense', 'debit', 'Papelaria e suprimentos'),
  (p_user_id, '5.04.05', 'Serviços de Terceiros', 'expense', 'debit', 'Consultorias, contabilidade'),
  (p_user_id, '5.04.06', 'Depreciação', 'expense', 'debit', 'Depreciação de ativos'),
  
  -- 5.05 - DESPESAS FINANCEIRAS
  (p_user_id, '5.05.01', 'Juros sobre Empréstimos', 'expense', 'debit', 'Juros bancários'),
  (p_user_id, '5.05.02', 'Juros sobre Cartões', 'expense', 'debit', 'Juros de cartões de crédito'),
  (p_user_id, '5.05.03', 'Tarifas Bancárias', 'expense', 'debit', 'Taxas e tarifas bancárias'),
  (p_user_id, '5.05.04', 'Variação Cambial', 'expense', 'debit', 'Perdas com câmbio'),
  
  -- 6.01 - OUTRAS RECEITAS E DESPESAS (NÃO-OPERACIONAIS)
  (p_user_id, '6.01.01', 'Ganho na Venda de Ativos', 'revenue', 'credit', 'Receitas não-operacionais'),
  (p_user_id, '6.01.02', 'Perda na Venda de Ativos', 'expense', 'debit', 'Despesas não-operacionais'),
  (p_user_id, '6.01.03', 'Outras Receitas Eventuais', 'revenue', 'credit', 'Receitas esporádicas'),
  
  -- 7.01 - IMPOSTOS SOBRE O LUCRO
  (p_user_id, '7.01.01', 'Provisão para IR', 'expense', 'debit', 'Imposto de Renda'),
  (p_user_id, '7.01.02', 'Provisão para CSLL', 'expense', 'debit', 'Contribuição Social sobre Lucro');
  
END;
$function$;