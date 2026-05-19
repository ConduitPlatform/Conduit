import { set } from 'lodash-es';

export function getHandleBarsValues(text: any) {
  const re = /{{[{]?(.*?)[}]?}}/gs;
  const tags = [];
  let matches;
  while (Boolean((matches = re.exec(text)))) {
    if (matches) {
      const raw = matches[1];
      const normalized = raw.replace(/\s+/g, ' ').trim();
      tags.push(normalized);
    }
  }
  const root: any = {};
  let context = root;
  const stack = [];
  const setVar = (variable: any, val: any) => {
    // Dot Notation Breakdown
    if (variable.match(/\.*\./) && !variable.match(/\s/)) {
      const notation = variable.split('.');
      set(context, notation, '');
    } else {
      context[variable.trim()] = val;
    }
  };
  for (const tag of tags) {
    if (tag.startsWith('!')) {
      continue;
    }
    if (tag == 'else') {
      continue;
    }
    if ('#^'.includes(tag[0]) && !tag.includes(' ')) {
      setVar(tag.substr(1), true);
      stack.push(context);
      continue;
    }
    if (tag.startsWith('#if')) {
      const vars = tag.split(' ').slice(1);
      for (const v of vars) {
        setVar(v, true);
      }
      stack.push(context);
      continue;
    }
    if (tag.startsWith('/if')) {
      if (stack.length > 0) context = stack.pop();
      continue;
    }
    if (tag.startsWith('#with ')) {
      const v = tag.split(' ')[1];
      const newContext = {};
      context[v] = newContext;
      stack.push(context);
      context = newContext;
      continue;
    }
    if (tag.startsWith('/with')) {
      if (stack.length > 0) context = stack.pop();
      continue;
    }
    if (tag.startsWith('#unless ')) {
      const v = tag.split(' ')[1];
      setVar(v, true);
      stack.push(context);
      continue;
    }
    if (tag.startsWith('/unless')) {
      if (stack.length > 0) context = stack.pop();
      continue;
    }
    if (tag.startsWith('#each ')) {
      const v = tag.split(' ')[1];
      const newContext = {};
      context[v] = [newContext];
      stack.push(context);
      context = newContext;
      continue;
    }
    if (tag.startsWith('/each')) {
      if (stack.length > 0) context = stack.pop();
      continue;
    }
    if (tag.startsWith('/')) {
      if (stack.length > 0) context = stack.pop();
      continue;
    }
    if (tag.startsWith('@') || tag === 'this') {
      continue;
    }
    setVar(tag, '');
  }

  return root;
}
