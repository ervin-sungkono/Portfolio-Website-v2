'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dialogues from '@/content/dialogues.json';
import personal from '@/content/personal.json';
import portfolio from '@/content/portfolio.json';
import { nextDialogueStep, visibleChoices } from './dialogueModel.mjs';
import './dialogue.css';

type Option = { label: string; next: string; requires?: 'hobbies' };
type Node = { text: string; content?: 'hobbies' | 'skills'; options: Option[] };
export type Tree = { start: string; nodes: Record<string, Node> };
const trees: Record<string, Tree> = dialogues as Record<string, Tree>;
const hobbies = personal.hobbies as string[];

export default function NpcConversation({ npcId, conversation }: { npcId: string; conversation?: Tree }) {
  const tree = conversation ?? trees[npcId];
  const [nodeId, setNodeId] = useState(() => tree?.start ?? '');
  const node = tree?.nodes[nodeId];
  const characters = useMemo(() => Array.from(node?.text ?? ''), [nodeId, node?.text]);
  const [visible, setVisible] = useState(0);
  const [skipFocused, setSkipFocused] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const skipButton = useRef<HTMLButtonElement>(null);
  const choices = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(characters.length);
      return;
    }
    let count = 0;
    const typeNext = () => {
      const step = nextDialogueStep(characters, count);
      count = step.visible;
      setVisible(count);
      if (count < characters.length) timer.current = window.setTimeout(typeNext, step.delay);
    };
    if (characters.length) timer.current = window.setTimeout(typeNext, 35);
    return () => window.clearTimeout(timer.current);
  }, [characters]);

  if (!node) return <p>There’s nothing to say just yet.</p>;
  const complete = visible >= characters.length;
  const options = visibleChoices(node.options, hobbies.length > 0);
  const finish = () => { window.clearTimeout(timer.current); setVisible(characters.length); };

  return <div className="npc-conversation">
    <div className="dialogue-bubble" key={nodeId} onClick={() => { if (!complete) finish(); }}>
      <span className="dialogue-chapter" aria-hidden="true">✦ &nbsp; A LITTLE CONVERSATION</span>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{node.text}</p>
      <div className="dialogue-stack" aria-hidden="true">
        <p className="dialogue-measure">{node.text}</p>
        <p className="dialogue-text">{characters.slice(0, visible).join('')}{!complete && <span className="dialogue-caret">▮</span>}</p>
      </div>
    </div>
    {(!complete || skipFocused) && <button ref={skipButton} className="skip-dialogue" onFocus={() => setSkipFocused(true)} onBlur={() => setSkipFocused(false)} onClick={() => {
      if (!complete) finish();
      window.requestAnimationFrame(() => choices.current?.querySelector('button')?.focus());
    }}>{complete ? 'Choose a question' : 'Show all'}</button>}
    {complete && <>
      {node.content === 'skills' && <div className="tags skills">{portfolio.skills.map(skill => <span key={skill.label}>{skill.label}</span>)}</div>}
      {node.content === 'hobbies' && hobbies.length > 0 && <div className="tags skills">{hobbies.map(hobby => <span key={hobby}>{hobby}</span>)}</div>}
      {options.length > 0 && <div ref={choices} className="dialogue-options" aria-label="Choose a question"><span className="dialogue-options-label">WHAT WOULD YOU LIKE TO ASK?</span>{options.map(option => <button key={`${option.label}-${option.next}`} onClick={event => {
        const usingKeyboard = event.detail === 0;
        setVisible(0); setNodeId(option.next);
        if (usingKeyboard) window.requestAnimationFrame(() => {
          if (skipButton.current) skipButton.current.focus();
          else choices.current?.querySelector('button')?.focus();
        });
      }}><span aria-hidden="true">▸</span>{option.label}</button>)}</div>}
    </>}
  </div>;
}
