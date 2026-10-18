const LABELS = {
  name: 'Full name', email: 'Email address', password: 'Password', confirm_password: 'Confirm password',
  current_password: 'Current password', new_password: 'New password', entry_date: 'Entry date',
  mood: 'How you feel', movement: 'Movement', title: 'Step title', win: 'Small win',
  recovery_focus: 'Recovery focus', timezone: 'Time zone', status: 'Status', category: 'Win category',
  gratitude: 'Gratitude', challenge: 'Difficult thought', reframe: 'Kinder perspective',
};
const fieldsOf = form => [...form.elements].filter(field => field.name && field.willValidate && /^(INPUT|SELECT|TEXTAREA)$/.test(field.tagName));
const valueOf = (form, name) => String(form.elements.namedItem(name)?.value || '');

function errorsFor(form) {
  const errors = new Map(), fields = fieldsOf(form), seen = new Set();
  const add = (name, message) => { if (!errors.has(name)) errors.set(name, message); };
  for (const field of fields) {
    const { name, validity, type } = field;
    if (seen.has(name)) continue;
    seen.add(name);
    const label = name === 'movement' && form.id === 'fear-form' ? 'Movement or situation' : LABELS[name] || name;
    const value = type === 'radio' ? valueOf(form, name) : field.value;
    const blank = name.endsWith('password') ? !value : !value.trim();
    if (field.required && blank) add(name, type === 'radio' ? 'Choose how you are feeling today.' : type === 'date' || field.tagName === 'SELECT' ? `Please choose ${label.toLowerCase()}.` : `Please enter ${label.toLowerCase()}.`);
    else if (validity.typeMismatch && type === 'email') add(name, 'Enter a valid email address, such as you@example.com.');
    else if (value && field.minLength > 0 && value.length < field.minLength) add(name, `${label} must contain at least ${field.minLength} characters.`);
    else if (field.maxLength > 0 && value.length > field.maxLength) add(name, `${label} must contain ${field.maxLength} characters or fewer.`);
    else if (validity.rangeOverflow) add(name, type === 'date' ? `Choose a date on or before ${field.max}.` : `${label} must be ${field.max} or less.`);
    else if (validity.rangeUnderflow) add(name, type === 'date' ? `Choose a date on or after ${field.min}.` : `${label} must be ${field.min} or more.`);
    else if (!validity.valid) add(name, `Please check ${label.toLowerCase()}.`);
  }
  const confirmation = form.elements.namedItem('confirm_password');
  if (confirmation && confirmation.value && valueOf(form, 'new_password') !== confirmation.value && valueOf(form, 'password') !== confirmation.value) add('confirm_password', 'The passwords do not match. Please enter the same password again.');
  if (form.id === 'journal-form' || form.id === 'micro-win-form') {
    const gratitude = valueOf(form, 'gratitude').trim(), challenge = valueOf(form, 'challenge').trim(), reframe = valueOf(form, 'reframe').trim();
    if (challenge && !reframe) add('reframe', 'Add a kinder perspective to go with the difficult thought.');
    if (reframe && !challenge) add('challenge', 'Add the difficult thought that goes with your kinder perspective.');
    if (form.id === 'journal-form' && !gratitude && !challenge && !reframe) add('gratitude', 'Add something you are grateful for, or complete both reframing fields.');
  }
  return errors;
}

function focusField(field) {
  for (let parent = field.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
  field.focus({ preventScroll: true });
  (field.closest('.mood-options') || field).scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderErrors(form, errors) {
  const fields = fieldsOf(form);
  for (const field of fields) {
    const id = `${form.id}-${field.name}-error`, invalid = errors.has(field.name);
    const description = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(value => value && value !== id);
    if (invalid) { field.setAttribute('aria-invalid', 'true'); description.push(id); }
    else field.removeAttribute('aria-invalid');
    if (description.length) field.setAttribute('aria-describedby', description.join(' ')); else field.removeAttribute('aria-describedby');
  }
  const existing = new Map([...form.querySelectorAll('[data-field-error]')].map(node => [node.dataset.fieldError, node]));
  for (const [name, node] of existing) if (!errors.has(name)) node.remove();
  for (const [name, message] of errors) {
    let node = existing.get(name);
    if (!node) {
      const field = fields.find(item => item.name === name);
      node = document.createElement('span'); node.className = 'field-error'; node.dataset.fieldError = name; node.id = `${form.id}-${name}-error`;
      const group = field.closest('.mood-options');
      if (group) group.after(node); else (field.closest('label') || field.parentElement).append(node);
    }
    if (node.textContent !== message) node.textContent = message;
  }
  const summary = form.querySelector('.form-error'), signature = JSON.stringify([...errors]);
  if (summary && summary.dataset.validationSignature !== signature) {
    summary.replaceChildren(); summary.hidden = !errors.size; summary.dataset.validationSignature = signature;
    if (errors.size) {
      const heading = document.createElement('strong'); heading.textContent = 'Please check the highlighted fields.';
      const list = document.createElement('ul');
      for (const [name, message] of errors) {
        const item = document.createElement('li'), link = document.createElement('button');
        link.type = 'button'; link.className = 'error-link'; link.textContent = message;
        link.addEventListener('click', () => focusField(fields.find(field => field.name === name)));
        item.append(link); list.append(item);
      }
      summary.append(heading, list);
    }
  }
}

export function prepareFormValidation(root) {
  for (const form of root.querySelectorAll('form')) {
    form.noValidate = true;
    for (const name of ['movement', 'timezone', 'status', 'category']) {
      const field = form.elements.namedItem(name); if (field) field.required = true;
    }
    const recheck = () => { if (form.dataset.validationAttempted) renderErrors(form, errorsFor(form)); };
    form.addEventListener('input', recheck); form.addEventListener('change', recheck);
    form.addEventListener('reset', () => { delete form.dataset.validationAttempted; renderErrors(form, new Map()); });
  }
}

export function validateForm(form) {
  form.dataset.validationAttempted = 'true';
  const errors = errorsFor(form); renderErrors(form, errors);
  if (errors.size) {
    const field = fieldsOf(form).find(item => errors.has(item.name));
    focusField(field); return false;
  }
  return true;
}
