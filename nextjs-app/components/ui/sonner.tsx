'use client'

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-grey-900 group-[.toaster]:border-grey-100 group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg',
          description: 'group-[.toast]:text-grey-500',
          actionButton: 'group-[.toast]:bg-blue-500 group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-grey-50 group-[.toast]:text-grey-700',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
