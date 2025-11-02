import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import * as diff_match_patch from "diff-match-patch";

interface DiffHighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  previousContent?: string | null;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function DiffHighlightedTextarea({
  value,
  onChange,
  previousContent,
  placeholder,
  className,
  "data-testid": dataTestId,
}: DiffHighlightedTextareaProps) {
  const [showHighlight, setShowHighlight] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and overlay
  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Calculate diff and render highlighted content
  const renderHighlightedContent = () => {
    if (!previousContent || !showHighlight) {
      return null;
    }

    const dmp = new diff_match_patch.diff_match_patch();
    const diffs = dmp.diff_main(previousContent, value);
    dmp.diff_cleanupSemantic(diffs);

    return (
      <>
        {diffs.map((diff, index) => {
          const [operation, text] = diff;
          
          if (operation === diff_match_patch.DIFF_INSERT) {
            // Show additions with green background only (text transparent so cursor remains visible)
            return (
              <span
                key={index}
                className="bg-green-500/20 text-transparent"
              >
                {text}
              </span>
            );
          } else if (operation === diff_match_patch.DIFF_DELETE) {
            // Don't render deletions - they would occlude current text
            // User can use the "Comparação" tab to see full diff
            return null;
          } else {
            // Unchanged text: render invisibly to maintain layout alignment
            return (
              <span key={index} className="text-transparent">
                {text}
              </span>
            );
          }
        })}
      </>
    );
  };

  // Show/hide highlight based on whether there are changes
  useEffect(() => {
    setShowHighlight(!!previousContent);
  }, [previousContent]);

  // Sync overlay scroll position when highlights are shown or content changes
  // Use layoutEffect to sync before paint, ensuring immediate alignment
  useLayoutEffect(() => {
    if (showHighlight && textareaRef.current && overlayRef.current) {
      // Use requestAnimationFrame to ensure refs are fully populated
      requestAnimationFrame(() => {
        if (textareaRef.current && overlayRef.current) {
          overlayRef.current.scrollTop = textareaRef.current.scrollTop;
          overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
      });
    }
  }, [showHighlight, value, previousContent]);

  return (
    <div className="relative flex-1">
      {/* Overlay with highlighted diff */}
      {previousContent && showHighlight && (
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-auto pointer-events-none"
          style={{
            padding: "0.75rem",
          }}
        >
          <div className="font-mono text-sm whitespace-pre-wrap break-words">
            {renderHighlightedContent()}
          </div>
        </div>
      )}

      {/* Actual textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className={className}
        placeholder={placeholder}
        data-testid={dataTestId}
      />

      {/* Toggle button to show/hide highlights */}
      {previousContent && (
        <button
          type="button"
          onClick={() => setShowHighlight(!showHighlight)}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-background/80 hover-elevate active-elevate-2 border rounded-md"
          data-testid="button-toggle-highlight"
        >
          {showHighlight ? "Ocultar Mudanças" : "Mostrar Mudanças"}
        </button>
      )}
    </div>
  );
}
