- `sync-sibling-docs` now also deletes the images copied for an optional page
  when it removes that page after an upstream 404 (hivecommons/docs#545),
  unless another synced page still references them. Only files under the
  project's content folder are touched.
