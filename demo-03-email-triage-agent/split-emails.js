// Code node "Split emails" (mode: run once for all items).
// Input: the emails.json file read from disk (binary "data"). Output: one item per email.
// The "expected" answer that test.js uses to grade the run is removed here, so the model never sees it.

const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const emails = JSON.parse(buffer.toString('utf8'));

return emails.map(({ id, from, subject, body }) => ({ json: { id, from, subject, body } }));
