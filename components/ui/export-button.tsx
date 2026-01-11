"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface ExportButtonProps {
    onExport?: () => void | Promise<void>
    fileName?: string
    variant?: "primary" | "secondary" | "accent"
    className?: string
}

export function ExportButton({
    onExport,
    fileName = "export",
    variant = "primary",
    className = "",
}: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)

    const handleExport = async () => {
        setIsExporting(true)
        try {
            if (onExport) {
                await onExport()
            }
        } catch (error) {
            console.error("Export failed:", error)
        } finally {
            setIsExporting(false)
        }
    }

    const variantStyles = {
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 focus:ring-accent",
    }

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`
        relative inline-flex items-center justify-center gap-2 px-6 py-2
        ${variantStyles.accent}
        font-semibold text-sm
        border-0 border-current
        shadow-md transition-all duration-300
        hover:shadow-md active:shadow-none active:translate-y-1
        disabled:opacity-60 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${className}
      `}
        >
            <Download size={16} className={`transition-transform duration-300 ${isExporting ? "animate-bounce" : ""}`} />
            <span>{isExporting ? "Exporting..." : "Export"}</span>
        </button>
    )
}

    

