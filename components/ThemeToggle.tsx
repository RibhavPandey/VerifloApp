'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Switch } from './ui/switch'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Sun className="h-4 w-4 text-muted-foreground" />
        <Switch disabled />
        <Moon className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  const isDark = theme === 'dark'

  return (
    <div className="flex items-center gap-2">
      <Sun className={`h-4 w-4 transition-colors ${!isDark ? 'text-foreground' : 'text-muted-foreground'}`} />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => {
          setTheme(checked ? 'dark' : 'light')
        }}
      />
      <Moon className={`h-4 w-4 transition-colors ${isDark ? 'text-foreground' : 'text-muted-foreground'}`} />
    </div>
  )
}
