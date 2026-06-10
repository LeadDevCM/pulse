interface BadgeProps {
  variant?: "success" | "warning" | "error" | "default";
  children: React.ReactNode;
}

export default function Badge({ variant = "default", children }: BadgeProps) {
  const variants = {
    success: "bg-green-100 text-success",
    warning: "bg-amber-100 text-warning",
    error: "bg-red-100 text-error",
    default: "bg-primary-light text-primary",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
