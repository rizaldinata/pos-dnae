"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        success: "border-emerald-600 bg-emerald-600 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ToastData extends VariantProps<typeof toastVariants> {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: ToastData }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

interface State {
  toasts: ToastData[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

let memoryState: State = { toasts: [] };
const listeners: Array<(state: State) => void> = [];

function dispatch(action: ToastAction) {
  switch (action.type) {
    case "ADD_TOAST":
      memoryState = {
        ...memoryState,
        toasts: [action.toast, ...memoryState.toasts].slice(0, 5),
      };
      break;
    case "DISMISS_TOAST":
      memoryState = {
        ...memoryState,
        toasts: memoryState.toasts.filter((t) => t.id !== action.toastId),
      };
      break;
    case "REMOVE_TOAST":
      memoryState = {
        ...memoryState,
        toasts: memoryState.toasts.filter((t) => t.id !== action.toastId),
      };
      break;
  }

  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

export function toast(props: Omit<ToastData, "id">) {
  const id = genId();

  const update = (props: ToastData) =>
    dispatch({
      type: "ADD_TOAST",
      toast: { ...props, id },
    });

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  update({ ...props, id });

  const duration = props.duration ?? 4000;
  if (duration > 0) {
    const timeout = setTimeout(() => {
      dismiss();
    }, duration);
    toastTimeouts.set(id, timeout);
  }

  return {
    id,
    dismiss,
  };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map(function ({ id, title, description, variant }) {
        return (
          <div
            key={id}
            className={cn(
              toastVariants({ variant }),
              "mb-2 animate-in slide-in-from-top-full sm:slide-in-from-bottom-full"
            )}
          >
            <div className="grid gap-1">
              {title && <div className="text-sm font-semibold">{title}</div>}
              {description && (
                <div className="text-sm opacity-90">{description}</div>
              )}
            </div>
            <button
              onClick={() => dismiss(id)}
              className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
