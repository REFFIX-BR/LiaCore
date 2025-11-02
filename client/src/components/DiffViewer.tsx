import * as diff_match_patch from "diff-match-patch";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function DiffViewer({ oldText, newText, className, showLineNumbers = false }: DiffViewerProps) {
  const dmp = new diff_match_patch.diff_match_patch();
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  // Split into lines for better visualization
  const lines: { type: 'add' | 'delete' | 'equal', content: string }[] = [];
  
  diffs.forEach((diff) => {
    const [operation, text] = diff;
    const textLines = text.split('\n');
    
    textLines.forEach((line, i) => {
      // Add newline back except for last line
      const content = i < textLines.length - 1 ? line + '\n' : line;
      
      if (operation === diff_match_patch.DIFF_INSERT) {
        lines.push({ type: 'add', content });
      } else if (operation === diff_match_patch.DIFF_DELETE) {
        lines.push({ type: 'delete', content });
      } else {
        lines.push({ type: 'equal', content });
      }
    });
  });

  return (
    <div className={`text-xs font-mono ${className || ""}`}>
      {lines.map((line, index) => {
        if (line.type === 'add') {
          return (
            <div
              key={index}
              className="bg-green-500/20 dark:bg-green-400/20 border-l-2 border-green-500 pl-2"
            >
              <span className="text-green-600 dark:text-green-400 mr-2 select-none">+</span>
              <span className="whitespace-pre-wrap">{line.content}</span>
            </div>
          );
        } else if (line.type === 'delete') {
          return (
            <div
              key={index}
              className="bg-red-500/20 dark:bg-red-400/20 border-l-2 border-red-500 pl-2"
            >
              <span className="text-red-600 dark:text-red-400 mr-2 select-none">-</span>
              <span className="whitespace-pre-wrap line-through opacity-75">{line.content}</span>
            </div>
          );
        } else {
          return (
            <div key={index} className="pl-4">
              <span className="whitespace-pre-wrap">{line.content}</span>
            </div>
          );
        }
      })}
    </div>
  );
}
