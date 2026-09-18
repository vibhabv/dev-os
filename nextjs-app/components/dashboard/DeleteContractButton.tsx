'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface DeleteContractButtonProps {
  contractId: string
  onDeleted: () => void
  iconOnly?: boolean
}

export function DeleteContractButton({ contractId, onDeleted, iconOnly }: DeleteContractButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/contracts/${contractId}`, { method: 'DELETE' })
    setDeleting(false)

    if (!res.ok) {
      toast.error('Could not delete this contract. Please try again.')
      return
    }

    setConfirming(false)
    onDeleted()
  }

  return (
    <>
      <Button
        variant="ghost"
        size={iconOnly ? 'icon' : 'sm'}
        onClick={(e) => {
          e.stopPropagation()
          setConfirming(true)
        }}
        aria-label="Delete contract"
        className="text-grey-400 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
        {!iconOnly && 'Delete'}
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete this contract?</DialogTitle>
            <DialogDescription>
              This permanently deletes this contract and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
