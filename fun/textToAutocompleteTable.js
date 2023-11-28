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
    if (currentTable.key === null) {
      return [""];
    }
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

//TODO can use quotedRegex to get pivots head of time
//use it to flatten this algo 
//ie when termRegex.index passes quotedRegex.index
//that term in currentPath is the pivot 
//when termRegex.index passes quotedRegex.lastIndex a stitch needs to happen
//would also remove the need for isSubKeyPath
function sourceToTable(source) {
  let table = {};

  let words = source.match(keyRegex);
  let inputString = "";
  let previousArgsTerms = [];

  let currentChain = table;
  for (const word of words) {
    inputString += word;
    let argsTerms = parseStringToArgs(inputString); 
    let r = isSubKeyPath(previousArgsTerms, argsTerms);

    if (r.isSubPath) {
      let nextKey = argsTerms.slice(-1)[0];
      const pName = termToPropertyName(nextKey);
      if (isMultiKey(pName)) {
        currentChain = fillMultiKeys(currentChain, nextKey);
      } else {
        let nextChain = {};
        currentChain[pName] = nextChain;
        currentChain.key = nextKey;
        currentChain = nextChain;
      }
    } else {
      currentChain = fillAutoCompleteTable(table, argsTerms);
      stitchAutoCompleteKeyPathsAtIndex(table, previousArgsTerms, argsTerms, r.differentKeyAtIndex);
    }

    previousArgsTerms = argsTerms;
  }

  currentChain.key = null;
  return table;
}

function isQuotedKey(key) {
  const quotationRegex = /[`'"]/y;
  const lastChar = key.slice(-1);
  const quotationInFirstWord = RegExp(`^[^ ]*?[${lastChar}][^]`);
  return (quotationRegex.test(lastChar)) && quotationInFirstWord.test(key);
}

//This assumes that key is a single vaild term
function termToPropertyName(term) {
  //let key = term.slice(0);
  // key = key.replace(/[ ]+$|^[ ]+/g, '');

  // const quotationRegex = /[`'"]/y;
  // const lastChar = key.slice(-1);
  // const quotationInFirstWord = RegExp(`^[^ ]*?[${lastChar}][^]`);
  // if (!(quotationRegex.test(lastChar)) || !quotationInFirstWord.test(key)) {
  //   key = key.replaceAll(/[^\S ]+/g, '');
  // }
  return term.trim();
}

function stitchAutoCompleteKeyPathsAtIndex(table, previousPath, currentPath, index) {
  let lastChainOfpreviousPath = traverseTermPath(table, previousPath);
  let wordsInKey = currentPath[index].match(keyRegex);
  let lastWordInKey = wordsInKey.pop();
  lastChainOfpreviousPath.key = termToPropertyName(lastWordInKey);
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

function traverseTermPath(table, path) {
  let currentChain = table;
  for (const key of path) {
    if (isMultiKey(key)) {
      currentChain = traverseMultiKey(currentChain, key);
    } else {
      currentChain = currentChain[termToPropertyName(key)];
    }
  }
  return currentChain;
}

function fillAutoCompleteTable(table, keyPath) {
  let currentChain = table;
  for (const key of keyPath) {
    if (isMultiKey(key)) {
      currentChain = fillMultiKeys(currentChain, key);
    } else {
      let pName = termToPropertyName(key);
      let nextChain = (currentChain[pName] || {});
      if (!currentChain.key) {
        currentChain.key = key;
      }
      
      currentChain[pName] = nextChain;
      currentChain = nextChain;
    }
    
  }
  return currentChain;
}

const multiKeyRegex = /([^ \s]+[^\S ]+[^ \s]+|[^\S ]+[^ \s]+)+(?<=[ ]*)(?=[ ]*)/g;
function isMultiKey(key) {
  return !isQuotedKey(key) && multiKeyRegex.test(key);
}

function traverseMultiKey(currentChain, multiKey) {
  const keys = multiKey.matchAll(/[\S]+/g);
  for (const key of keys) {
    currentChain = currentChain[termToPropertyName(key[0])];
  }
  return currentChain;
}

function fillMultiKeys(currentChain, multiKey) {
  const keys = multiKey.matchAll(/[\S]+/g);
  if (currentChain.key === undefined) {
    currentChain.key = termToPropertyName(multiKey);
  }
  
  for (const key of keys) {
    const pName = termToPropertyName(key[0]);
    let nextChain = (currentChain[pName] || {});
    currentChain[pName] = nextChain;
    currentChain = nextChain;
  }
  return currentChain;
}

const quotedKeyRegex = /[^ ]*(['"`])[^]+?\1/g;
const keyRegex = /[\s]*[^ ]+[\s]*/g;

function parseStringToArgs(string) {
  let args = [];

  const quotedKeyRegexSticky = RegExp(quotedKeyRegex.source, "y");
  const keyRegexSticky = RegExp(keyRegex.source, "y");
  const termsToMatch = [quotedKeyRegexSticky, keyRegexSticky];

  let index = 0;
  while (index < string.length) {
    let match = null;
    let regex;
    for (regex of termsToMatch) {
      regex.lastIndex = index;
      match = regex.exec(string);
      if (match !== null) {
        break;
      }
    }

    if (match === null) {
      index += 1;
      continue;
    }

    let keyString = match[0];
    if (keyString.slice(-1) === ' ') {
      keyString = keyString.slice(0, -1);
    }
    args.push(keyString);
    index = regex.lastIndex;
  }

  return args;
}
