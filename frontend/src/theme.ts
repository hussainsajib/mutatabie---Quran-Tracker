import { createTheme } from "@mui/material/styles";

type Mode = "light" | "dark";

const FONT_UI =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** MUI theme mapped to the app's existing CSS design tokens (see index.css). */
export function buildTheme(mode: Mode) {
  const dark = mode === "dark";

  const accent = dark ? "#4dbfa5" : "#1f6f5c";
  const accentDark = dark ? "#3aa88e" : "#124a3d";
  const bg = dark ? "#121614" : "#eee7d8";
  const surface = dark ? "#1a201d" : "#fbf6ea";
  const surface2 = dark ? "#202823" : "#f4ecd6";
  const ink = dark ? "#e8e6e0" : "#2a2a28";
  const inkMuted = dark ? "#9aa59f" : "#6d6758";
  const border = dark ? "#3a4a44" : "#d9cba8";
  const accentSoft = dark
    ? "rgba(77, 191, 165, 0.16)"
    : "rgba(31, 111, 92, 0.12)";
  const accentSoftHover = dark
    ? "rgba(77, 191, 165, 0.24)"
    : "rgba(31, 111, 92, 0.2)";

  return createTheme({
    palette: {
      mode,
      primary: { main: accent, dark: accentDark, contrastText: "#ffffff" },
      background: { default: bg, paper: surface },
      text: { primary: ink, secondary: inkMuted },
      divider: border,
    },
    typography: { fontFamily: FONT_UI },
    shape: { borderRadius: 8 },
    components: {
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: border,
            backgroundColor: surface2,
            color: ink,
            fontSize: "0.65rem",
            textTransform: "none",
            "&.Mui-selected": {
              backgroundColor: accentSoft,
              color: accentDark,
            },
            "&.Mui-selected:hover": {
              backgroundColor: accentSoftHover,
            },
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              height: 30,
              minHeight: 30,
              paddingTop: 0,
              paddingBottom: 0,
              fontSize: "0.65rem",
              color: ink,
              backgroundColor: surface2,
              "& .MuiOutlinedInput-input": {
                padding: "6px 8px",
              },
              "& fieldset": {
                borderColor: border,
              },
              "&:hover fieldset": {
                borderColor: border,
              },
              "&.Mui-focused fieldset": {
                borderColor: accent,
                borderWidth: 1,
              },
            },
          },
          paper: {
            backgroundColor: surface,
            color: ink,
            border: `1px solid ${border}`,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
          },
          listbox: {
            padding: 4,
            "& .MuiAutocomplete-option": {
              fontSize: "0.65rem",
              minHeight: 32,
              borderRadius: 6,
              "&.Mui-focused": {
                backgroundColor: accentSoftHover,
              },
              "&[aria-selected='true']": {
                backgroundColor: accentSoft,
              },
            },
          },
        },
      },
    },
  });
}
