import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './style.module.css';

export function BlogBody({ body }: { body: string }) {
  return (
    <div className={styles.blogBody}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          table: ({ children }) => (
            <div
              className={styles.tableScroll}
              role="region"
              aria-label="Scrollable table"
              tabIndex={0}
            >
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => (
            <pre
              className={styles.codeBlock}
              role="region"
              aria-label="Scrollable code block"
              tabIndex={0}
            >
              {children}
            </pre>
          ),
          code: ({ children, className }) => (
            <code className={[styles.inlineCode, className].filter(Boolean).join(' ')}>
              {children}
            </code>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
