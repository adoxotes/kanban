export const COLORS = {
  background: {
    dark: "#1e1e1e",
    panel: "#252526",
    card: "#2d2d2d",
    input: "#3c3c3c",
    hover: "#37373d",
    active: "#264f78",
  },
  border: {
    default: "#3c3c3c",
    accent: "#007acc",
    hover: "#4b4b4b",
  },
  text: {
    primary: "#cccccc",
    secondary: "#858585",
    muted: "#6b6b6b",
    white: "#ffffff",
    accent: "#007acc",
    error: "#f87171", // red-400 equivalent for hover
  },
  accent: {
    blue: "#007acc",
    blueHover: "#118ad4",
    red: "#dc2626", // red-600
    redHover: "#b91c1c", // red-700
  },
} as const;
