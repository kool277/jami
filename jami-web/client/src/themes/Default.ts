/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */
import { alpha, createTheme, Direction, PaletteMode } from '@mui/material'
import { TypographyVariantsOptions } from '@mui/material/styles'
import { type Theme as EmojiTheme } from 'emoji-picker-react'

const lightEmojiTheme = 'light' as EmojiTheme
const darkEmojiTheme = 'dark' as EmojiTheme

declare module '@mui/material/styles' {
  interface Theme {
    EmojiPicker: {
      backgroundColor: EmojiTheme
    }
    Panel: {
      outerBackground: string
      borderRadius: string
      padding: string
      shadow: string
      itemBorderRadius: string
      itemPadding: string
    }
  }
}

const palettes = {
  light: {
    palette: {
      mode: 'light' as PaletteMode,
      primary: {
        light: '#E5EEF5', // same as "#0056991A"
        main: '#0071C9',
        dark: '#005699',
      },
      error: {
        main: '#CC0022',
        dark: '#720013',
      },
      success: {
        main: '#00705E',
      },
      secondary: {
        main: '#A3C2DA',
        dark: '#06493F',
      },
      action: {
        disabled: '#7F7F7F',
      },
      background: {
        default: '#FEFCF9',
        paper: '#FAF6F0',
      },
      text: {
        primary: '#1A1A1A',
        secondary: '#5C5C5C',
      },
    },
    EmojiPicker: {
      backgroundColor: lightEmojiTheme,
    },
    Panel: {
      outerBackground: '#E8E2D8',
      borderRadius: '32px',
      padding: '8px',
      shadow: '0 2px 16px rgba(0, 0, 0, 0.06)',
      itemBorderRadius: '24px',
      itemPadding: '4px',
    },
  },
  dark: {
    palette: {
      mode: 'dark' as PaletteMode,
      // The ramp inverts between modes on purpose. `light` is always the subtle surface
      // tint and `dark` always the strong accent, so on dark surfaces they swap lightness,
      // the same way a Material tonal palette moves from tone 40 to tone 80.
      primary: {
        light: '#0A2A40',
        main: '#5CB8FF',
        dark: '#8FCBFF',
      },
      error: {
        main: '#FF6B7A',
        dark: '#FFA0A9',
      },
      success: {
        main: '#4FD1B4',
      },
      secondary: {
        main: '#A3C2DA',
        dark: '#CBDEEC',
      },
      action: {
        disabled: '#7F7F7F',
      },
      background: {
        default: '#050505',
        paper: '#181818',
      },
      text: {
        primary: '#F5F5F5',
        secondary: '#B3B3B3',
      },
    },
    EmojiPicker: {
      backgroundColor: darkEmojiTheme,
    },
    Panel: {
      outerBackground: '#0A0A0A',
      borderRadius: '32px',
      padding: '8px',
      shadow: '0 2px 16px rgba(0, 0, 0, 0.25)',
      itemBorderRadius: '24px',
      itemPadding: '4px',
    },
  },
}

// One step is 8px. Declared rather than left to the MUI default so the grid is a stated decision:
// layout reaches for the scale (`gap: 1`, `p: 2`) instead of pixel strings, which is what keeps the
// competing 5/10/15px rhythm from creeping back in.
const spacing = 8

const typography: TypographyVariantsOptions = {
  fontFamily: '"Ubuntu", "Helvetica", "Arial", sans-serif',
  // Sizes are expressed in rem and line heights are unitless so the scale follows the
  // reader's browser font size instead of overriding it.
  h1: { fontWeight: 400, fontSize: '1.625rem', lineHeight: 1.38 },
  h2: { fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.36 },
  h3: { fontWeight: 400, fontSize: '1.125rem', lineHeight: 1.44 },
  h4: { fontWeight: 500, fontSize: '0.9375rem', lineHeight: 1.47 },
  h5: { fontWeight: 500, fontSize: '0.8125rem', lineHeight: 1.46 },
  body1: { fontWeight: 400, fontSize: '0.9375rem', lineHeight: 1.47 },
  body2: { fontWeight: 400, fontSize: '0.8125rem', lineHeight: 1.46 },
  caption: { fontWeight: 400, fontSize: '0.75rem', lineHeight: 1.33 },
  button: { fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.13, textTransform: 'none' },
}

export const buildDefaultTheme = (mode: PaletteMode, direction: Direction) => {
  // Typography must be declared in the first `createTheme` call: MUI resolves `fontFamily` into
  // each variant at creation time, so a later merge would leave every variant on the default font.
  const partialTheme = createTheme({ ...palettes[mode], direction, typography, spacing })
  const palette = partialTheme.palette
  // The button accent is the strong end of the primary ramp in both modes, so it stays in step
  // with the palette instead of drifting into a colour of its own.
  const accent = palette.primary.dark
  const onAccent = palette.getContrastText(accent)
  const BaseButton = {
    interaction: {
      hoverBackgroundColor: alpha(accent, 0.92),
      activeBackgroundColor: alpha(accent, 0.8),
      foregroundColor: onAccent,
    },
    contained: { color: onAccent, backgroundColor: accent },
    outlined: { color: accent, backgroundColor: 'transparent', borderColor: accent },
    text: { color: palette.text.primary, backgroundColor: 'transparent' },
  }
  const Panel = partialTheme.Panel
  const isDark = mode === 'dark'

  // Unified shadow system
  const shadows = {
    subtle: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
    low: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
    medium: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 24px rgba(0,0,0,0.10)',
    high: isDark ? '0 8px 40px rgba(0,0,0,0.6)' : '0 8px 40px rgba(0,0,0,0.12)',
    float: isDark
      ? '0 2px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
      : '0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
  }

  return createTheme(partialTheme, {
    shape: {
      borderRadius: 20,
    },
    shadows: (() => {
      const s = [...Array(25)].map(() => 'none') as string[]
      s[1] = shadows.subtle
      s[2] = shadows.low
      s[3] = shadows.medium
      s[4] = shadows.high
      s[8] = shadows.float
      return s
    })(),
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            height: '35px',
            borderRadius: '9999px',
            transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
            '&.Mui-focusVisible': {
              outline: '2px solid currentColor',
              outlineOffset: '2px',
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
            // Text buttons need contained-equivalent padding because they do not have an outlined border.
            '&.MuiButton-text': {
              padding: '6px 16px',
            },
            '&.MuiButton-text.MuiButton-sizeSmall': {
              padding: '4px 10px',
            },
            '&.MuiButton-text.MuiButton-sizeLarge': {
              padding: '8px 22px',
            },
          },
          sizeSmall: {
            height: '26px',
          },
          contained: {
            color: BaseButton.contained.color,
            background: BaseButton.contained.backgroundColor,
            '&:hover': {
              background: BaseButton.interaction.hoverBackgroundColor,
            },
            '&:active': {
              background: BaseButton.interaction.activeBackgroundColor,
            },
            '&.MuiButton-colorError': {
              color: palette.getContrastText(palette.error.main),
              background: palette.error.main,
              '&:hover': {
                background: palette.error.dark,
              },
            },
          },
          outlined: {
            background: BaseButton.outlined.backgroundColor,
            borderColor: BaseButton.outlined.borderColor,
            color: BaseButton.outlined.color,
            '&:hover': {
              background: BaseButton.interaction.hoverBackgroundColor,
              borderColor: BaseButton.interaction.hoverBackgroundColor,
              color: BaseButton.interaction.foregroundColor,
            },
            '&:active': {
              background: BaseButton.interaction.activeBackgroundColor,
              borderColor: BaseButton.interaction.activeBackgroundColor,
              color: BaseButton.interaction.foregroundColor,
            },
          },
          text: {
            background: BaseButton.text.backgroundColor,
            color: BaseButton.text.color,
            '&:hover': {
              background: BaseButton.interaction.hoverBackgroundColor,
              color: BaseButton.interaction.foregroundColor,
            },
            '&:active': {
              background: BaseButton.interaction.activeBackgroundColor,
              color: BaseButton.interaction.foregroundColor,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: Panel.itemBorderRadius,
            boxShadow: shadows.low,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: Panel.itemBorderRadius,
          },
          elevation1: { boxShadow: shadows.subtle },
          elevation2: { boxShadow: shadows.low },
          elevation3: { boxShadow: shadows.medium },
          elevation4: { boxShadow: shadows.high },
          elevation8: { boxShadow: shadows.float },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            padding: '16px',
            boxShadow: shadows.high,
            borderRadius: '24px',
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: '0px',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '0px',
            margin: '16px 0px',
            minWidth: '500px',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: '0px',
          },
        },
      },
      MuiSwitch: {
        defaultProps: {
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            width: '55px',
            height: '28px',
            padding: 0,
          },
          switchBase: {
            border: 'none',
            marginTop: '2px',
            marginLeft: '2px',
            padding: 0,
            '&.Mui-checked': {
              marginLeft: '-1px',
              transform: `translateX(30px)`,
            },
          },
          thumb: {
            boxSizing: 'border-box',
            width: '24px',
            height: '24px',
            boxShadow: 'none',
            '.Mui-checked.Mui-checked &': {
              border: 'none',
            },
          },
          track: {
            backgroundColor: '#c2cad1',
            borderRadius: '25px',
            opacity: 1,
            '.Mui-checked.Mui-checked + &': {
              backgroundColor: palette.primary.dark,
              opacity: 1,
            },
          },
          colorPrimary: {
            color: 'white',
            '&.Mui-checked': {
              color: 'white',
            },
          },
        },
      },
      MuiInput: {
        styleOverrides: {
          root: {
            color: palette.text.primary,
            '&.Mui-error': {
              color: palette.error.main,
            },
          },
          underline: {
            '&:before': {
              borderBottom: `2px solid ${palette.primary.dark}`,
            },
            '&:hover:not(.Mui-disabled, .Mui-error):before': {
              borderBottom: '2px solid #03B9E9',
            },
            '&:after': {
              borderBottom: '2px solid #03B9E9',
            },
            '&:hover:not(.Mui-error):after': {
              borderBottom: '2px solid #03B9E9',
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            marginBottom: '12px',
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            textAlign: 'center',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: palette.text.primary,
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            color: palette.primary.dark,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: '50%',
            color: palette.text.secondary,
            transition: 'background-color 150ms ease, color 150ms ease',
            '&:hover': {
              backgroundColor: palette.action.hover,
            },
            '&.Mui-disabled': {
              color: palette.action.disabled,
            },
            '&.Mui-focusVisible': {
              outline: '2px solid currentColor',
              outlineOffset: '2px',
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: '9999px',
            '& .MuiInputAdornment-root, & .MuiInputAdornment-root .MuiIcon-root': {
              color: palette.text.secondary,
              transition: 'color 240ms ease-in-out',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              transition: 'border-color 240ms ease-in-out',
            },
            '&.Mui-focused .MuiInputAdornment-root, &.Mui-focused .MuiInputAdornment-root .MuiIcon-root': {
              color: palette.primary.main,
            },
            '@media (prefers-reduced-motion: reduce)': {
              '& .MuiInputAdornment-root, & .MuiInputAdornment-root .MuiIcon-root, & .MuiOutlinedInput-notchedOutline':
                {
                  transition: 'none',
                },
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '9999px',
            '&.Mui-selected': {
              backgroundColor: palette.primary.light,
              '&:hover': {
                backgroundColor: palette.primary.light,
              },
            },
            '&:hover': {
              backgroundColor: alpha(palette.primary.light, 0.5),
            },
          },
        },
      },
    },
  })
}
