var types = require('ast-types');
var def = types.Type.def;

def('ExperimentalSpreadProperty')
  .bases('Node')
  .build('argument')
  .field('argument', def('Expression'))

types.finalize();
