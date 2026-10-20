// Code node "Build approval list" (mode: run once for all items).
// Input: the checked rows. Output: one item with json.markdown, the list a person reads to approve,
// edit or discard each draft. Urgent items and items for a person come first.

const rows = $input.all().map(i => i.json);
const rank = r => (r['Urgency'] === 'high' ? 0 : r['Needs a person'] === 'yes' ? 1 : 2);
const sorted = [...rows].sort((a, b) => rank(a) - rank(b));

const lines = [
  '# Inbox triage: drafts waiting for approval',
  '',
  `${rows.length} emails. ${rows.filter(r => r['Needs a person'] === 'yes').length} need a person. Nothing has been sent.`,
  '',
];
for (const r of sorted) {
  lines.push(`## ${r['Urgency'] === 'high' ? '🔴 ' : ''}${r['Subject']}`);
  lines.push('');
  lines.push(`- **From:** ${r['From']} · **Category:** ${r['Category']} · **Urgency:** ${r['Urgency']} · **Needs a person:** ${r['Needs a person']}`);
  lines.push(`- **Summary:** ${r['Summary']}`);
  if (r['Checks']) lines.push(`- **Checks:** ${r['Checks']}`);
  lines.push('');
  if (r['Reply draft']) {
    lines.push('> ' + r['Reply draft'].split('\n').join('\n> '));
    lines.push('');
    lines.push('*Status: draft, waiting for approval.*');
  } else {
    lines.push('*No reply drafted.*');
  }
  lines.push('');
}

return [{ json: { markdown: lines.join('\n') } }];
