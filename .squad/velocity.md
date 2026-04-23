# Squad Velocity

Workflow-owned rolling weekly snapshots derived from `.squad/retro-log.md`.
Scribe rewrites the current week on rerun, but preserves older snapshots below it.

<!-- snapshots below this line, newest at top -->

## Snapshot · 2026-04-20

Window: 2026-03-24 → 2026-04-20 (rolling 4 weeks)

### Weekly throughput
| Week ending | Merged PRs | Size points |
| --- | ---: | ---: |
| 2026-03-30 | 0 | 0 |
| 2026-04-06 | 0 | 0 |
| 2026-04-13 | 0 | 0 |
| 2026-04-20 | 11 | 116 |

### Lead time percentiles by actual size
| Size | Sample PRs | P50 lead time | P90 lead time |
| --- | ---: | ---: | ---: |
| S | 0 | n/a | n/a |
| M | 4 | 13m | 24m |
| L | 3 | 30m | 30m |
| XL | 4 | 31m | 111m |

### Rolling 4-week velocity
- Median throughput: **0** size-points/week
- Noise band: **0 → 116** size-points/week

### Estimate accuracy
_Actual = impl + review. Predicted bands follow issue estimate calibration._

| Estimate | Predicted band | Sample PRs | Inside band | Accuracy |
| --- | --- | ---: | ---: | ---: |
| S | ≤4h | 0 | 0 | n/a |
| M | >4h to ≤16h | 0 | 0 | n/a |
| L | >16h to ≤48h | 0 | 0 | n/a |
| XL | >48h | 0 | 0 | n/a |

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 0.0% | ≤ 20.0% | 🟢 on-target |
| Zapp rejected rate | n/a | ≤ 5.0% | 🟡 insufficient-data |
| Revert rate | n/a | ≤ 2.0% | 🟡 insufficient-data |

### Sample notes
- Retro rows analyzed: **11**
- Merged PRs in window: **11**
- Rows with estimate/rejection/revert metadata: **0**

---
