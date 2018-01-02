const cond = require('lodash.cond')
const builtinModules = require('builtin-modules')
const { join } = require('path')

const resolve = require('eslint-module-utils/resolve').default

function constant(value) {
  return () => value
}

function isAbsolute(name) {
  return name.indexOf('/') === 0
}

function isBuiltIn(name, settings) {
  const extras = (settings && settings['import/core-modules']) || []
  return builtinModules.indexOf(name) !== -1 || extras.indexOf(name) > -1
}

function isExternalPath(path, name, settings) {
  const folders = (settings && settings['import/external-module-folders']) || ['node_modules']
  return !path || folders.some(folder => -1 < path.indexOf(join(folder, name)))
}

const externalModuleRegExp = /^\w/
function isExternalModule(name, settings, path) {
  return externalModuleRegExp.test(name) && isExternalPath(path, name, settings)
}

const scopedRegExp = /^@\w+\/\w+/
function isScoped(name) {
  return scopedRegExp.test(name)
}

function isInternalModule(name, settings, path) {
  return externalModuleRegExp.test(name) && !isExternalPath(path, name, settings)
}

function isRelativeToParent(name) {
  return name.indexOf('../') === 0
}

const indexFiles = ['.', './', './index', './index.js']
function isIndex(name) {
  return indexFiles.indexOf(name) !== -1
}

function isRelativeToSibling(name) {
  return name.indexOf('./') === 0
}

const typeTest = cond([
  [isAbsolute, constant('absolute')],
  [isBuiltIn, constant('builtin')],
  [isExternalModule, constant('external')],
  [isScoped, constant('external')],
  [isInternalModule, constant('internal')],
  [isRelativeToParent, constant('parent')],
  [isIndex, constant('index')],
  [isRelativeToSibling, constant('sibling')],
  [constant(true), constant('unknown')],
])

module.exports = function resolveImportType(name, context) {
  return typeTest(name, context.settings, resolve(name, context))
}
