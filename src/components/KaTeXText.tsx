import React, { useMemo } from 'react';
import katex from 'katex';


interface KaTeXTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a string that may contain LaTeX math expressions.
 *
 *   $$...$$ → display (block) math
 *   $...$  → inline math
 *   plain  → unchanged text
 *
 * Uses katex.renderToString with throwOnError:false — this means
 * KaTeX will NEVER throw. On bad LaTeX it renders a red error
 * message inline instead of crashing.
 */
const KaTeXText: React.FC<KaTeXTextProps> = ({ text, className }) => {
  const rendered = useMemo(() => {
    if (!text) return '';

    try {
      // Split on display math $$...$$ and inline math $...$
      // Capture group keeps delimiters in the array
      const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);

      return parts
        .map((part) => {
          // Display math
          if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
            const tex = part.slice(2, -2).trim();
            if (!tex) return '';
            return katex.renderToString(tex, {
              displayMode: true,
              throwOnError: false,
              strict: false,
              trust: true,
            });
          }

          // Inline math
          if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            const tex = part.slice(1, -1).trim();
            if (!tex) return '';
            return katex.renderToString(tex, {
              displayMode: false,
              throwOnError: false,
              strict: false,
              trust: true,
            });
          }

          // Plain text — escape HTML entities for safety
          return part
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        })
        .join('');
    } catch {
      // Ultimate fallback: just show raw text
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
};

export default KaTeXText;
