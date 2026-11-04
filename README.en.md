<div align="center">

# Zi Wei Dou Shu · Open-Source Charting Engine

### Algorithms are openly shared traditional wisdom; they shouldn’t be locked behind walls.

[![CI](https://github.com/Renhuai123/ziwei-doushu/actions/workflows/ci.yml/badge.svg)](https://github.com/Renhuai123/ziwei-doushu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/dataset-CC%20BY%204.0-green.svg)](./DATASET-LICENSE)

[中文](./README.md) · **English**

</div>

**1. Philosophy:** Zi Wei Dou Shu is a treasure of traditional Chinese astrology, and Ni Haixia laid out its authentic system in *Tian Ji* (《天纪》). We hope technology can bring more people to learn it.

We open-source the charting algorithm and the knowledge base because we believe **algorithms are openly shared traditional wisdom and shouldn’t be locked behind walls**. The real value lies in the depth of interpretation, a carefully polished user experience, and what we build up by running the service day after day.

**2. About the project:** A Zi Wei Dou Shu (紫微斗数, "Purple Star Astrology") charting engine following the teaching system of **Ni Haixia's *Tian Ji* (倪海厦《天纪》)**. It includes the full charting algorithm, the Four Transformations (四化), a pattern knowledge base, public-domain classical texts, and a **518,400-chart sample dataset**, plus a **674,976-chart × 13-topic interpretation dataset (v4.0, 2026-10-15): 8.77 million readings, about 20.4 billion characters of text, 56.6 GB uncompressed** — up from 518,400 charts and 33.1 GB in v3.0.

| Dataset | Charts | Readings | Uncompressed | Years | Characters per chart |
|---|---|---|---|---|---|
| **v4.0 interpretations** (2026-10-15) | **674,976** | **8,774,688** | **56.6 GB** | **1950–2026** (real dates only) | **~30,000** |
| v3.0 samples | 518,400 | 6,739,200 | 33.1 GB | 1924–1983 | ~21,000 |
| Change | +30% | +30% | **+71%** | +17 years | +44% |

<sub>v3.0 characters per chart estimated from a 2,160-chart sample; all other figures are full counts. Both versions have 13 topics per chart.</sub>

This repo is an open snapshot of the engine behind [ouranic.cn](https://ouranic.cn/?from=gh-readme-en), synced from production periodically.

> **Note: on readings of family relations**
>
> Zi Wei Dou Shu has known limits when it comes to family relations (parents, siblings, children and so on). In *Tian Ji*, Master Ni Haixia said that "Dou Shu has always been somewhat weaker at reading family relations" ([lecture 2, part 1 · 00:25:27](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1527)). Among traditional methods, Tie Ban Shen Shu has its own strengths in checking family relations ([00:03:15](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=195)); Master Ni still kept Zi Wei Dou Shu at the core because it can be read together with geography, surroundings and human affairs, forming a complete system that knows the heavens above, the earth below and human affairs in between ([00:25:43](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1543)). Readings about family relations are therefore for reference only; the Parents, Siblings and Children sections on [ouranic.cn](https://ouranic.cn/?from=gh-readme-en) carry the same note.

## Latest update (2026-10-15)

![Update overview](./docs/update-20261015.png)

- **Interpretation dataset v4.0 released**: 674,976 charts (every real solar date 1950–2026 × 12 double-hours × male/female) × 13 topics = 8,774,688 readings; 161 MB compressed, 56.6 GB uncompressed (v3.0: 33.1 GB), 77 per-year files plus an all-years bundle. See [Release v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d) and the dataset section below.
- **The 13 topics were revised sentence by sentence** against the verbatim transcripts of Ni Haixia's *Tian Ji* and the original *Complete Book*: untraceable citations removed or replaced with verbatim quotes (with episode and timestamp), sentences about impossible transformations removed, conditions spelled out, two-sided sentences resolved per chart, and health now follows Master Ni's whole-chart method instead of mapping stars to organs by Five Element. (The judgment library itself stays closed; the results are in the v4.0 dataset.)
- **Engine sync** ([PR #39](https://github.com/Renhuai123/ziwei-doushu/pull/39)): `chinaDSTSpan(year)` in `dst-cn.ts`; longitudes for province-administered county-level cities in `cities.ts`.
- **License**: `DATASET-LICENSE` now covers v4.0; quotations from *Tian Ji* inside the readings are not covered by the dataset license.

> **2026-11-02 addendum**: the late Zi hour day change now uses **true solar time**, the same clock as the hour branch (#63). With a birthplace, 23:30 by the clock at 100°E (22:10 true solar time, the Hai hour) stays on the same day instead of becoming "Hai hour of the next day"; without a birthplace there is no correction and results are unchanged, matching ouranic.cn. An invalid leap-month policy now throws instead of silently charting as "same month" (#71). Thanks to Bortlesboat and xunguangzlj-cloud for the PRs and Verchiel666 for reviewing.

> **2026-10-31 addendum**: the live platform is now **OURANIC** and has moved from metisziwei.com to **[ouranic.cn](https://ouranic.cn/?from=gh-readme-en)**; old links redirect automatically. Code, datasets and licenses in this repo are unchanged.

> **2026-10-27 addendum**: engine sync. `true-solar-time.ts` accepts `utcOffsetMinutes` (the birthplace's standard UTC offset) for births outside China; results inside China are unchanged. New `clock-adjust.ts` converts a clock reading taken under daylight saving time (or an older time zone) to standard time; it never crosses midnight and is meant to run only when the user confirms. Correction: the engine detects China DST but has never subtracted it automatically; the table below said otherwise.

## What the engine handles

| Feature | Notes |
|---|---|
| True solar time | Longitude offset plus the equation of time, so births near hour boundaries are not off by one double-hour |
| China DST | 1986–1991 daylight-saving periods are detected (not subtracted automatically; convert the clock reading with `clock-adjust.ts` once the user confirms) |
| Leap months | Four configurable conventions (previous month / next month / split by day / same month) |
| Late Zi hour | 23:00–23:59 is charted on the next day, 00:00–00:59 on the same day; with a birthplace the cutoff uses true solar time (same as the hour branch); switchable |
| Star brightness | 7 levels (庙 旺 得 利 平 不 陷); brightness tables of different schools are switchable, not hard-coded |
| Four Transformations | Natal, decade (大限) and annual (流年) transformations, plus flying-star self-transformations |
| Twelve spirits | Natal layer by year branch, annual layer by the annual branch |
| Patterns | 1,100+ lines of pattern rules (紫府同宫, 日月并明, 七杀朝斗, …) |

Engine code lives in `lib/ziwei/` (entry point: `generateChart()` in `algorithm.ts`). Inputs are a **Gregorian** date and an **hour branch index 0–11** (子 = 0 … 亥 = 11), not a clock hour.

## Quick start

```bash
git clone https://github.com/Xeubad/ziwei-doushu.git
cd ziwei-doushu
npm ci
npm run dev          # charting demo at http://localhost:3000/chart

npm run typecheck    # TypeScript check
npm test             # charting regression tests
```

**No API key is needed for charting.** Charting, chart display, and compatibility chart generation all run in the browser with this repo's engine. AI interpretation (`/api/interpret`) and compatibility analysis (`/api/heming`) are implemented in this repo (`app/api/` + `lib/ai/`, OpenAI-compatible protocol); fill in a model API key in `.env.local` to enable them. Without a key, these two endpoints report "AI service not configured" (HTTP 503) — charting is unaffected.

### Docker

Run the production build without a Node toolchain (multi-stage image, non-root, built-in healthcheck, no `node_modules` inside):

```bash
git clone https://github.com/Xeubad/ziwei-doushu.git
cd ziwei-doushu

# optional: AI configuration (charting works without it)
cp .env.example .env.local

# build + start in one step
docker compose -f docker/docker-compose.yml up -d
# open http://localhost:3000
```

**Build the image yourself** (without compose, from the repo root):

```bash
docker build -f docker/Dockerfile -t ziwei-doushu .

# --env-file injects the AI configuration; omit it if you have no .env.local
docker run -d --name ziwei-doushu -p 3000:3000 --env-file .env.local ziwei-doushu

docker logs -f ziwei-doushu      # logs
docker rm -f ziwei-doushu        # stop & remove
```

Secrets are injected at runtime and never baked into the image. See [docker/README.md](./docker/README.md) for details (healthcheck, env vars, rebuild).

**After code updates** (images are immutable — don't edit files inside the container):

```bash
git pull
docker compose -f docker/docker-compose.yml up -d --build   # rebuild image + replace container
```

### Chart sharing (optional)

A chart can be shared via a code link (`/chart?d=...`). The code carries the birth data plus a snapshot of the AI readings — **never the owner's questions** — and the recipient gets a read-only view (no follow-up chat). The code is Base64, not encryption: treat it as public. The owner's own conversation stays in `localStorage` and is restored next time.

## What is not included

The interpretation database (`lib/ziwei/db-analysis.ts` is a placeholder), the full commercial AI prompts and interpretation content, user accounts, payments, server-side security (signing, anti-abuse, watermarking), and deployment configuration. The AI endpoints included here are a working baseline built from this repo's open knowledge (`lib/ziwei/patterns.ts` and `heming-knowledge.ts`); tune `lib/ai/prompts.ts` to shape your own style.

## Interpretation dataset v4.0 (674,976 charts × 13 topics, 2026-10-15)

Download from [Releases → v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d): 77 per-year files `year-YYYY.jsonl.zst` (161 MB compressed, 56.6 GB uncompressed (v3.0: 33.1 GB)), plus `SHA256SUMS.txt` and `MANIFEST.json`.

- Every solar date from 1950 to 2026 (only dates that actually exist) × 12 double-hours × male/female; one chart per line (JSON Lines).
- Fields: `k` key, `y`/`m`/`d` solar date, `h` double-hour index 0–11 (not clock hours), `g` gender, `ms` first major star of the Life Palace (`null` if empty), `t` character counts, `c` the 13 topic readings in Markdown.
- Generated deterministically by the charting engine and the 2026-10-15 judgment library (content version `ca268829f7a9`), no AI involved. The 13 topics were revised sentence by sentence against the verbatim transcripts of Ni Haixia's *Tian Ji* and the original *Complete Book of Zi Wei Dou Shu*.
- Natal-chart view only: age-based rewording, the appended Master Ni rule sections and AI readings shown on the website are not included. Charts use the double-hour index directly, without true-solar-time correction.
- Decompress with `zstd -d --long=27 year-1990.jsonl.zst` (`--long=27` is required).
- Quotations from Ni Haixia's *Tian Ji* inside the readings are **not covered by the dataset license**: they are short citations with episode and timestamp, and copyright in the original lectures remains with the rights holder; bulk reuse of those quotations falls under the [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md) terms of chapter 5. The *Complete Book* is in the public domain.
- License: same as v3.0 — [CC BY 4.0](./DATASET-LICENSE), commercial use OK with attribution (except the quotations above).
- A single all-years bundle `ziwei-interp-v4-all.tar` is also provided.

## Sample dataset (518,400 charts)

Download from [Releases](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v3.0-samples) (3 parts, 5.5 GB in total). Each sample is generated from `birthInfo`:

- `year` / `month` / `day`: **Gregorian** date, 1924–1983 (one full 60-year cycle), days 1–30 of every month
- `hour`: **hour branch index 0–11** (子 = 0 … 亥 = 11), *not* a clock hour; the `hHH` part of each file name is the same index
- `gender`: `male` / `female`; `longitude` is fixed at 120 (no local true-solar-time correction)

**Known issue:** about 2,520 samples (0.49%) carry dates that do not exist: Feb 30, and Feb 29 in non-leap years. The engine silently rolled them over to Mar 1–2, so their content duplicates the Mar 1–2 samples. Filter out `month = 2 && day = 30`, and `month = 2 && day = 29` in non-leap years. From 2026-10-03 the engine rejects non-existent dates.

## Ni Haixia's original words (*Tian Ji*, Zi Wei part)

[`docs/tianji-ziwei/`](./docs/tianji-ziwei/) holds **1,848 quotes** from the Zi Wei lectures of *Tian Ji* (14 lectures plus 2 supplements), each linked to the second it was said in the video. Taken from the sister repo [nihai-tianji-corpus](https://github.com/Renhuai123/nihai-tianji-corpus).

## A note on fate: does the same chart mean the same destiny?

> **In one sentence**: a chart is a **tendency model and a tool for self-reflection — not a verdict.** Two people born on the same day, hour and minute with the same gender get exactly the same chart; that is what a deterministic system does (same input, same output). "Same chart, different lives" is the norm.

- **A chart describes the starting hand, not the outcome**: temperament, strengths and weaknesses, the rhythm of fortune — like the same dealt hand. How it is played depends on later choices and effort.
- **Strictly speaking the charts may differ**: the "same second" in Beijing and in Ürümqi falls in different double-hours (about a 2-hour true-solar-time gap); birthplace, family starting point and relationships diverge from there.
- **Twins are a natural counter-example**: identical charts, different lives; traditional explanations (birth order, yin/yang dynamics) exist but are not consistent within the system itself.

**Three reminders for users**

1. **Reference, not verdict.** AI interpretations, dataset readings and knowledge-base content are inferences from a chart, offered for self-understanding and decision support. They are **not medical, legal or investment advice.** For major matters, rely on real-world evidence and professional opinion.
2. **Don't treat the chart as determinism.** If "same chart = same destiny" were taken as an iron law, the system could not be self-consistent; as a "tendency model plus decision reference" it is coherent. There is also no rigorous evidence that the moment of birth determines a life's trajectory.
3. **Fate does not replace effort.** Among people with the same chart, some live out its ceiling and some its floor — the difference is their own choices. This is the project's own stance: *looking ahead at fate is not about predicting the future, but about knowing yourself — and ultimately writing your own script.*

## License

| Part | License |
|---|---|
| Code (`lib/`, `app/`, `components/`) | [MIT](./LICENSE) |
| Sample dataset (Releases) | [CC BY 4.0](./DATASET-LICENSE): commercial use OK with attribution |
| Classical texts | Public domain |
| Ni Haixia quotes (`docs/tianji-ziwei/`) | [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md): **non-commercial only** |

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md); questions go to [Discussions](https://github.com/Renhuai123/ziwei-doushu/discussions).
