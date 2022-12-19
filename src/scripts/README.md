# Scripts

This directory contains scripts to help automate tasks. Find instructions for usage below 👇

## `import-failed-emails-to-notion.ts`

This script queries our database for any email with the status `RECEIVED_TO_DECO` AND a time

### How to run

1. set the `CREATED_AT_TIMESTAMP` environemnt variable. Make sure that this in in the format of `<YEAR>-<MONTH>-<DATE>` (e.g. `2021-01-01`)
2. run `yarn run-re-import-script`

#### Example uses

```sh
CREATED_AT_TIMESTAMP="2021-01-01" yarn run-re-import-script
```
