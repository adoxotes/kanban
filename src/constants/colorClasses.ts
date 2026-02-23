import { COLORS } from "./colors";

export const COLOR_CLASSES = {
  text: {
    secondary: `text-[${COLORS.text.secondary}]`,
    primaryHover: `hover:text-[${COLORS.text.primary}]`,
    accent: `text-[${COLORS.text.accent}]`,
    accentGroupHover: `group-hover:text-[${COLORS.text.accent}]`,
  },
  bg: {
    panel: `bg-[${COLORS.background.panel}]`,
    card: `bg-[${COLORS.background.card}]`,
    input: `bg-[${COLORS.background.input}]`,
    hover: `hover:bg-[${COLORS.background.hover}]`,
    accent: `bg-[${COLORS.accent.blue}]`,
    accentHover: `hover:bg-[${COLORS.accent.blueHover}]`,
  },
  border: {
    default: `border-[${COLORS.border.default}]`,
    accent: `border-[${COLORS.border.accent}]`,
  },
  ring: {
    accent: `focus-visible:ring-[${COLORS.accent.blue}]`,
  },
} as const;
