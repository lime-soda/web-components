# Changelog

## 0.3.0

### Minor Changes

- 89da732: Add conditional debug logging using debug package
  - Replace console.log/console.warn with debug package for conditional logging
  - Add hierarchical debug namespaces: cem-plugin:css-properties,
    cem-plugin:css-properties:mapping, cem-plugin:css-properties:extraction
  - Update README with debug usage documentation
  - Only logs to console when DEBUG environment variable is set

## 0.2.0

### Minor Changes

- fe444c9: update plugin api and options

All notable changes to this project will be documented in this file.

## [0.1.0] - 2024-01-XX

### Added

- Initial release of CSS custom properties plugin
- Support for element-to-token mapping with custom functions
- Automatic CSS syntax inference from token types
- TypeScript support with full type definitions
- Comprehensive documentation and examples
