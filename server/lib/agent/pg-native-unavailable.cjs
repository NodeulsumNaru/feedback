module.exports = class NativeClient {
  constructor() {
    throw new Error('Native PostgreSQL bindings are unavailable in Workers; use the JavaScript client')
  }
}
