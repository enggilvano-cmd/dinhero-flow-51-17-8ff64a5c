import React from 'react'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form'
import { PatternFormat, OnValueChange } from 'react-number-format'

// Interface para as props
interface CurrencyInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName
  label: string
  placeholder?: string
  description?: string
  // Recebe o 'field' diretamente do render-prop do FormField
  field: ControllerRenderProps<TFieldValues, TName>
}

/**
 * Componente de Input de Moeda.
 * Lida com a conversão entre centavos (BIGINT) no estado e R$ (string) na UI.
 */
export function CurrencyInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  label,
  placeholder,
  description,
  field, // Usa o 'field' passado como prop
}: CurrencyInputProps<TFieldValues, TName>) {
  
  // Converte centavos (ex: 10050) para float (ex: 100.50) para o input
  const displayValue =
    typeof field.value === 'number' ? field.value / 100 : undefined

  // Converte o valor do input (float) para centavos (int) para o form state
  const handleValueChange: OnValueChange = (values) => {
    // Arredonda para o inteiro mais próximo para evitar problemas de float
    const centsValue = Math.round(Number(values.floatValue) * 100)
    field.onChange(centsValue) // Chama o onChange do React Hook Form
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <PatternFormat
          customInput={Input}
          name={name}
          ref={field.ref}
          value={displayValue} // Valor formatado para exibição
          onValueChange={handleValueChange} // Função que atualiza o estado em centavos
          onBlur={field.onBlur}
          format="R$ #,##0.00"
          mask="_"
          thousandSeparator="."
          decimalSeparator=","
          prefix="R$ "
          placeholder={placeholder || 'R$ 0,00'}
          allowNegative={false}
        />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  )
}