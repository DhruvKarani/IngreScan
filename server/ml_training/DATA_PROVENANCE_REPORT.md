# Data Provenance Report (Training Dataset)

Date: 2026-04-04
Scope: Evidence and source traceability for ML training data used by DistilBERT category classification.

## Executive Summary

- Source coverage is complete in all training pipeline outputs reviewed (100% rows have `source`).
- Reference coverage is high (~90%) in training outputs.
- Verified source labels present in training split: EFSA, FDA GRAS, FooDB, Firebase.
- Main gap: FooDB rows in training do not carry formal regulatory references in the `reference` field.

## Files Reviewed

- `balanced_training_data.csv`
- `train.csv`
- `val.csv`
- `test.csv`

## Provenance Coverage Metrics

| File | Total Rows | Source Filled | Source Missing | Source Coverage | Reference Filled | Reference Missing | Reference Coverage |
|---|---:|---:|---:|---:|---:|---:|---:|
| balanced_training_data.csv | 9,481 | 9,481 | 0 | 100.00% | 8,586 | 895 | 90.56% |
| train.csv | 6,636 | 6,636 | 0 | 100.00% | 6,015 | 621 | 90.64% |
| val.csv | 1,422 | 1,422 | 0 | 100.00% | 1,276 | 146 | 89.73% |
| test.csv | 1,423 | 1,423 | 0 | 100.00% | 1,295 | 128 | 91.00% |

## Training Split Source Breakdown

From `train.csv`:

- EFSA: 3,737 rows
- FDA GRAS: 2,052 rows
- FooDB: 621 rows
- Firebase: 226 rows

## Training Split Reference Coverage by Source

From `train.csv`:

- EFSA: 3,737 / 3,737 (100.00%)
- FDA GRAS: 2,052 / 2,052 (100.00%)
- FooDB: 0 / 621 (0.00%)
- Firebase: 226 / 226 (100.00%)

## What This Proves

- Every training row is traceable to a declared source (`source` field).
- Most training rows include a backing reference (`reference` field).
- Regulatory-backed sources (EFSA/FDA GRAS) are fully referenced in the training split.

## Current Limitation (Important)

- This proves data provenance and reference presence, not per-row rule-level explainability.
- The pipeline does not currently store explicit assignment rationale per row (for example: matched E-number, matched keyword, fallback path) in final training CSVs.

## Suggested Audit Statement

"The training dataset maintains explicit provenance (`source`) for 100% of rows and explicit references (`reference`) for approximately 90% of rows. Regulatory-source records (EFSA and FDA GRAS) in the training split have full reference coverage. Remaining reference gaps are concentrated in FooDB-derived entries."
