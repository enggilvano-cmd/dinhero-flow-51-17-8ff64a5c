# Scripts de Teste

Para adicionar os scripts de teste ao `package.json`, adicione manualmente na seção "scripts":

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Comandos disponíveis:

- `npm run test` - Executa os testes em modo watch
- `npm run test:ui` - Abre interface gráfica dos testes
- `npm run test:coverage` - Gera relatório de cobertura
