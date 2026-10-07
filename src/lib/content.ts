import projectData from '@/content/projects.json';
import designData from '@/content/designs.json';

export type Project = (typeof projectData)[number];
export type Design = (typeof designData)[number];

// One content boundary for pages. CMS implementation belongs in phase 2.
export const projects: readonly Project[] = projectData;
export const designs: readonly Design[] = designData;
export const featuredProjects = projects.slice(0, 3);

export function findProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function filterProjects(query: string, category: string) {
  const term = query.trim().toLowerCase();
  return projects.filter(
    (project) =>
      (!category || project.category === category) &&
      (!term ||
        `${project.name} ${project.description} ${project.topics.join(' ')}`
          .toLowerCase()
          .includes(term)),
  );
}

// Notes describe verified project behavior, not unverified personal contributions.
export const projectNotes: Record<
  string,
  { context: string; highlights: string[]; engineering: string }
> = {
  'wetrack-app': {
    context:
      'A Computer Science thesis project created by a team of three: Ervin Sungkono, Christopher Vinantius, and Kenneth Nathanael.',
    highlights: [
      'Kanban boards, task management, and team collaboration',
      'Scheduling, attachments, dashboards, and notifications',
      'AI-assisted task creation and recommendations',
    ],
    engineering:
      'Next.js provides the application structure, Firebase supports the data layer, and the project combines calendar, drag-and-drop, charting, and AI integrations.',
  },
  'chatgpt-clone': {
    context:
      'An educational chat application exploring streaming responses, document input, and browser-based conversation history.',
    highlights: [
      'Streaming responses through ReadableStream and server-sent events',
      'Text and PDF input, speech recognition, and Markdown rendering',
      'Conversation history in localStorage, with light and dark themes',
    ],
    engineering:
      'The interface handles responses incrementally instead of waiting for a complete message. Browser storage keeps conversation history without requiring an application database.',
  },
  'next-pokedex': {
    context: 'A Pokémon catalogue built with Next.js, React, Sass, and the public PokéAPI.',
    highlights: [
      'Pokémon data from PokéAPI',
      'Static generation and server-side rendering',
      'A responsive interface for browsing the catalogue',
    ],
    engineering:
      'The project explores static generation and server-side rendering within a data-driven Next.js application.',
  },
};
