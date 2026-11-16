# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/oktamind/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/oktamind/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 178 pre-token protocols by an implied value a comps curve fits on the snapshot's own live-token protocols: log(market cap) = 6.965 + 0.522 × log(TVL), fitted by least squares on 128 comps and validated out of sample (5-fold CV R² 0.17; growth, age and chains were tested and did not survive validation). The board covers all 40 watchlist protocols plus 138 early ones below the $50M floor.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

Entered on [make.fun](https://make.fun/?ref=rrts6br6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
