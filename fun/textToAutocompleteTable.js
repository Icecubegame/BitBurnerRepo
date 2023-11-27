/** @param {NS} ns */
export async function main(ns) {
  let source = ns.read(ns.args[0]);
  let table = sourceToTable(source);

  let code = "export const table = " + JSON.stringify(table) + ";\n";
  code += `export async function main(ns) {
  let string = "";
  for(const arg of ns.args) {
    string += arg + " ";
  }
  ns.tprint("\\n\\n\\n" + string);
}

export function autocomplete(data, args) {
  let currentTable = table;
  for(let arg of args) {
    currentTable = currentTable[arg];
  }
  return [currentTable.key];
}`
  ns.write(ns.args[1], code);
}

export function autocomplete(data, args) {

  if (args[0] === undefined || (args[1] === undefined && !data.txts.includes(args[0]) && !args[0].endsWith(".txt"))) {
    return [...data.txts];
  }

  if (args[1]) {
    if (args[1].endsWith(".js") || args[1].endsWith(".txt")) {
      return [];
    } else {
      return [args[1] + "-autocomplete-table.js"];
    }
  } else {
    let nameRegex = /[^.]+/;
    return [nameRegex.exec(args[0]) + "-autocomplete-table.js"];
  }

  return [];
}

function sourceToTable(source) {
  let table = {};
  let cleanedSrouce = source.replace(/\s+/g, ' ');

  let words = cleanedSrouce.split(' ');
  let inputString = words.shift();
  let previousArgsKeyPath = [];

  let currentChain = table;
  for (const word of words) {
    let argsKeyPath = parseStringToArgs(inputString);
    let r = isSubKeyPath(previousArgsKeyPath, argsKeyPath);

    if (r.isSubPath) {
      let nextKey = argsKeyPath.slice(-1)[0];
      let nextChain = {};
      currentChain[nextKey] = nextChain;
      currentChain.key = nextKey;
      currentChain = nextChain;
    } else {
      currentChain = fillAutoCompleteTable(table, argsKeyPath);
      stitchAutoCompleteKeyPathsAtIndex(table, previousArgsKeyPath, argsKeyPath, r.differentKeyAtIndex);
    }

    previousArgsKeyPath = argsKeyPath;

    inputString += " " + word;
  }

  return table;
}

function stitchAutoCompleteKeyPathsAtIndex(table, previousPath, currentPath, index) {
  let lastChainOfpreviousPath = traverseKeyPath(table, previousPath);
  let wordsInKey = currentPath[index].split(' ');
  let lastWordInKey = wordsInKey[wordsInKey.length - 1];
  lastChainOfpreviousPath.key = lastWordInKey;
}

function isSubKeyPath(path1, path2) {
  const length = Math.min(path1.length, path2.length);
  let i = 0;
  for (; i < length; i++) {
    if (path1[i] != path2[i]) {
      return { isSubPath: false, differentKeyAtIndex: i };
    }
  }
  return { isSubPath: true };
}

function traverseKeyPath(table, path) {
  let currentChain = table;
  for (const key of path) {
    currentChain = currentChain[key];
  }
  return currentChain;
}

function fillAutoCompleteTable(table, keyPath) {
  let currentChain = table;
  for (const key of keyPath) {
    let nextChain = (currentChain[key] || {});
    if (!currentChain.key) {
      currentChain.key = key;
    }

    currentChain[key] = nextChain;
    currentChain = nextChain;
  }
  return currentChain;
}

function parseStringToArgs(string) {
  const trimmedString = string.trim();
  let args = [];

  const delimitersRegex = /[\s'"`]/g;
  const quotations = {};
  quotations['\''] = /'/g;
  quotations['\"'] = /"/g;
  quotations['\`'] = /`/g;

  let index = 0;
  while (index < trimmedString.length) {
    delimitersRegex.lastIndex = index;
    const delimiter = delimitersRegex.exec(trimmedString);

    if (delimiter != ' ') {
      let quotation;
      let nextQuatation = null;

      if (delimiter !== null) {
        quotation = quotations[delimiter];
        quotation.lastIndex = delimitersRegex.lastIndex;
        nextQuatation = quotation.exec(trimmedString);
      }

      if (nextQuatation !== null) {
        args.push(trimmedString.substring(index, quotation.lastIndex));
        index = quotation.lastIndex;
      } else {
        const remaining = trimmedString.substring(index);
        args.push(...remaining.split(' '));
        break;
      }
    } else {
      args.push(trimmedString.substring(index, delimiter.index));
      index = delimitersRegex.lastIndex;
    }
  }

  return args;
}
