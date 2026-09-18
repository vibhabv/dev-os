import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TERM_GLOSSARY } from '@/lib/constants/termGlossary'

interface TermGlossaryTooltipProps {
  termName: string
}

export function TermGlossaryTooltip({ termName }: TermGlossaryTooltipProps) {
  const definition = TERM_GLOSSARY[termName]
  if (!definition) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`What is ${termName}?`} className="text-grey-400 hover:text-grey-600">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{definition}</TooltipContent>
    </Tooltip>
  )
}
