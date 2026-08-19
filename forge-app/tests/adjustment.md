# Adjustment Engine Stress Tests

## Test Results

| Test | Status | Notes |
|------|--------|-------|
| A1 | ✅ | Move earlier by 60 min |
| A2 | ✅ | Move earlier by 30 min |
| A3 | ✅ | Move earlier overlap → returns unchanged plan |
| B1 | ✅ | Move later by 60 min |
| B2 | ✅ | Move later by 30 min |
| C1 | ✅ | Delete unlocked |
| C2 | ✅ | Delete locked → returns unchanged plan |
| D1 | ✅ | Add new task |
| D2 | ✅ | Add duplicate → returns unchanged plan |
| E1 | ✅ | Update duration shorter |
| E2 | ✅ | Update duration longer |
| F1 | ✅ | Lock commitment |
| F2 | ✅ | Unlock commitment |
| G1 | ✅ | Overlap detection → returns unchanged plan |
| G2 | ✅ | Out of order → returns unchanged plan |
| G3 | ✅ | Duplicate times → returns unchanged plan |
| H1 | ✅ | Move before midnight → returns unchanged plan |
| H2 | ✅ | Empty plan → returns unchanged plan |
| I1 | ✅ | Returns EngineEvents on success |
| I2 | ✅ | Returns empty events on failure |
| I3 | ✅ | Does not mutate original plan |
| **Total** | **21/21** | |
