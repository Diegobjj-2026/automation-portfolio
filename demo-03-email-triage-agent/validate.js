// Code node "Check model answer" (mode: run once for all items).
// Input: one Chat Completions response per email, in the same order as "Build model request".
// Output: one row per email. The model's answer is checked against the agreed shape, and the
// safety rules are applied here in code, not trusted to the model:
//   - complaints and high urgency always go to a person;
//   - an answer that does not parse or does not fit becomes category "other" and goes to a person;
//   - nothing is ever sent: every reply is a draft waiting for approval.

const emails = $('Build model request').all();
const CATEGORIES = ['quote_request', 'complaint_or_incident', 'scheduling', 'supplier_invoice',
  'customer_admin', 'spam_or_marketing', 'other'];
const URGENCY = ['high', 'normal', 'low'];

function readAnswer(response) {
  try {
    const a = JSON.parse(response?.choices?.[0]?.message?.content ?? '');
    const ok = CATEGORIES.includes(a.category) && URGENCY.includes(a.urgency) &&
      typeof a.summary === 'string' && typeof a.needs_human === 'boolean' && typeof a.reply_draft === 'string';
    return ok ? a : null;
  } catch {
    return null;
  }
}

return $input.all().map((item, i) => {
  const email = emails[i]?.json ?? {};
  const answer = readAnswer(item.json);
  const checks = [];
  let row;
  if (!answer) {
    checks.push('model answer did not fit the agreed format');
    row = { category: 'other', urgency: 'normal', summary: '', needs_human: true, reply_draft: '' };
  } else {
    row = { ...answer };
    if ((row.category === 'complaint_or_incident' || row.urgency === 'high') && !row.needs_human) {
      row.needs_human = true;
      checks.push('sent to a person by rule (complaint or high urgency)');
    }
  }
  return {
    json: {
      'ID': email.id,
      'From': email.from,
      'Subject': email.subject,
      'Category': row.category,
      'Urgency': row.urgency,
      'Needs a person': row.needs_human ? 'yes' : 'no',
      'Summary': row.summary,
      'Reply draft': row.reply_draft,
      'Reply status': row.reply_draft ? 'DRAFT, waiting for approval' : 'no reply',
      'Checks': checks.join('; '),
      'Model': item.json?.model ?? '',
      'Tokens': item.json?.usage?.total_tokens ?? '',
    },
  };
});
