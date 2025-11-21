# Storybook Implementation Guide

## Overview

Storybook has been configured for this project to provide an isolated environment for developing and testing UI components. This setup enables:

- **Component isolation**: Develop components independently from the main application
- **Visual testing**: See all component states and variations at a glance
- **Documentation**: Automatically generate component documentation
- **Design system**: Maintain consistency across the application

## Quick Start

### Running Storybook

```bash
npm run storybook
```

This will start Storybook on `http://localhost:6006`

### Building Storybook

```bash
npm run build-storybook
```

This generates a static version of Storybook that can be deployed.

## Project Structure

```
.storybook/
├── main.ts          # Storybook configuration
└── preview.tsx      # Global decorators and parameters

src/
├── stories/
│   ├── Button.stories.tsx
│   └── Card.stories.tsx
└── components/
    └── ui/           # shadcn/ui components
```

## Configuration

### Main Configuration (`.storybook/main.ts`)

- **Stories location**: `src/**/*.stories.@(js|jsx|mjs|ts|tsx)`
- **Addons**: Essentials (docs, controls, actions, viewport, backgrounds)
- **Framework**: React with Vite
- **Aliases**: Configured to use `@/` for imports

### Preview Configuration (`.storybook/preview.tsx`)

Includes global decorators for:
- **Theme switching**: Light/dark mode toggle
- **React Query**: Query client provider
- **i18n**: Translation support
- **Router**: React Router context
- **Settings**: App settings context

## Writing Stories

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Click me",
  },
};
```

### Story Organization

Stories are organized by:
1. **UI Components**: Base design system components
2. **Feature Components**: Complex business logic components
3. **Pages**: Full page layouts

### Naming Convention

- File: `ComponentName.stories.tsx`
- Story names: Descriptive and action-oriented
  - `Default`, `WithIcon`, `Loading`, `Disabled`

## Best Practices

### 1. Component Isolation

Each story should be independent:

```typescript
export const WithCustomData: Story = {
  args: {
    user: {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
    },
  },
};
```

### 2. State Variations

Show all possible states:

```typescript
export const AllStates: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button>Default</Button>
      <Button disabled>Disabled</Button>
      <Button variant="destructive">Error</Button>
    </div>
  ),
};
```

### 3. Interactive Stories

Use actions for event handlers:

```typescript
import { action } from "@storybook/addon-actions";

export const Interactive: Story = {
  args: {
    onClick: action("button-clicked"),
  },
};
```

### 4. Documentation

Add descriptions using JSDoc:

```typescript
/**
 * Primary button component for user interactions.
 * 
 * Use this button for main call-to-action elements.
 */
export const Primary: Story = {
  args: {
    variant: "default",
    children: "Primary Action",
  },
};
```

## Existing Stories

### Button Stories (`src/stories/Button.stories.tsx`)

Covers all button variants:
- Default, Destructive, Outline, Secondary, Ghost, Link
- Size variations (sm, default, lg, icon)
- With icons
- Loading state

### Card Stories (`src/stories/Card.stories.tsx`)

Demonstrates card component usage:
- Basic card with header, content, footer
- Stat cards for metrics
- Income/Expense cards with custom styling

## Component Coverage

Currently documented:
- ✅ Button
- ✅ Card
- ✅ TransactionFilters (refactored component)
- ✅ TransactionStats (refactored component)
- ✅ TransactionActions (refactored component)
- ✅ TransactionList (refactored component)

To add:
- Badge
- Input
- Select
- Popover
- Dialog
- Table
- And more...

## Integration with Design System

Storybook is fully integrated with:
- **Tailwind CSS**: All utility classes work
- **Design tokens**: Uses semantic tokens from `index.css`
- **Theme system**: Supports light/dark mode
- **i18n**: All translations available
- **shadcn/ui**: All components styled consistently

## Development Workflow

1. **Create component** in `src/components/`
2. **Write story** in `src/stories/` or next to component
3. **Develop in isolation** using Storybook
4. **Test all states** visually
5. **Document variations** in stories
6. **Integrate** into main app

## Addons

### Installed Addons

- **Controls**: Interact with component props dynamically
- **Actions**: Log event handlers
- **Viewport**: Test responsive design
- **Backgrounds**: Test on different backgrounds
- **Docs**: Auto-generate documentation
- **Interactions**: Test user interactions

### Using Controls

Controls are automatically generated from component props:

```typescript
argTypes: {
  size: {
    control: { type: "select" },
    options: ["sm", "md", "lg"],
  },
  disabled: {
    control: "boolean",
  },
  onClick: { action: "clicked" },
}
```

## Performance

Storybook is configured with:
- **Vite**: Fast HMR and builds
- **Code splitting**: Only load necessary stories
- **Lazy loading**: Components loaded on demand

## Deployment

Build and deploy Storybook as a static site:

```bash
# Build
npm run build-storybook

# Deploy the storybook-static/ folder
# Can be hosted on Vercel, Netlify, GitHub Pages, etc.
```

## Tips

1. **Use play functions** for complex interactions
2. **Mock API calls** in stories
3. **Test edge cases** (empty states, errors, loading)
4. **Keep stories simple** - one concern per story
5. **Use decorators** for common wrappers
6. **Document accessibility** features

## Troubleshooting

### Issue: Stories not loading

Check that:
- Story files match the glob pattern in `main.ts`
- Component exports are correct
- No TypeScript errors

### Issue: Styles not working

Ensure:
- `index.css` is imported in `preview.tsx`
- Tailwind config is correct
- Theme provider is active

### Issue: Translations missing

Verify:
- i18n is initialized in `preview.tsx`
- Translation keys exist in locale files
- Language is set correctly

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Writing Stories](https://storybook.js.org/docs/react/writing-stories/introduction)
- [Component Story Format](https://storybook.js.org/docs/react/api/csf)
- [Addons](https://storybook.js.org/docs/react/addons/introduction)
