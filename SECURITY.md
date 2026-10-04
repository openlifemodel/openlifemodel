# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report them
privately through GitHub:
[Report a vulnerability](https://github.com/OpenLifeModel/openlifemodel/security/advisories/new)
(Security tab → "Report a vulnerability").

Please include what you found, how to reproduce it, and the impact you expect.
We aim to acknowledge reports within a few days and will keep you updated while
we fix the problem. We are happy to credit you once a fix is released.

## Scope

- The engine, reference web app and model validation in this repository.
- The hosted site at openlifemodel.com, including the early-access sign-up.

The calculator runs in the visitor's browser and the site does not receive
health answers, so issues that could expose a visitor's inputs, run code in
their browser, or tamper with model files on import are especially important.

Out of scope: denial-of-service, automated scanner output without a
demonstrated impact, and missing security headers that have no practical
effect.
