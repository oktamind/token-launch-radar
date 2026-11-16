# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/oktamind/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/oktamind/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 178 pre-token protocols by an implied value a comps model fits on the snapshot's own live-token protocols: a size curve (log(market cap) = 6.965 + 0.522 × log(TVL)) plus empirical-Bayes category effects, seven-day growth and age with no token, all fitted by least squares on 128 comps. Out of sample it cuts squared error by 20% against the flat category multiple. Every farm plan is netted to FARM, THIN or SKIP by the value each locked dollar creates at launch. The board covers all 40 watchlist protocols plus 138 early ones below the $50M floor.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

Entered on [make.fun](https://make.fun/?ref=rrts6br6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
