# Minimal multi-fabric reproducer (#501)

The smallest wiring that answers the gating architectural question for the Hot Lab:

> **Can a single Hedgehog `Server` hold `Connection`s into more than one `Fabric`?**

## Answer: yes — accepted by the API, and the acceptance is verified meaningful

**Environment** (GCP `n2-standard-16`, Ubuntu 24.04.5, nested virt, `/dev/kvm` present):

| Component | Version |
|---|---|
| hhfab | **v0.51.3** (GA, `ghcr.io/githedgehog/fabricator/hhfab-linux-amd64`) |
| fabric API | **v0.144.1** (per `hhfab versions`) |

### Positive result
```
$ hhfab init --dev -w mf-wiring.yaml
INF Imported wiring file name=include/mf-wiring.yaml
$ hhfab validate
INF Wiring hydrated successfully mode=if-not-present
INF Fabricator config and wiring are valid      # rc=0
```
`gpu-01` holds two `Connection`s — `gpu-01--unbundled--fe-leaf-01` with `topology.fabric: default`, and `gpu-01--unbundled--be-leaf-01` with `topology.fabric: backend`. Fifteen objects loaded; validation passes.

### Negative control — why the positive is trustworthy
A positive alone proves nothing if validation never checks fabric membership. Control: point the `backend`-declared connection at a **frontend** leaf, change nothing else.

```
$ hhfab validate
ERR validating: ... validating *v1beta1.Connection "gpu-01--unbundled--be-leaf-01":
    connection is in fabric backend but switch fe-leaf-01 is in fabric default   # rc=1
```

Validation **does** enforce per-Connection fabric membership (`connection_types.go:896`). So accepting a Server across two Fabrics is a deliberate allowance, not an unchecked gap.

> A first attempt at this control silently did nothing — the `sed` used 6 spaces where the YAML indents 8, so the "control" file was byte-identical to the positive and of course passed. It was caught only by printing the mutated block before trusting the result. Verify that a control actually established its condition before believing it.

## Scope of this evidence — read before citing it

- **API / control-plane layer only.** This is `hhfab validate`: schema, hydration and cross-reference checks. No VM booted for this result.
- It does **not** establish that the topology comes up, that NIC naming is stable, that both Fabric control planes converge, or that any traffic flows.
- Per #492: VLAB convergence would be control-plane evidence; connectivity and isolation claims need separately qualified data-plane evidence; and no CPU/VLAB demonstration proves GPU, RDMA or line-rate behaviour.
- The VLAB generator additions from `pau/hhfab-add-fabric` (`--extra-fabric`, `hhfab add-fabric`) are **not** in v0.51.3. They are not needed: wiring arrives through the supported `include/` path.

## Gotchas worth keeping

1. **`IPv4Namespace` is in `vpc.githedgehog.com/v1beta1`**, not `wiring.…`. Using the wiring group fails import with *no kind "IPv4Namespace" is registered*. (`lab-wiring/ai-factory-26.05/` already had this right.)
2. **A failed `hhfab init` leaves `include/` empty, and `hhfab validate` then passes** — because it validates the default config instead. A green `validate` means nothing unless `include/` is confirmed populated. Check `ls include/` and the object count.
3. `hhfab` requires `oras`; install it first or the installer exits with a hint.
4. The `hhfab init --help` text quotes `Versions.Fabric.API v0.133.0` as an example. That is stale — `hhfab versions` reports the real value. It matters: fabric v0.133.0 predates the `Fabric` CRD, which first appears in **v0.135.0**.

## Reproduce
```bash
sudo sh -c 'curl -fsSL https://i.hhdev.io/oras | bash'
sudo sh -c 'curl -fsSL https://i.hhdev.io/hhfab | bash'
mkdir mf && cd mf
hhfab init --dev -w /path/to/wiring.yaml
ls include/ && grep -c '^kind:' include/*.yaml   # confirm it actually imported
hhfab validate
```
