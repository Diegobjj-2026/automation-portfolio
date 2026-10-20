// Code node "Build model request" (mode: run once for all items).
// Input: one email per item. Output: the same email plus json.request, the Chat Completions body
// with a strict JSON schema, so the model can only answer in the agreed shape.

const MODEL = 'gpt-4.1-mini-2025-04-14';
const CATEGORIES = ['quote_request', 'complaint_or_incident', 'scheduling', 'supplier_invoice',
  'customer_admin', 'spam_or_marketing', 'other'];

const SYSTEM = `You triage incoming emails for a small renovation company.
Classify each email into exactly one category:
- quote_request: someone asks for a price, a visit or a budget for new work.
- complaint_or_incident: something went wrong: damage, a leak, noise, dust, a complaint about the work or the workers.
- scheduling: confirm, move or cancel a visit or an appointment.
- supplier_invoice: an invoice or a statement sent by a supplier.
- customer_admin: a customer asks for an invoice, a document or a payment detail.
- spam_or_marketing: unsolicited sales or marketing.
- other: anything else.
Urgency: high if there is ongoing damage or a safety risk that needs action today; low for spam or marketing; otherwise normal.
Write a one-sentence summary for the office.
Draft a short, polite reply in the same language as the email, signed "The office team".
Greet the sender by the first name they sign with; if there is none, write "Hello". Never guess a title or gender (no Mr, Mrs, Ms, Sir, Madam).
Never promise prices, dates, amounts or responsibility for damage: write placeholders such as [date], [time] or [price] where a person must decide.
For spam_or_marketing the reply_draft is an empty string.
needs_human is true for complaint_or_incident, for anything with high urgency, and whenever you are unsure.`;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'urgency', 'summary', 'needs_human', 'reply_draft'],
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    urgency: { type: 'string', enum: ['high', 'normal', 'low'] },
    summary: { type: 'string' },
    needs_human: { type: 'boolean' },
    reply_draft: { type: 'string' },
  },
};

return $input.all().map(({ json: email }) => ({
  json: {
    ...email,
    request: {
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}` },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'email_triage', strict: true, schema } },
    },
  },
}));
