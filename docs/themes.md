# Themes Guide

UptimeMonitor-StatusPage includes 15 beautiful themes. Users can switch themes at any time, and the selection persists in localStorage.

## Available Themes

### Dark Themes

| Theme | Description | Best For |
|-------|-------------|----------|
| **Midnight** | Dark with emerald accents | General use (default) |
| **OLED** | Pure black background | OLED displays, battery saving |
| **Monochrome** | Pure grayscale | Minimalist preference |
| **Neon Mono** | Monochrome with neon highlights | High contrast needs |
| **Cyberpunk** | Neon pink/cyan on dark | Bold, futuristic look |

### Blue & Cool Themes

| Theme | Description | Best For |
|-------|-------------|----------|
| **Ocean** | Deep blue with cyan accents | Professional, calm |
| **Tokyo Night** | Deep blue/purple (VS Code theme) | Developers |
| **Nord** | Arctic north-bluish palette | Scandinavian aesthetic |
| **Dracula** | Dark purple with vibrant accents | Popular dark theme |

### Green & Warm Themes

| Theme | Description | Best For |
|-------|-------------|----------|
| **Forest** | Dark green with lime accents | Nature-inspired |
| **Sunset** | Warm orange/red tones | Evening viewing |

### Pink & Purple Themes

| Theme | Description | Best For |
|-------|-------------|----------|
| **Lavender** | Purple/violet tones | Soft, elegant |
| **Fuchsia** | Vibrant magenta | Bold, glamorous |
| **Rose** | Soft rose and pink hues | Elegant, subtle |
| **Sakura** | Light pink cherry-blossom | Light pink aesthetic |

## Setting the Default Theme

In `config.js`:

```javascript
globalThis.DEFAULT_THEME = "tokyonight";
```

Valid values: `midnight`, `oled`, `ocean`, `forest`, `sunset`, `lavender`, `monochrome`, `neonmono`, `cyberpunk`, `nord`, `dracula`, `tokyonight`, `fuchsia`, `rose`, `sakura`

## Theme Selector

The theme selector appears in the header on screens wider than 640px. Users can change themes at any time, and their preference is saved to localStorage.

## Creating Custom Themes

To add a custom theme, edit `src/themes.ts`:

### 1. Add Theme Name

```typescript
export type ThemeName =
  | "midnight"
  | "oled"
  // ... existing themes
  | "custom"; // Add your theme name
```

### 2. Define Theme Colors

```typescript
const customTheme: Theme = {
  name: "custom",
  displayName: "Custom Theme",
  colors: {
    // Background colors
    bgPrimary: "#0a0a0a",
    bgSecondary: "rgba(20, 20, 20, 0.5)",
    bgTertiary: "rgba(35, 35, 35, 0.5)",
    bgHover: "#1a1a1a",

    // Border colors
    borderPrimary: "#2a2a2a",
    borderSecondary: "#3a3a3a",

    // Text colors
    textPrimary: "#ffffff",
    textSecondary: "#e0e0e0",
    textMuted: "#808080",

    // Status colors
    statusUp: "#00ff00",
    statusUpText: "#00ff00",
    statusDown: "#ff0000",
    statusDownText: "#ff0000",
    statusDegraded: "#ffff00",
    statusDegradedText: "#ffff00",

    // Accent colors
    accentPrimary: "#00ffff",
    accentSecondary: "#ff00ff",
    accentTertiary: "#ffff00",

    // Chart colors
    chartUptime: "rgba(0, 255, 0, 0.8)",
    chartUptimeWarning: "rgba(255, 255, 0, 0.8)",
    chartUptimeCritical: "rgba(255, 0, 0, 0.8)",
    chartLatency: "rgba(0, 255, 255, 1)",
    chartLatencyMin: "rgba(0, 255, 0, 0.5)",
    chartLatencyMax: "rgba(255, 0, 0, 0.5)",
    chartCustom1: "rgba(0, 255, 255, 1)",
    chartCustom2: "rgba(255, 0, 255, 1)",
    chartCustom3: "rgba(255, 255, 0, 1)",

    // Scrollbar colors
    scrollbarTrack: "#0a0a0a",
    scrollbarThumb: "#2a2a2a",
    scrollbarThumbHover: "#3a3a3a",

    // Notification colors
    notificationSuccess: "rgba(0, 255, 0, 0.15)",
    notificationSuccessBorder: "#00ff00",
    notificationError: "rgba(255, 0, 0, 0.15)",
    notificationErrorBorder: "#ff0000",
    notificationWarning: "rgba(255, 255, 0, 0.15)",
    notificationWarningBorder: "#ffff00",
  },
};
```

### 3. Register the Theme

```typescript
export const themes: Record<ThemeName, Theme> = {
  midnight: midnightTheme,
  // ... existing themes
  custom: customTheme,
};

export const validThemeNames: ThemeName[] = [
  "midnight",
  // ... existing names
  "custom",
];
```

### 4. Add to HTML Selector

In `index.html`, add your theme to the selector:

```html
<option value="custom">Custom Theme</option>
```

## Color Guidelines

### Background Colors

- `bgPrimary`: Main page background
- `bgSecondary`: Cards and sections (use transparency)
- `bgTertiary`: Nested elements, modal backgrounds
- `bgHover`: Hover states for interactive elements

### Status Colors

Maintain clear visual distinction between states:

- `statusUp`: Operational services (green recommended)
- `statusDown`: Failed services (red recommended)
- `statusDegraded`: Partial issues (yellow/amber recommended)

### Chart Colors

Charts auto-adjust based on theme. Key colors:

- `chartUptime`: 99%+ uptime bars (green)
- `chartUptimeWarning`: 95-99% uptime (yellow)
- `chartUptimeCritical`: Below 95% uptime (red)
- `chartLatency`: Main latency line (blue recommended)

## CSS Custom Properties

Themes work via CSS custom properties. You can also override them directly:

```css
:root {
  --bg-primary: #your-color;
  --status-up: #your-green;
  /* ... */
}
```

See `index.css` for all available properties.
