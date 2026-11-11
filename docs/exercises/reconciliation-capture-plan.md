# Next exercise: "Watch a hand-made change get reverted"

Capture design for the second security-track exercise. Written **before** any lab run, so the
capture is designed against the existing reconciliation package's boundaries rather than
rediscovering them afterwards.

Source package: `gitignored/hedgehog-reconciliation-whitepaper/`. Boundary review by devb,
2026-11-11.

## What the existing package already establishes — do not re-argue it

- **Two connected loops.** The controller derives switch-specific `Agent` intent from the fabric
  graph; the switch agent reads actual state, computes a diff, applies ordered changes, reports status.
- **Enforcement runs on Kubernetes events and a periodic cycle**, so a manual change inside managed
  scope can be corrected without a new intent change.
- **Failure handling is iterative.** An action error stops that pass; a later pass re-reads actual
  state and computes the remaining difference. **This is convergence, not transactional rollback.**
- **Inspection exists:** `last-desired.yaml`, `last-actual.yaml`, a text diff, dry-run support.

The exercise's job is to **demonstrate** this mechanism, not to extend its claims.

## Hard boundaries — binding on the exercise

The exercise may show: *a change to managed configuration is reconciled back toward unchanged
declared intent.* It must **not** imply any of:

- malicious-change prevention
- identifying who made the edit
- uninterrupted forwarding during the interval
- tenant separation holding during the interval
- fabric-wide atomic recovery

Also out of scope, per the package: enforcement covers **managed scope**, not every switch setting;
admission validates intent against Hedgehog's API model, not every network design; Hedgehog does not
replace the NOS (forwarding, routing, platform services, telemetry, ASIC programming stay NOS);
the out-of-band management network is outside management scope; detailed RoCE queue and threshold
behaviour is NOS/platform configuration.

**Desired state is switch-specific.** Reconciliation does not mean identical configuration on every
leaf, and the exercise must not drift into implying it. (The first story already had to be corrected
for a related overclaim.)

## The wording trap, and what it forces the capture to do

**A periodic enforcement cycle is not a guaranteed restoration deadline.** The package itself
describes failed actions and subsequent retries. The documented interval is a *mechanism*, not an SLA.

Therefore **correction time is something this capture must measure, not assert.** The exercise states
an observed figure from a named number of trials, with the spread, and says plainly that it is an
observation on one lab and not a commitment.

Short-form copy says "periodic enforcement". The specific interval belongs only in detailed copy,
and only as the documented mechanism.

## What the capture must record

| # | Step | Recorded |
|---|---|---|
| 1 | Converged baseline with `tenant-a` applied | agent generations, `last-desired.yaml`, `last-actual.yaml` |
| 2 | Hand-edit managed configuration on `leaf-01` | exact command, timestamp, what was changed |
| 3 | Poll until the switch's actual state matches desired again | **wall-clock to correction**, agent status transitions |
| 4 | Repeat the trial several times | every duration, so the page can show spread rather than one flattering number |
| 5 | Capture the agent's own diff output | the text diff, as the product renders it |
| 6 | **Edit something outside managed scope** | show it is *not* reverted |

Step 6 is not optional. Demonstrating the boundary is what makes the capability credible, and it is
the same move that made the first exercise defensible.

## Version baseline — a discrepancy to carry, not paper over

The reconciliation package pins its implementation citations to **Fabric v0.131.0**, commit
`61f678b81a17659b03ed532854da28edcaed1074`.

The tenant capture already published was taken on **hhfab v0.51.4 / fabric agent v0.144.1** — a
later release. Neither verifies the other. If this exercise runs on the newer release, it states its
own version and does not claim to confirm the package's pinned citations, and the package's figures
are not restated as though measured here.

## Claim gates inherited from HREC-004

- Hardware and role support claims follow the supported-devices documentation.
- **Celestica SONiC+ and Cumulus must not be presented as GA.** Celestica hardware support does not
  establish Celestica SONiC+ support.
- Approved ESLAG wording, if needed: "Hedgehog's ESI multi-homing connection model: a port-channel
  connection from one server to two to four switches."

## Cost

One VLAB run, roughly an hour. The local host is viable (it ran the first capture) subject to disk;
otherwise a GCP VM at about $1.52/hour. No always-on environment is required for this exercise.
