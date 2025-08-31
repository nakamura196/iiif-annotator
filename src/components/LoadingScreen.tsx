export function LoadingScreen({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div
      className="flex-1 flex items-center justify-center 
      bg-white dark:bg-gray-900 p-8"
    >
      <div className="text-center space-y-4">
        <div
          className="animate-spin w-8 h-8 border-4 border-blue-500 
          dark:border-blue-400 border-t-transparent dark:border-t-transparent 
          rounded-full mx-auto"
        ></div>
        <p className="text-gray-900 dark:text-gray-100 text-lg">{message}</p>
      </div>
    </div>
  );
}
