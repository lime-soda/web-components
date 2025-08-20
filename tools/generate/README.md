# @lime-soda/generate

Component generator for the Lime Soda design system using Plop.js.

## Usage

Generate a new web component interactively:

```bash
# From the root of the monorepo
pnpm create-component
```

This will prompt you for:

- Component name (e.g., "Button", "Card", "Modal")
- Component description
- Whether to include example attributes/properties

## What gets generated

The generator creates a complete component package with:

### Package Structure

```
packages/your-component/
├── README.md              # Component documentation
├── package.json           # Package configuration
├── tsconfig.json         # TypeScript configuration
├── tsconfig.types.json   # Type declaration configuration
├── eslint.config.js      # ESLint configuration
└── src/
    └── index.ts          # Component implementation
```

### Generated Files

- **README.md** - Component documentation template with usage examples
- **package.json** - Configured for web component publishing with proper exports
- **tsconfig files** - TypeScript configuration extending monorepo defaults
- **eslint.config.js** - ESLint configuration using shared config
- **src/index.ts** - Lit-based web component starter with TypeScript decorators

## Templates

Templates are stored in `templates/` and use Handlebars syntax:

- `README.md.hbs` - Component documentation template
- `package.json.hbs` - Package configuration template
- `src/index.ts.hbs` - Component implementation template
- Configuration files for TypeScript and ESLint

## Integration

The generator integrates with the monorepo tooling:

- Uses shared TypeScript configuration (`@lime-soda/tsconfig`)
- Uses shared ESLint configuration (`@lime-soda/eslint-config`)
- Uses shared build tool (`@lime-soda/build`)
- Follows monorepo package naming conventions
- Configures proper workspace dependencies

## Dependencies

- **plop** - Micro-generator framework for scaffolding
- **Handlebars templates** - For dynamic file generation
- **Interactive prompts** - For collecting component details
