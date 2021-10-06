import  _  from 'lodash';
function  getHBValues(text){
    const re = /{{[{]?(.*?)[}]?}}/g;
    const tags = [];
    let matches;
    while (Boolean((matches = re.exec(text)))) {
        if (matches) {
            tags.push(matches[1]);
        }
    }
    const root = {};
    let context = root;
    const stack = [];
    const setVar = (variable, val) => {

        // Dot Notation Breakdown
        if (variable.match(/\.*\./) && !variable.match(/\s/)) {
            let notation = variable.split('.')
            _.set(context, notation, "")
        }
        else {
            context[variable.trim()] = val;
        }
    };
    for (let tag of tags) {
        if (tag.startsWith('! ')) {
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
            context = stack.pop();
            continue;
        }
        if (tag.startsWith('#with ')) {
            const v = tag.split(' ')[1];
            let newContext = {};
            context[v] = newContext;
            stack.push(context);
            context = newContext;
            continue;
        }
        if (tag.startsWith('/with')) {
            context = stack.pop();
            continue;
        }
        if (tag.startsWith('#unless ')) {
            const v = tag.split(' ')[1];
            setVar(v, true);
            stack.push(context);
            continue;
        }
        if (tag.startsWith('/unless')) {
            context = stack.pop();
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
            context = stack.pop();
            continue;
        }
        if (tag.startsWith('/')) {
            context = stack.pop();
            continue;
        }
        setVar(tag, '');
    }

    return root;
};
import * as fs from  'fs';
import { get } from 'http';
fs.readFile('./text.txt', 'utf8' , (err, data) => {
    if (err) {
        console.log(err);
        // return err;
    }
    console.log(getHBValues(data));
  })