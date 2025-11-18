# Sparkbook Style Guide

A comprehensive design system for the Sparkbook app.

## Color Palette

### Primary Colors
- **Primary Blue**: `#336BC8` - Main brand color, used for primary actions and headers
- **Secondary Gold**: `#D4A518` - Accent color for highlights and secondary actions

### Accent Colors
- **Purple/Blue**: `#919FD5` - Used for subtle accents and secondary UI elements
- **Light Blue**: `#E8EFFF` - Backgrounds and light emphasis

## Typography

### Font Family
**Inter** is the primary font family with the following weights:
- Regular (400)
- Medium (500)
- Semi Bold (600)
- Bold (700)

### Font Sizes
- `xs`: 12px - Small labels, captions
- `sm`: 14px - Secondary text, buttons
- `base`: 16px - Body text, standard UI
- `lg`: 18px - Subheadings, emphasized text
- `xl`: 20px - Section headers
- `xxl`: 24px - Page subheadings
- `xxxl`: 32px - Page titles
- `display`: 40px - Hero text, special displays

## Spacing

Using an 8px grid system:
- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `xxl`: 48px
- `xxxl`: 64px

## Usage

### Importing the Theme

```javascript
import theme from './styles/theme';
```

### Using Colors

```javascript
const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.primary,
  },
});
```

### Using Typography

```javascript
const styles = StyleSheet.create({
  heading: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.fontSize.xxxl,
  },
  body: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.base,
  },
});
```

### Using Spacing

```javascript
const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
});
```

### Using Component Styles

Pre-defined component styles are available:

```javascript
const styles = StyleSheet.create({
  button: {
    ...theme.components.button.primary,
  },
  card: {
    ...theme.components.card,
  },
  input: {
    ...theme.components.input,
  },
});
```

## Components

### Button Variants
- **Primary**: Blue background, white text
- **Secondary**: Gold background, white text
- **Outline**: Transparent with blue border

### Cards
Pre-styled cards with shadow, padding, and border radius.

### Inputs
Standard input styling with border and proper padding.

## Best Practices

1. **Always use theme values** instead of hardcoded colors or sizes
2. **Use the spacing scale** for consistent margins and padding
3. **Follow the typography scale** for text sizes
4. **Apply font families** to all text elements for consistency
5. **Use shadow presets** for elevation effects
