Sanitizer and Deep-Scan Usage

Files:
- sanitize_report.js  — Produce a compact, non-destructive sanitized report (JSONL). By default binary data (images) are omitted and replaced with lightweight placeholders. Use `--include-files` to include binary summaries (not recommended for large reports).
- deep_scan.js        — Produce a structured issues report (.deep_scan.json) that highlights console warnings, cache/version mismatches, large cached entries, and IndexedDB image usage.
- report_summary.js   — Quick summary (top files, large strings) to `*.summary.json`.

Safety guarantees:
- None of these scripts modify the original report file or the application data on disk. They only read input and write new output files.
- By default images and base64 blobs are not decoded or written to the sanitized output. This prevents large outputs and preserves original data.

Common commands (from project root):

# sanitized, streamed, gzipped (safe default)
node scripts/sanitize_report.js detailed_bug_report_2025-12-27T13-28-29-511Z.extracted\\detailed_bug_report_2025-12-27T13-28-29-511Z.json --out detailed_bug_report.sanitized.jsonl --stream --gzip

# deep analysis
node scripts/deep_scan.js detailed_bug_report_2025-12-27T13-28-29-511Z.extracted\\detailed_bug_report_2025-12-27T13-28-29-511Z.json

# quick summary
node scripts/report_summary.js detailed_bug_report_2025-12-27T13-28-29-511Z.extracted\\detailed_bug_report_2025-12-27T13-28-29-511Z.json

Notes:
- If you really need full binaries inside the report (for complete reproduction), add `--include-files` when running the sanitizer. Expect very large outputs.
- If you plan to make this the team default, add an npm script or CI step that runs the sanitizer with the safe defaults.
