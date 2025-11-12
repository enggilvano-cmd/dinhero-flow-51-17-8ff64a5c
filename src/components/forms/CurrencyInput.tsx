import { useState, useEffect, useCallback, InputHTMLAttributes } from 'react';
import { Input } from "@/components/ui/input";

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 });
interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number; // Valor em centavos
  onValueChange: (value: number) => void; // Retorna o valor em centavos
}

export function CurrencyInput({ value, onValueChange, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => BRL_FORMATTER.format(value / 100));

  useEffect(() => {
    // Sincroniza o valor exibido se o valor externo (prop) mudar.
    const formattedValue = BRL_FORMATTER.format(value / 100);
    if (displayValue !== formattedValue) {
      setDisplayValue(formattedValue);
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value: inputValue } = e.target;

    // Remove todos os caracteres não numéricos.
    const digitsOnly = inputValue.replace(/\D/g, '');

    // Remove zeros à esquerda para evitar problemas de conversão (ex: "0050" -> "50")
    const numericString = digitsOnly.replace(/^0+/, '');

    if (!numericString) {
      onValueChange(0);
      setDisplayValue('');
      return;
    }

    // Converte a string de dígitos para um número.
    const centsValue = parseInt(numericString, 10);
    onValueChange(centsValue);
  }, [onValueChange]);

  return (
    <Input
      {...props}
      type="tel" // "tel" é melhor para teclados numéricos em mobile
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={(e) => {
        e.target.select();
      }}
      placeholder="0,00"
    />
  );
}