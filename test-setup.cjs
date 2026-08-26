const { TextEncoder, TextDecoder } = require('node:util')
const Module = require('node:module')

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}

Module._extensions['.css'] = function loadCss(module) {
  module._compile('', module.filename)
}

module.exports = {}
