export function LoadingScreen({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div
      className="flex-1 flex items-center justify-center
      bg-[var(--ds-bg)] p-8"
    >
      <div className="text-center space-y-4">
        <div
          className="animate-spin w-8 h-8 border-4 border-[var(--ds-primary)]
          border-t-transparent
          rounded-full mx-auto"
        ></div>
        <p className="text-[var(--ds-fg)] text-lg">{message}</p>
      </div>
    </div>
  );
}
