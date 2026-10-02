# HINT 365 · Owner costs and earnings (AI features)

What the owner spends and earns with the AI features: the 15-day trial, then the 4.99 US$ yearly
subscription. Estimates made on 02.10.2026 for the decision of Human (terms v21). The real figures are:
- in the web **Admin** console, tables *Usage* and *Income and expenses* (month by month, from `ai_spend_daily` and `sub_sales_daily`);
- in the AI provider's console (usage and the monthly spend limit);
- in the Google Play Console (earnings).

## The rules these numbers follow

| Rule | Value | Where in the code |
|---|---|---|
| The app (voice, lab results, charts, reports, Web Dashboard) | free | no gate on the subscription |
| AI features trial | 15 days from the first Scan, once per Google account and per phone | `TRIAL_DAYS`, table `scan_trials` |
| Scans a day, trial and subscription | 3 per person (the owner: 30) | `SCAN_FREE`, `SCAN_PLUS` |
| Subscription | 4.99 US$ a year, through Google Play | `hint365_annual`, `SUB_PRICE_CENTS` |
| Yearly AI allowance per subscriber | 2.50 US$, counted from the tokens the provider reports, in D1 | `SCAN_YEAR_USD`, table `scan_usage` |
| AI key | only the owner's, in the secret `AI_API_KEY` (today an Anthropic key); nobody adds their own | `build.yml`, Worker secret |
| Overall spend limit | set by the owner in the AI provider's console | outside the code |

## Cost of one Scan

| Item | Assumption |
|---|---|
| Model | Claude Haiku 4.5, list price 1 US$ per million input tokens, 5 US$ per million output tokens |
| Photo | 1280 × 960 px after the app shrinks it ≈ 1,640 tokens (width × height / 750) |
| Instructions | ≈ 160 tokens |
| Answer | ≈ 25 tokens (three numbers in JSON) |
| **One Scan** | 1,800 × 1 µ$ + 25 × 5 µ$ ≈ **0.002 US$ (0.2 cents)** |

A retake is a new Scan and costs the same; it counts in the 3 a day. For comparison, the same Scan with
Claude Opus would cost about 0.012 US$, six times more.

Daily use profiles used below: **light** 1 Scan a day, **typical** 2, **maximum** 3 (the limit).

## Trial: owner's exposure

Each person costs the owner at most 45 Scans, once in their life (15 days × 3).

| Users in trial | Light (15 Scans each) | Typical (30) | Maximum (45) |
|---|---|---|---|
| 1 | 0.03 US$ | 0.06 US$ | 0.09 US$ |
| **100** | **3 US$** | **6 US$** | **9 US$** |
| 200 | 6 US$ | 12 US$ | 18 US$ |

A second phone or a new account does not start a new trial, so 100 people cannot cost more than about 9 US$.

## After the trial: one subscriber, one year

| | Light | Typical | Maximum |
|---|---|---|---|
| Scans a year | 365 | 730 | 1,095 |
| Owner's AI cost | 0.73 US$ | 1.46 US$ | 2.19 US$ |
| Price paid | 4.99 US$ | 4.99 US$ | 4.99 US$ |
| Google Play fee (15% on subscriptions) | −0.75 US$ | −0.75 US$ | −0.75 US$ |
| **Owner keeps (price without tax)** | **3.51 US$** | **2.78 US$** | **2.05 US$** |
| Owner keeps if the 4.99 US$ include 20% VAT (net 3.53 US$) | 2.80 US$ | 2.07 US$ | 1.34 US$ |

With Haiku a subscriber can never cost more than 2.19 US$ a year: the 3 a day limit stops first. The 2.50 US$
allowance (about 1,250 Scans at today's price) matters only if the model becomes more expensive. With Opus, for
example, it would stop the Scan after about 200 Scans in the year. The app shows the subscriber how many Scans are
left, estimated from their own recorded use.

People who do not subscribe cost the owner nothing after the trial: voice, lab results and the dashboard use no AI.

## At full speed: 200 people with the app

All 200 have used their trial (once: 12 to 18 US$). The table is per year, for three shares of subscribers.

| | 10% subscribe (20) | 25% subscribe (50) | 50% subscribe (100) |
|---|---|---|---|
| Paid by subscribers | 99.80 US$ | 249.50 US$ | 499.00 US$ |
| After the Google Play fee | 84.83 US$ | 212.08 US$ | 424.15 US$ |
| AI cost, typical use | 29.20 US$ | 73.00 US$ | 146.00 US$ |
| AI cost, everybody at the maximum | 43.80 US$ | 109.50 US$ | 219.00 US$ |
| **Owner keeps, typical** | **55.63 US$** | **139.08 US$** | **278.15 US$** |
| Owner keeps, everybody at the maximum | 41.03 US$ | 102.58 US$ | 205.15 US$ |
| Owner keeps at the maximum, if prices include 20% VAT | 26.80 US$ | 67.00 US$ | 134.00 US$ |

Other costs, outside the table:

| Item | Cost |
|---|---|
| Google Play developer account | 25 US$ once |
| Cloudflare Workers and D1 | free plan (100,000 requests a day) is enough for 200 people; the paid plan is 5 US$ a month if ever needed |
| The owner's own Scans (up to 30 a day) | about 1.46 US$ a year at 2 a day; at most 22 US$ a year at 30 a day |
| Trial of each new person | at most 0.09 US$, once |

With the free Cloudflare plan every subscriber leaves a margin. With the paid plan (60 US$ a year) the break-even
is about 22 subscribers at typical use.

## What protects the owner

1. 3 Scans a day per person, on the server: a 4th request never reaches the AI provider.
2. One trial per Google account and per phone.
3. At most 2.50 US$ of AI per subscriber a year, recorded in D1 from the provider's token count.
4. The monthly spend limit in the AI provider's console: above it the provider refuses, the Scan says to use voice.
5. The terms let the owner change prices, limits and free parts, or withdraw the app.
6. The owner's powers and these figures are visible only from the owner's phone (owner code on a new phone).

## Limits of this estimate

- Token counts are estimates: the Admin console and the provider's console give the real ones after the first Scans.
- Income in the Admin console is counted at the list price (4.99 US$) when Google Play confirms a new paid year;
  local prices, taxes and refunds are only in the Google Play Console.
- Prices are Anthropic's list prices on the day of writing; the model may change (`SCAN_MODEL`).
- How well Haiku reads real displays is still to be measured. If it is not good enough and the model goes back to Opus,
  the AI cost per Scan rises about six times and the 2.50 US$ allowance becomes the real limit.
