import ReactMarkdown from 'react-markdown';
import type { BlogBodyProps } from './type';
import './style.css';

export function BlogBody({ body }: BlogBodyProps) {
  return (
    <div className="blog-body">
      <ReactMarkdown skipHtml components={{ h1: 'h2' }}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
