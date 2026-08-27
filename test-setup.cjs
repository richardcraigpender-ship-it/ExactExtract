const { TextEncoder, TextDecoder } = require('node:util')
const Module = require('node:module')
const { DOMMatrix, ImageData, Path2D } = require('@napi-rs/canvas')

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = DOMMatrix
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = ImageData
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = Path2D
}

Module._extensions['.css'] = function loadCss(module) {
  module._compile('', module.filename)
}

module.exports = {}
