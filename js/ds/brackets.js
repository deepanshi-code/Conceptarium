// The classic stack application: are the brackets in an expression balanced?
// Returns one step per character so the view can animate the stack.

const PAIRS = { ')': '(', ']': '[', '}': '{' };

export function checkBrackets(text) {
  const stack = [];
  const steps = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) {
      stack.push(ch);
      steps.push({ i, ch, action: 'push', stack: [...stack], msg: `Opening ${ch}: push it.` });
    } else if (ch in PAIRS) {
      if (stack.at(-1) !== PAIRS[ch]) {
        steps.push({ i, ch, action: 'fail', stack: [...stack], msg: stack.length ? `${ch} does not match the top ${stack.at(-1)}. Not balanced.` : `${ch} has nothing to close. Not balanced.` });
        return { ok: false, steps };
      }
      stack.pop();
      steps.push({ i, ch, action: 'pop', stack: [...stack], msg: `${ch} matches the top ${PAIRS[ch]}: pop it.` });
    }
  }
  const ok = stack.length === 0;
  steps.push({ i: text.length, ch: '', action: ok ? 'ok' : 'fail', stack: [...stack], msg: ok ? 'Stack is empty at the end: balanced!' : `${stack.length} bracket(s) never closed. Not balanced.` });
  return { ok, steps };
}
