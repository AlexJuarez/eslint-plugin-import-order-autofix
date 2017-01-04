# eslint-plugin-import-order-autofix

This plugin is an extension of the lovely and more stable [eslint-plugin-import](https://github.com/benmosher/eslint-plugin-import) to enable `--fix` for import/order.

With this change import order set by `"groups"` and `"newlines-between`" will when run with `--fix` attempt to reorder and properly newline your imports.

## Setup

```javascript
npm install --save eslint-plugin-import-order-autofix
```

## Configuration

In your `.eslintrc` add `"import-order-autofix"` to your plugins, and
add `"import-order-autofix/order"` to your rules. For additional information see the docs [`order`](https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/order.md)

# Examples

```javascript
const fs = require('fs-extra');
const get = require('lodash/get');
const path = require('path');
const uniq = require('lodash/uniq');
const generateDemo = require('./generateDemo');

const {
  extensionize,
  stripBasename
} = require('./utils');
```
will be turned into
```javascript
const path = require('path');

const fs = require('fs-extra');
const get = require('lodash/get');
const uniq = require('lodash/uniq');

const generateDemo = require('./generateDemo');
const {
  extensionize,
  stripBasename
} = require('./utils');
```