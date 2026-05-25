import { Move, Square, TriangleRight } from "lucide-react";
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { buttonClass } from "@nakamura196/react-ui";

interface ToolBarProps {
  tool: "rectangle" | "polygon" | undefined;
  setTool: (tool: "rectangle" | "polygon" | undefined) => void;
}

const kbdClass =
  "ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-mono rounded bg-black/10 dark:bg-white/15";

export function ToolBar({ tool, setTool }: ToolBarProps) {
  const t = useTranslations('Editor.tools');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/contenteditable
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      let handled = false;

      switch (key) {
        case 'm':
          setTool(undefined);
          handled = true;
          break;
        case 'b':
          setTool('rectangle');
          handled = true;
          break;
        case 'p':
          setTool('polygon');
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        // Remove focus from any focused element to prevent blue outline
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  const toolBtn = (active: boolean) =>
    buttonClass(
      active ? "primary" : "secondary",
      "sm",
      "min-w-[80px] sm:min-w-[100px]"
    );

  return (
    <div
      className="px-2 sm:px-4 py-2 sm:py-3 bg-[var(--ds-surface)]
      border-b border-[var(--ds-border)]"
    >
      <div className="flex flex-wrap gap-2">
        <button className={toolBtn(tool === undefined)} onClick={() => setTool(undefined)}>
          <Move className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> {t('move')}
          <kbd className={kbdClass}>M</kbd>
        </button>
        <button className={toolBtn(tool === "rectangle")} onClick={() => setTool("rectangle")}>
          <Square className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> {t('rectangle')}
          <kbd className={kbdClass}>B</kbd>
        </button>
        <button className={toolBtn(tool === "polygon")} onClick={() => setTool("polygon")}>
          <TriangleRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> {t('polygon')}
          <kbd className={kbdClass}>P</kbd>
        </button>
      </div>
    </div>
  );
}
