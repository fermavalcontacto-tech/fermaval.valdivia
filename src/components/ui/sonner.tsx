import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { isLegacyVariantStockError, publicQuoteErrorMessage } from "@/lib/domain/quotes.core";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  useEffect(() => {
    const originalError = toast.error.bind(toast);

    toast.error = ((message: unknown, options?: Parameters<typeof toast.error>[1]) => {
      if (isLegacyVariantStockError(message)) {
        return originalError(publicQuoteErrorMessage(message), options);
      }
      return originalError(message as never, options);
    }) as typeof toast.error;

    const removeLegacyToasts = () => {
      document.querySelectorAll<HTMLElement>("[data-sonner-toast]").forEach((node) => {
        if (isLegacyVariantStockError(node.textContent ?? "")) node.remove();
      });
    };

    removeLegacyToasts();
    const observer = new MutationObserver(removeLegacyToasts);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      toast.error = originalError as typeof toast.error;
      observer.disconnect();
    };
  }, []);

  const classNames = {
    toast:
      "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
    description: "group-[.toast]:text-muted-foreground",
    actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
    cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
    ...props.toastOptions?.classNames,
  };

  return (
    <Sonner
      className="toaster group"
      visibleToasts={6}
      gap={12}
      toastOptions={{
        ...props.toastOptions,
        classNames: {
          ...classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
