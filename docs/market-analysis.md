# Market Analysis

This document records the current market scan for products similar to `phishalert`.

## What the market already has

The broader phishing / brand-protection market already includes products that do parts of this workflow:

- `Rapid7 Threat Command / Phishing Watch`
  - JavaScript snippet embedded in the protected website
  - clone detection
  - redirect detection
  - iframe detection
  - remediation / takedown workflows

- `Cyberint`
  - phishing beacon concept
  - continuous detection of phishing and impersonation
  - takedown-oriented workflow

- `Netcraft`
  - web beacon and referrer-feed style integrations
  - continuous phishing discovery and takedown

- `Axur`
  - brand protection
  - evidence gathering
  - takedown automation

- `ZeroFox`, `BrandShield`, `Allure Security`, `ShadowMap`
  - broader digital risk / brand protection / phishing takedown coverage
  - monitoring, validation, evidence, and response

## Closest matches

The closest public references found were:

1. `Rapid7 Threat Command / Phishing Watch`
   - explicitly documents a JavaScript snippet embedded on the protected site
   - detects when a legitimate site is being loaded from a suspicious or unknown domain
   - includes clone detection, redirect detection, and iframe detection

2. `Netcraft`
   - explicitly mentions `Web Beacon`
   - also mentions `Referrer Feed`
   - combines automation and takedown operations

3. `Cyberint`
   - positions a phishing beacon as an early signal from legitimate web assets
   - uses that signal to detect cloned or redirected sites

## What looks similar to `phishalert`

The overlapping ideas are:

- a small snippet on the official site
- page-load signaling
- referrer/origin context
- correlation of suspicious redirects
- evidence collection
- takedown workflow

## What can still differentiate `phishalert`

The differentiation opportunity is not the raw concept alone. The market already has that.

The potential edge is:

- simpler installation
  - only a small `head` snippet
  - no border changes required

- narrower problem framing
  - focused on the official login page
  - focused on redirect abuse and page-load signals

- lower operational overhead
  - small backend
  - simple event schema
  - easy dossiê export

- easier commercial pilot
  - fast deployment
  - low implementation friction
  - easier first-customer proof of value

## Risks to avoid

- Promising perfect detection
- Promising automatic takedown in every case
- Depending on a single signal such as `referrer`
- Making the onboarding too heavy
- Collecting unnecessary data

## Product hypothesis

If `phishalert` wants to be better than the existing tools, it should aim for:

- faster installation
- simpler operations
- clearer evidence output
- better signal-to-noise ratio
- a focused workflow for official login pages

## Source References

- [Rapid7 Threat Command / Phishing Watch](https://docs.rapid7.com/threat-command/phishing-watch)
- [Rapid7 Website Redirect Detection](https://docs.rapid7.com/threat-command/website-redirect-detection/)
- [Cyberint Digital Brand Protection](https://cyberint.com/solutions/use-case/brand-protection/)
- [Cyberint Phishing Detection](https://cyberint.checkpoint.com/platform/new-phishing/)
- [Netcraft Phishing Protection](https://www.netcraft.com/platform/threat-detection-and-takedown/phishing-protection)
- [Axur Brand Protection](https://www.axur.com/en-us/brand-protection)
- [ZeroFox Protection](https://www.zerofox.com/solutions/protection/)
- [Allure Security Website and Domain Protection](https://alluresecurity.com/fake-website-detection-and-takedowns/)
- [BrandShield Phishing Website](https://l.brandshield.com/phishing_website)
- [ShadowMap Brand Protection & Takedowns](https://shadowmap.com/brand-protection-takedowns/)

