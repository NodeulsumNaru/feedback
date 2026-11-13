import assert from 'node:assert/strict'
import { test } from 'node:test'
import { customerQuestionText, safeEmailTopic, sourcePageUrl } from '../server/lib/inbox/email-context'
import { pageContext } from '../shared/agent/content'
import { renderInboxReplyEmail } from '../server/utils/email-templates'

test('source context accepts only HTTP origins without credentials or query parameters', () => {
  for (const origin of ['https://product.example', 'http://localhost:3000']) assert.equal(pageContext.safeParse({ origin }).success, true)
  for (const origin of ['javascript:alert(1)', 'https://user:pass@product.example', 'https://product.example/path', 'https://product.example?token=secret', 'https://product.example#secret']) assert.equal(pageContext.safeParse({ origin }).success, false)
  assert.equal(sourcePageUrl({ origin: 'https://product.example', pathname: '/support' }), 'https://product.example/support')
  assert.equal(sourcePageUrl({ origin: 'https://product.example' }), 'https://product.example/')
  assert.equal(sourcePageUrl({ pathname: '/support' }), undefined)
  assert.equal(sourcePageUrl({ origin: 'https://product.example', pathname: '//other.example' }), undefined)
  assert.equal(sourcePageUrl({ origin: 'https://product.example', pathname: '/support?secret=1' }), undefined)
})

test('email topic accepts only fixed phrases, never model-generated personal information', () => {
  assert.equal(safeEmailTopic('refund'), 'your refund request')
  for (const output of ['refund for alice@example.invalid', 'Order 12345', '<script>alert(1)</script>', 'other', '__proto__']) assert.equal(safeEmailTopic(output), '')
})

test('question summarization excludes staff, AI, system events and images', () => {
  const input = customerQuestionText([
    { author_type: 'customer', content: { parts: [{ type: 'text', text: 'How can I request a refund?' }] } },
    { author_type: 'staff', content: { parts: [{ type: 'text', text: 'Private staff answer' }] } },
    { author_type: 'agent', content: { parts: [{ type: 'text', text: 'AI explanation' }] } },
  ])
  assert.equal(input, 'How can I request a refund?')
})

test('reply template shows product, safe topic, original staff reply and source-page button', () => {
  const mail = renderInboxReplyEmail({ productName: 'Example <Product>', topic: safeEmailTopic('refund'), reply: 'Your reply <text>', url: 'https://product.example/support' })
  assert.match(mail.text, /reply about your refund request from Example <Product>/)
  assert.match(mail.html, /href="https:\/\/product.example\/support"/)
  assert.match(mail.html, /Continue conversation/)
  assert.match(mail.html, /Example &lt;Product&gt;/)
  assert.match(mail.html, /Your reply &lt;text&gt;/)
  assert.doesNotMatch(mail.html, /feedlog.oss@outlook.com/)
  const fallback = renderInboxReplyEmail({ productName: 'Example', topic: '', reply: 'Reply' })
  assert.match(fallback.text, /You have a reply from Example/)
  assert.doesNotMatch(fallback.html, /Continue conversation/)
})
