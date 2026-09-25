'use client'

import { useState, useSyncExternalStore } from 'react'
import { Palette, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { themes, getStoredTheme, setStoredTheme } from '@/lib/themes'

const subscribeNoop = () => () => {}

export function ThemeSelector() {
  // false au rendu serveur, true côté client : évite un décalage d'hydratation
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const [selectedTheme, setCurrentTheme] = useState<string | null>(null)
  const currentTheme = selectedTheme ?? (mounted ? getStoredTheme() : 'blue')

  const handleThemeChange = (themeName: string) => {
    setCurrentTheme(themeName)
    setStoredTheme(themeName)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm">
        <Palette className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Palette className="h-5 w-5" />
          <span className="hidden sm:inline">Thème</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Choisir un thème</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-1 gap-1 p-1">
          {Object.values(themes).map((theme) => (
            <DropdownMenuItem
              key={theme.name}
              onClick={() => handleThemeChange(theme.name)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3 w-full">
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                  style={{
                    backgroundColor: `hsl(${theme.colors.primary})`,
                  }}
                />
                <span className="flex-1">{theme.label}</span>
                {currentTheme === theme.name && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
