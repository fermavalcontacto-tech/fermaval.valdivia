import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
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
