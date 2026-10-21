# Project conventions

- Parse uploaded Excel workbooks through `src/lib/parse-excel-upload.ts` with date cells preserved as Date values, so automatic ETL receives calendar dates rather than fractional Excel serials; keep the XLSX dependency lazy-loaded.