'use strict';

const example = {
  question: 'When will the fictional Willow Street library reopen?',
  answer: 'The Willow Street library will reopen on September 14 after its renovation.',
  documents: [
    { id: 'source-1', title: 'Library project update', text: 'Fictional city update, August 28: Renovations at the Willow Street library are nearly complete. The library is scheduled to reopen to the public on September 14, subject to a final safety inspection.' },
    { id: 'source-2', title: 'Community newsletter', text: 'Fictional neighborhood newsletter, August 12: The Willow Street library remains closed for renovation. Staff expect a September reopening, but the exact date has not yet been confirmed.' },
    { id: 'source-3', title: 'Parks notice', text: 'Fictional city parks notice: The Willow Street playground will close for repairs on September 14. The library is a separate facility.' }
  ]
};

const form = document.querySelector('#review-form');
const sources = document.querySelector('#sources');
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const run = document.querySelector('#run');
let nextId = 1;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function addSource(data = {}) {
  const id = data.id || 'source-' + nextId++;
  const card = element('div', undefined, 'source');
  card.dataset.id = id;
  const top = element('div', undefined, 'source-top');
  const number = element('span', '', 'source-number');
  const title = element('input');
  title.type = 'text';
  title.required = true;
  title.placeholder = 'Source title';
  title.value = data.title || '';
  title.setAttribute('aria-label', 'Source title');
  const remove = element('button', 'Remove', 'remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    card.remove();
    updateSourceNumbers();
    invalidateReport();
  });
  const text = element('textarea');
  text.required = true;
  text.placeholder = 'Paste source text here';
  text.value = data.text || '';
  text.setAttribute('aria-label', 'Source text');
  top.append(number, title, remove);
  card.append(top, text);
  sources.append(card);
  updateSourceNumbers();
}

function updateSourceNumbers() {
  [...sources.children].forEach((card, i) => {
    card.querySelector('.source-number').textContent = 'DOC / ' + String(i + 1).padStart(2, '0');
  });
}

function setStatus(title, message, kind = '') {
  status.className = 'status' + (kind ? ' ' + kind : '');
  status.replaceChildren();
  const icon = element('span', kind === 'error' ? '!' : '↗', 'status-icon');
  const copy = element('div');
  copy.append(element('strong', title), element('p', message));
  status.append(icon, copy);
}

function invalidateReport() {
  if (!report.hidden) {
    report.hidden = true;
    setStatus('Case changed.', 'Run the review again to see results for the current inputs.');
  }
}

function setReviewBusy(busy) {
  // Keep the visible case fixed until its corresponding response arrives.
  form.querySelectorAll('input, textarea, button').forEach(control => { control.disabled = busy; });
  document.querySelector('#reset').disabled = busy;
}

function resetExample() {
  document.querySelector('#question').value = example.question;
  document.querySelector('#answer').value = example.answer;
  sources.replaceChildren();
  nextId = 4;
  example.documents.forEach(addSource);
  report.hidden = true;
  status.hidden = false;
  setStatus('Ready when you are.', 'Run the fictional case or replace it with your own source material.');
}

// Only selected fields are displayed. API and source content always enter as text.
function sourceName(value, documents) {
  const id = value && typeof value === 'object'
    ? (value.id ?? value.document_id ?? value.document ?? value.source_id)
    : value;
  const found = documents.find(doc => doc.id === String(id));
  if (found) return found.title;
  if (value && typeof value === 'object' && typeof value.title === 'string') return value.title;
  return id == null || typeof id === 'object' ? 'Source not specified' : String(id);
}

function display(value, fallback = 'Not provided') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function card(title, badge) {
  const box = element('article', undefined, 'result-card');
  const head = element('div', undefined, 'result-card-head');
  head.append(element('strong', title));
  if (badge !== null && badge !== undefined && badge !== '') head.append(element('span', badge, 'badge'));
  box.append(head);
  return box;
}

function addQuote(box, evidence, documents, fallbackSource) {
  if (!evidence) return;
  if (Array.isArray(evidence)) {
    evidence.forEach(item => addQuote(box, item, documents, fallbackSource));
    return;
  }
  if (typeof evidence === 'string') {
    const quote = element('blockquote', evidence);
    if (fallbackSource) quote.append(element('cite', sourceName(fallbackSource, documents)));
    box.append(quote);
    return;
  }
  if (typeof evidence !== 'object') return;
  const quote = evidence.quote ?? evidence.text ?? evidence.passage;
  if (typeof quote === 'string' && quote.trim()) {
    const block = element('blockquote', quote);
    const source = evidence.document ?? evidence.document_id ?? evidence.source_id ?? evidence.id ?? fallbackSource;
    if (source !== undefined && source !== null) block.append(element('cite', sourceName(source, documents)));
    box.append(block);
  }
}

function renderRerank(target, data, documents) {
  const items = data && Array.isArray(data.results) ? data.results : [];
  if (!items.length) return target.append(element('p', 'No source ranking returned.', 'empty-result'));
  items.forEach(item => {
    const box = card(sourceName(item.id ?? item.document_id ?? item.document, documents), display(item.action, 'Action not provided'));
    const score = item.relevance_score;
    if (typeof score === 'number' && Number.isFinite(score)) box.append(element('p', 'Relevance score: ' + score.toFixed(2), 'result-detail'));
    target.append(box);
  });
}

function renderCompare(target, data, documents) {
  const items = data && Array.isArray(data.pairs) ? data.pairs : [];
  if (!items.length) return target.append(element('p', 'No source pairs returned.', 'empty-result'));
  items.forEach(pair => {
    const box = card(sourceName(pair.a, documents) + ' / ' + sourceName(pair.b, documents), display(pair.relation, 'Relation not provided'));
    const conflicts = Array.isArray(pair.conflicts) ? pair.conflicts : [];
    if (!conflicts.length) box.append(element('p', 'No conflict evidence returned.', 'result-detail'));
    conflicts.forEach(conflict => {
      if (typeof conflict === 'string') box.append(element('p', conflict, 'result-detail'));
      else if (conflict && typeof conflict === 'object') {
        if (typeof conflict.description === 'string') box.append(element('p', conflict.description, 'result-detail'));
        addQuote(box, conflict.a, documents, pair.a);
        addQuote(box, conflict.b, documents, pair.b);
        addQuote(box, conflict.evidence, documents);
      }
    });
    target.append(box);
  });
}

function renderGrounding(target, data, documents) {
  const items = data && Array.isArray(data.claims) ? data.claims : [];
  if (!items.length) return target.append(element('p', 'No claims returned.', 'empty-result'));
  items.forEach(item => {
    const box = card(display(item.claim, 'Claim not provided'), display(item.verdict, 'Verdict not provided'));
    const before = box.children.length;
    addQuote(box, item.evidence, documents);
    if (box.children.length === before) box.append(element('p', 'No evidence quote returned. Check the original sources.', 'result-detail'));
    target.append(box);
  });
}

document.querySelector('#add-source').addEventListener('click', () => {
  if (sources.children.length >= 10) {
    setStatus('Source limit reached.', 'Use no more than 10 sources.', 'error');
    return;
  }
  addSource();
  invalidateReport();
});
document.querySelector('#reset').addEventListener('click', resetExample);
form.addEventListener('input', invalidateReport);
form.addEventListener('submit', async event => {
  event.preventDefault();
  const documents = [...sources.children].map(card => ({
    id: card.dataset.id,
    title: card.querySelector('input').value.trim(),
    text: card.querySelector('textarea').value.trim()
  }));
  const question = document.querySelector('#question').value.trim();
  const answer = document.querySelector('#answer').value.trim();
  if (!question || !answer || documents.length < 2 || documents.some(doc => !doc.title || !doc.text)) {
    report.hidden = true;
    status.hidden = false;
    setStatus('The case needs more detail.', 'Add a question, an answer, and at least two sources with a title and text.', 'error');
    return;
  }
  setReviewBusy(true);
  run.textContent = 'Reviewing…';
  report.hidden = true;
  status.hidden = false;
  setStatus('Review in progress.', 'Comparing your answer with the supplied material.');
  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, documents })
    });
    const data = await response.json().catch(() => { throw new Error('The server returned an unreadable response.'); });
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The review could not be completed.');
    const errors = data.errors && typeof data.errors === 'object' ? data.errors : {};
    for (const key of ['rerank', 'compare', 'grounding']) {
      const target = document.querySelector('#' + key);
      target.replaceChildren();
      if (errors[key]) target.append(element('p', 'Unavailable: ' + String(errors[key])));
      else if (key === 'rerank') renderRerank(target, data[key], documents);
      else if (key === 'compare') renderCompare(target, data[key], documents);
      else renderGrounding(target, data[key], documents);
    }
    report.hidden = false;
    if (Object.keys(errors).length === 3) {
      setStatus('Review unavailable.', 'All checks failed. See the individual messages below.', 'error');
    } else if (Object.keys(errors).length) {
      setStatus('Review partially complete.', 'Some checks could not finish. Available results appear below.', 'error');
    } else {
      setStatus('Review complete.', 'Read each result alongside the original sources.');
    }
  } catch (error) {
    setStatus('Review unavailable.', error instanceof Error ? error.message : 'Please try again.', 'error');
  } finally {
    setReviewBusy(false);
    run.replaceChildren(document.createTextNode('Run review '), element('span', '↗'));
  }
});

resetExample();
