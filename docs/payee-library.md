# Payee library

EXACT EXTRACT keeps the original extracted entry text in each project. For parser-derived financial rows, a separate optional `payee` value records the business description that precedes the row's numeric columns.

The global payee library is stored separately from project JSON in Electron's user-data directory. Records are deduplicated only by conservative exact normalization: Unicode compatibility normalization, case folding, whitespace collapse, and limited separator punctuation normalization. The library does not perform fuzzy matching or assign coding rules.

Each record retains paired project and entry provenance with first/last-seen timestamps. Re-saving the same project entry is idempotent; the same normalized payee observed in another project adds a provenance occurrence.

Removing a project from Recent Projects, deleting a project file, or otherwise removing project data must not silently delete a global payee record. Historical provenance is intentionally retained. Any future provenance cleanup or payee deletion must be implemented as a separate, explicit user operation.

Malformed or unsupported library files are moved aside as `payees.corrupt.*.json` before a fresh library is written. Writes use a unique temporary file followed by an atomic rename.
