'use strict'
require('./../core/add-types');

import { EOL } from 'os';
import importType from '../core/importType'
import isStaticRequire from '../core/staticRequire'
import parser from 'babel-eslint';

const defaultGroups = ['builtin', 'external', 'parent', 'sibling', 'index']

// REPORTING

function reverse(array) {
  return array.map(function (v) {
    return {
      name: v.name,
      rank: -v.rank,
      node: v.node,
    }
  }).reverse()
}

function findOutOfOrder(imported) {
  if (imported.length === 0) {
    return []
  }
  let maxSeenRankNode = imported[0]
  return imported.filter(function (importedModule) {
    const res = importedModule.rank < maxSeenRankNode.rank
    if (maxSeenRankNode.rank < importedModule.rank) {
      maxSeenRankNode = importedModule
    }
    return res
  })
}


function findRootNode(node) {
  let result = node;

  while (result.parent != null && result.parent.body == null) {
    result = result.parent;
  }

  return result;
}

function fixOutOfOrder(context, firstNode, secondNode, order) {
  const sourceCode = context.getSourceCode();

  const firstRoot = findRootNode(firstNode.node);
  const secondRoot = findRootNode(secondNode.node);
  const beforeToken = sourceCode.getTokenBefore(secondRoot);
  const newCode = sourceCode.getText(secondRoot);

  const msg = () => '`' + secondNode.name + '` import should occur ' + order +
      ' import of `' + firstNode.name + '`';

  if (order === 'before') {
    context.report({
      node: secondNode.node,
      message: msg(),
      fix: fixer => [
        fixer.remove(secondRoot),
        fixer.insertTextBefore(firstRoot, newCode),
      ],
    });
  } else if (order === 'after') {
    context.report({
      node: secondNode.node,
      message: msg(),
      fix: fixer => [
        fixer.remove(secondRoot),
        fixer.insertTextAfter(firstRoot, newCode),
      ]
    });
  }
}

function reportOutOfOrder(context, imported, outOfOrder, order) {
  outOfOrder.forEach(function (imp) {
    const found = imported.find(function hasHigherRank(importedItem) {
      return importedItem.rank > imp.rank
    })
    fixOutOfOrder(context, found, imp, order);
  })
}

function makeOutOfOrderReport(context, imported) {
  const outOfOrder = findOutOfOrder(imported)
  if (!outOfOrder.length) {
    return
  }
  // There are things to report. Try to minimize the number of reported errors.
  const reversedImported = reverse(imported)
  const reversedOrder = findOutOfOrder(reversedImported)
  if (reversedOrder.length < outOfOrder.length) {
    reportOutOfOrder(context, reversedImported, reversedOrder, 'after')
    return
  }
  reportOutOfOrder(context, imported, outOfOrder, 'before')
}

// DETECTING

function computeRank(context, ranks, name, type) {
  return ranks[importType(name, context)] +
    (type === 'import' ? 0 : 100)
}

function registerNode(context, node, name, type, ranks, imported) {
  const rank = computeRank(context, ranks, name, type)
  if (rank !== -1) {
    imported.push({name, rank, node})
  }
}

function isInVariableDeclarator(node) {
  return node &&
    (node.type === 'VariableDeclarator' || isInVariableDeclarator(node.parent))
}

const types = ['builtin', 'external', 'internal', 'parent', 'sibling', 'index']

// Creates an object with type-rank pairs.
// Example: { index: 0, sibling: 1, parent: 1, external: 1, builtin: 2, internal: 2 }
// Will throw an error if it contains a type that does not exist, or has a duplicate
function convertGroupsToRanks(groups) {
  const rankObject = groups.reduce(function(res, group, index) {
    if (typeof group === 'string') {
      group = [group]
    }
    group.forEach(function(groupItem) {
      if (types.indexOf(groupItem) === -1) {
        throw new Error('Incorrect configuration of the rule: Unknown type `' +
          JSON.stringify(groupItem) + '`')
      }
      if (res[groupItem] !== undefined) {
        throw new Error('Incorrect configuration of the rule: `' + groupItem + '` is duplicated')
      }
      res[groupItem] = index
    })
    return res
  }, {})

  const omittedTypes = types.filter(function(type) {
    return rankObject[type] === undefined
  })

  return omittedTypes.reduce(function(res, type) {
    res[type] = groups.length
    return res
  }, rankObject)
}

function fixNewLineAfterImport(context, previousImport) {
  const prevRoot = findRootNode(previousImport.node);

  return (fixer) => fixer.insertTextAfter(prevRoot, EOL);
}

function removeNewLineAfterImport(context, currentImport, previousImport) {
  const prevRoot = findRootNode(previousImport.node);
  const currRoot = findRootNode(currentImport.node);

  return (fixer) => fixer.removeRange([prevRoot.range[1] + 1, currRoot.range[0]]);
}

function makeNewlinesBetweenReport (context, imported, newlinesBetweenImports) {
  const getNumberOfEmptyLinesBetween = (currentImport, previousImport) => {
    const linesBetweenImports = context.getSourceCode().lines.slice(
      previousImport.node.loc.end.line,
      currentImport.node.loc.start.line - 1
    )

    return linesBetweenImports.filter((line) => !line.trim().length).length
  }
  let previousImport = imported[0]

  imported.slice(1).forEach(function(currentImport) {
    const emptyLinesBetween = getNumberOfEmptyLinesBetween(currentImport, previousImport)

    if (newlinesBetweenImports === 'always'
        || newlinesBetweenImports === 'always-and-inside-groups') {
      if (currentImport.rank !== previousImport.rank && emptyLinesBetween === 0) {
        context.report({
          node: previousImport.node,
          message: 'There should be at least one empty line between import groups',
          fix: fixNewLineAfterImport(context, previousImport)
        });
      } else if (currentImport.rank === previousImport.rank
        && emptyLinesBetween > 0
        && newlinesBetweenImports !== 'always-and-inside-groups') {
        context.report({
          node: previousImport.node,
          message: 'There should be no empty line within import group',
          fix: removeNewLineAfterImport(context, currentImport, previousImport)
        });
      }
    } else if (emptyLinesBetween > 0) {
      context.report({
        node: previousImport.node,
        message: 'There should be no empty line between import groups',
        fix: removeNewLineAfterImport(context, currentImport, previousImport)
      });
    }

    previousImport = currentImport
  })
}

module.exports = {
  meta: {
    docs: {},
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
          },
          'newlines-between': {
            enum: [ 'ignore', 'always', 'never', 'always-and-inside-groups' ],
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create: function importOrderRule (context) {
    const options = context.options[0] || {}
    const newlinesBetweenImports = options['newlines-between'] || 'ignore'
    let ranks

    try {
      ranks = convertGroupsToRanks(options.groups || defaultGroups)
    } catch (error) {
      // Malformed configuration
      return {
        Program: function(node) {
          context.report(node, error.message)
        },
      }
    }
    let imported = []
    let level = 0

    function incrementLevel() {
      level++
    }
    function decrementLevel() {
      level--
    }

    return {
      ImportDeclaration: function handleImports(node) {
        if (node.specifiers.length) { // Ignoring unassigned imports
          const name = node.source.value
          registerNode(context, node, name, 'import', ranks, imported)
        }
      },
      CallExpression: function handleRequires(node) {
        if (level !== 0 || !isStaticRequire(node) || !isInVariableDeclarator(node.parent)) {
          return
        }
        const name = node.arguments[0].value
        registerNode(context, node, name, 'require', ranks, imported)
      },
      'Program:exit': function reportAndReset() {
        makeOutOfOrderReport(context, imported)

        if (newlinesBetweenImports !== 'ignore') {
          makeNewlinesBetweenReport(context, imported, newlinesBetweenImports)
        }

        imported = []
      },
      FunctionDeclaration: incrementLevel,
      FunctionExpression: incrementLevel,
      ArrowFunctionExpression: incrementLevel,
      BlockStatement: incrementLevel,
      ObjectExpression: incrementLevel,
      'FunctionDeclaration:exit': decrementLevel,
      'FunctionExpression:exit': decrementLevel,
      'ArrowFunctionExpression:exit': decrementLevel,
      'BlockStatement:exit': decrementLevel,
      'ObjectExpression:exit': decrementLevel,
    }
  },
}
