import { useState, useEffect } from 'react';
import { Input, InputProps } from "@/components/ui/input";

interface CurrencyInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value: number; // Valor em centavos
  onValueChange: (value: number) => void; // Retorna o valor em centavos
}

export function CurrencyInput({ value, onValueChange, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Formata o valor inicial (em centavos) para exibição (ex: 12345 -> "123,45")
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
    }).format(value / 100);
    setDisplayValue(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Remove tudo que não for dígito
    const digitsOnly = inputValue.replace(/\D/g, '');

    // Converte para número (centavos)
    const centsValue = Number(digitsOnly);

    // Notifica o componente pai com o novo valor em centavos
    onValueChange(centsValue);

    // Formata para exibição
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
    }).format(centsValue / 100);

    setDisplayValue(formatted);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={(e) => {
        // Seleciona todo o texto ao focar para facilitar a digitação de um novo valor
        if (Number(e.target.value.replace(/\D/g, '')) === 0) {
          e.target.select();
        }
      }}
      placeholder="0,00"
    />
  );
}