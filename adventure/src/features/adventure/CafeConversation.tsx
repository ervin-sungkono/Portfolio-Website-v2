'use client';

import cafe from '@/content/cafe.json';
import NpcConversation, { type Tree } from './NpcConversation';
import { cafeTree } from './cafeModel.mjs';
import './cafe.css';

const tree = cafeTree(cafe) as Tree;
const hasPersonalStories = (cafe.personalTopics as Array<{ question?: unknown; answer?: unknown } | null>).some(item => typeof item?.question === 'string' && !!item.question.trim() && typeof item.answer === 'string' && !!item.answer.trim());

export default function CafeConversation() {
  return <div className="cafe-conversation">
    <p className="cafe-welcome">A cozy corner for a little conversation.</p>
    <NpcConversation npcId="cafe-corner" conversation={tree} />
    {!hasPersonalStories && <p className="cafe-coming-soon">✦ More personal stories are on the way.</p>}
  </div>;
}
