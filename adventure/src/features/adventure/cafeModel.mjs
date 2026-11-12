/** Build a conversation from only the topics that have an answer to share. */
export function cafeTree(content) {
  const entries = [...(content.townTopics ?? []), ...(content.personalTopics ?? [])]
    .filter(item => item && typeof item.question === 'string' && item.question.trim() && typeof item.answer === 'string' && item.answer.trim());
  const nodes = {
    welcome: {
      text: entries.length ? content.greeting : 'The café is saving a seat for more stories. Take your time in town!',
      options: entries.map((item, index) => ({ label: item.question, next: `topic-${index}` })),
    },
  };
  entries.forEach((item, index) => {
    nodes[`topic-${index}`] = { text: item.answer, options: [{ label: 'Chat about something else', next: 'welcome' }] };
  });
  return { start: 'welcome', nodes };
}
