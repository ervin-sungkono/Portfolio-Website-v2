export type ProjectStudy = {
  focus: string;
  context: string;
  challenge: string;
  highlights: readonly string[];
  decisions: readonly { title: string; implementation: string; tradeoff: string }[];
  nextStep: string;
  reference: { label: string; href: string };
};

// Features are sourced from public project documentation. Tradeoffs and next steps
// are analysis, not claims about the author's original intent or measured results.
export const projectStudies: Readonly<Partial<Record<string, ProjectStudy>>> = {
  'wetrack-app': {
    focus: 'Product workflows & integrations',
    context:
      'A Computer Science thesis project created by Ervin Sungkono, Christopher Vinantius, and Kenneth Nathanael. The application brings task tracking, scheduling, and collaboration into one workspace.',
    challenge:
      'A task is more than a title: it has a schedule, attachments, collaborators, and a history. The interface needs to make that information usable across boards, calendars, and dashboards.',
    highlights: [
      'Kanban boards for organising and tracking tasks',
      'Scheduling, attachments, dashboards, history, and notifications',
      'AI-assisted task creation and recommendations',
    ],
    decisions: [
      {
        title: 'Use specialised tools for complex interactions',
        implementation:
          'The documented stack combines Next.js and Firebase with FullCalendar, drag-and-drop, Chart.js, and table components to support different views of the work.',
        tradeoff:
          'Specialised libraries reduce the amount of interaction code to write, but their behaviour, accessibility, and upgrade paths still need to work together.',
      },
      {
        title: 'Add AI assistance to an existing task workflow',
        implementation:
          'Task creation and recommendations use the OpenAI API alongside the application’s conventional task-management features.',
        tradeoff:
          'AI output adds value only when users can review it. Network failures, latency, and incomplete suggestions need clear handling at the point of use.',
      },
    ],
    nextStep:
      'A useful next validation step is an end-to-end test of task creation, board updates, and scheduling, including failed requests and keyboard interaction.',
    reference: {
      label: 'Project README & team credits',
      href: 'https://github.com/ervin-sungkono/WeTrack-App#readme',
    },
  },
  'chatgpt-clone': {
    focus: 'Streaming UI & browser persistence',
    context:
      'An educational chat application that explores incremental responses, document input, and conversation history stored in the browser.',
    challenge:
      'Chat responses arrive over time. The interface needs to display partial content while keeping the conversation readable and preserving history between visits.',
    highlights: [
      'Server-sent events handled through ReadableStream',
      'Text and PDF input, speech recognition, and Markdown rendering',
      'Conversation history in localStorage, with light and dark themes',
    ],
    decisions: [
      {
        title: 'Render a response as it arrives',
        implementation:
          'ReadableStream handles server-sent events so the interface can present a response incrementally instead of waiting for the entire message.',
        tradeoff:
          'Streaming offers earlier feedback, but requires handling interrupted connections and content split across chunks. It does not make the model finish sooner.',
      },
      {
        title: 'Keep conversation history in the browser',
        implementation:
          'The application uses localStorage instead of an application database for chat history.',
        tradeoff:
          'This keeps persistence simple for an educational app. History remains tied to one browser, has storage limits, and can disappear when site data is cleared.',
      },
    ],
    nextStep:
      'A useful next step is to test stream interruption and recovery, storage failures, and accessible announcements while a response is being generated.',
    reference: {
      label: 'Project README & feature history',
      href: 'https://github.com/ervin-sungkono/ChatGPT-Clone#readme',
    },
  },
  'next-pokedex': {
    focus: 'API-driven interfaces & rendering',
    context:
      'A Pokémon catalogue built with Next.js, React, Sass, and PokéAPI. The public project description identifies static generation and server-side rendering as areas explored.',
    challenge:
      'A catalogue needs to turn external API data into a consistent browsing experience. The rendering strategy affects when data is fetched and how fresh each page can be.',
    highlights: [
      'Catalogue data from the public PokéAPI',
      'Exploration of static generation and server-side rendering',
      'A React interface styled with Sass',
    ],
    decisions: [
      {
        title: 'Explore more than one rendering strategy',
        implementation:
          'The repository description explicitly lists SSG and SSR. This project provides a concrete setting for comparing build-time and request-time data fetching.',
        tradeoff:
          'Static generation can serve prepared content quickly; request-time rendering can use fresher data but adds work to the request. Neither is automatically the best choice for every route.',
      },
    ],
    nextStep:
      'A useful next step is to document which routes use each strategy and compare behaviour when the API is slow or unavailable, before making performance claims.',
    reference: {
      label: 'Repository description & source',
      href: 'https://github.com/ervin-sungkono/Next-Pokedex',
    },
  },
};

export const engineeringCapabilities = [
  {
    title: 'Product Workflows',
    description: 'Boards, scheduling, and dashboards in a team-built application.',
    projectSlug: 'wetrack-app',
  },
  {
    title: 'Responsive Interactions',
    description: 'Incremental responses and conversation history in a streaming chat interface.',
    projectSlug: 'chatgpt-clone',
  },
  {
    title: 'Data & Rendering',
    description: 'An API-driven catalogue exploring static and server-side rendering.',
    projectSlug: 'next-pokedex',
  },
] as const;

export const portfolioDecisions = [
  {
    title: 'Render Content on the Server',
    implementation:
      'Pages and project walkthroughs use Server Components. The header and contact form own the browser interactions. Project detail pages are generated at build time.',
    tradeoff:
      'Static content needs a new build when it changes. That is a reasonable constraint for phase 1; publishing and cache invalidation can be designed when a CMS is selected.',
    file: 'src/app/project/[slug]/page.tsx',
  },
  {
    title: 'Keep Content Separate From UI',
    implementation:
      'Project records, profile facts, and engineering walkthroughs live in content files. Pages access project data through a small shared module.',
    tradeoff:
      'Content edits currently require a commit. A CMS is deferred to phase 2, so the application does not yet need provider adapters or an admin interface.',
    file: 'src/lib/content.ts',
  },
  {
    title: 'Make Filters Shareable',
    implementation:
      'Project search and categories use query parameters and ordinary links. A filtered collection has a URL that can be copied, bookmarked, or opened without client-side filtering code.',
    tradeoff:
      'Submitting a search performs a navigation. For a small portfolio collection, explicit search is a simpler choice than a continuously updating client-side index.',
    file: 'src/app/project/page.tsx',
  },
  {
    title: 'Treat Contact as a Complete Flow',
    implementation:
      'The form and API share validation. Gmail and reCAPTCHA access stay in a server-only module. Failed submissions preserve the message; successful submissions clear it.',
    tradeoff:
      'Delivery depends on external providers and valid hostname configuration. A helpful error and LinkedIn fallback give visitors another way to get in touch.',
    file: 'src/lib/contact/service.ts',
  },
] as const;

export const portfolioSource = 'https://github.com/ervin-sungkono/Portfolio-Website-v2';
export const portfolioSourceRef = 'feat/portfolio-rework-phase-1';

export function portfolioFileUrl(file: string) {
  return `${portfolioSource}/blob/${portfolioSourceRef}/${file}`;
}
