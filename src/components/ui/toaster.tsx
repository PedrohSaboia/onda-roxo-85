import * as React from 'react'
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CircleCheck, X } from 'lucide-react'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  const ProgressBar: React.FC<{ duration: number; destructive?: boolean; onFinish?: () => void }> = ({ duration, destructive, onFinish }) => {
    const [width, setWidth] = React.useState<string>('100%')

    React.useEffect(() => {
      // start transition on next tick
      const startId = setTimeout(() => setWidth('0%'), 10)
      // call onFinish when duration completes
      const finishId = setTimeout(() => onFinish?.(), duration)
      return () => {
        clearTimeout(startId)
        clearTimeout(finishId)
      }
    }, [duration, onFinish])

    return (
      <div
        aria-hidden
        // position the progress bar near the bottom of the toast (full width inset)
        className={
          destructive
            ? 'absolute left-2 right-2 bottom-1 h-1 rounded-full bg-red-500'
            : 'absolute left-2 right-2 bottom-1 h-1 rounded-full bg-emerald-500'
        }
        style={{ width, transition: `width ${duration}ms linear` }}
      />
    )
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props as any)?.variant
        const isDestructive = variant === 'destructive'
  const durationMs = (props as any)?.durationMs ?? 4000

        return (
          <Toast key={id} {...props}>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center">
                {isDestructive ? (
                  <X className="h-6 w-6 text-red-500" />
                ) : (
                  <CircleCheck className="h-6 w-6 text-emerald-500" />
                )}
              </div>

              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>

              {action}
              <ToastClose />
            </div>
            <ProgressBar duration={durationMs} destructive={isDestructive} onFinish={() => dismiss(id)} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
