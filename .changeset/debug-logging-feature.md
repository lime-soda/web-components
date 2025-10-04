---
'@lime-soda/cem-plugin-css-properties': minor
---

Add conditional debug logging using debug package

- Replace console.log/console.warn with debug package for conditional logging
- Add hierarchical debug namespaces: cem-plugin:css-properties,
  cem-plugin:css-properties:mapping, cem-plugin:css-properties:extraction
- Update README with debug usage documentation
- Only logs to console when DEBUG environment variable is set
