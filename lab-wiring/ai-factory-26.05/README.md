# AI-factory multi-fabric wiring (Hedgehog 26.05) — Hot Lab

Hand-written hhfab wiring for issue #500. **Authoring only**: nothing here has been provisioned, loaded into
`hhfab`, or launched. Execution is issue #501.

```
lab-wiring/ai-factory-26.05/
  README.md
  include/            <- drop these into the hhfab workdir's include/ dir
    00-fabrics.yaml     3 x Fabric
    01-namespaces.yaml  3 x VLANNamespace, 3 x IPv4Namespace
    10-frontend.yaml    3 switches + 2 fabric connections
    20-backend.yaml     6 switches + 4 fabric connections
    30-storage.yaml     3 switches + 2 fabric connections
    40-servers.yaml     10 servers + 102 server connections
    50-gateway.yaml     GatewayGroup + Gateway + 1 gateway connection
```

## Evidence tags

| Tag | Meaning |
|---|---|
| **D** | Documented by a vendor doc (none cited in this PR — no docs were consulted) |
| **S** | Source-verified: I read the code at the cited `file:line` |
| **P** | Plausible design/engineering judgement, not verified against anything |
| **U** | Unverified assumption the prototype (#501) must confirm |

Source citations are against `githedgehog/fabricator` branch `pau/hhfab-add-fabric` at **`fb0ceb4d`**
(committed 2026-11-02), read via the GitHub API on 2026-11-05. The ticket says its references were confirmed
against a local checkout at `v0.43.1-52-g4c7784de`; that is not the same commit as the branch tip I read, so
treat "26.05" as **U** — I did not verify that any release tag contains this branch.

## Not done / limits (read first)

- **No executable validation.** `hhfab`, `go`, and interpreters are unavailable to this agent. See
  [Validation](#validation) for what was checked statically and what was not.
- **Multi-fabric server attachment is unproven.** See U1.
- Nothing was loaded through `apiutil.Loader`, so field names/shapes are checked against Go struct tags by
  reading, not by decoding.

## Reference drift found

| Ticket reference | Result |
|---|---|
| `fabric_types.go` Fabric / `Domains` / `FabricDomainSpec{SpineASN,GatewayASN}` | **S** confirmed: `fabric_types.go:25-41` |
| `switch_types.go:142-149` SwitchTopology | **S** confirmed |
| `switch_types.go:559` spine in exactly one domain | **S** confirmed (`:558-560`) |
| `connection_types.go:247-252` ConnectionTopology.Fabric | **S** confirmed |
| `connection_types.go:896` switch fabric must match | **S** confirmed (`:896-897`) |
| `connection_types.go:957` server check = existence only | **S** confirmed (`:956-962`) |
| `vlabconfig.go:855` ConnectionList | **S** confirmed |
| `vlabconfig.go:897` `NICs[nic] = direct:<peer>` | **S** confirmed (`:897-898`) |
| `VLABMaxNICs = 64` | **S** `vlabconfig.go:62-64` (32 NICs/PCI bridge x 2 bridges); enforced `:1215` |
| `vlabconfig.go:1350-1376` NIC model | **S** confirmed: `e1000` default `:1350`, `virtio-net-pci` is `VLABVirtioNet` `:42` |
| `vlabconfig.go:938,541` tap carrying `Boot.MAC` | **MOVED**. `Boot.MAC` → `management:<MAC>` at `:835`; management tap is `tap,ifname=...` at `:1332` (`:1303` for link taps) |
| `vlabrunner.go:313` ONIE then NOS install | **MOVED**. ONIE files fetched `:383-397`; per-VM `os.img` qcow2 created `:346`; attached as drive `:463` |
| `ExtraFabric` = "second fabric of two mesh leaves with a server each" | **S** `vlabbuilder.go:133` and `:1060-1110` (mesh, no spine) |
| `IncludeDir = "include"` and the prompt text | **S** `cmdconfig.go:28`, `:239` |
| Loader validates Fabric/Switch/Server/Connection lists | **S** and more: it also validates VLAN/IPv4 namespaces, VPC*, External*, Gateway* (`apiutil/include.go:33-130`) |

## Hardware profile modeled (P)

The customer's reference is a B200-class 8-GPU server. **I did not consult a vendor datasheet**, so the NIC
counts below are the ticket's budget, not a verified hardware spec (**U**: confirm against the real BOM).

Per leasable GPU server (`gpu-01`..`gpu-08`), 12 data NICs + 1 management:

| VLAB NIC | Role | Fabric / domain | Lands on |
|---|---|---|---|
| `enp2s0` | management | (hhfab management bridge) | not in wiring; assumed added by hhfab (**U** — `vlabconfig.go:610` uses `NICTypeManagement` but I did not trace server handling) |
| `enp2s1` | frontend A | frontend / default | `fe-leaf-01` |
| `enp2s2` | frontend B | frontend / default | `fe-leaf-02` |
| `enp2s3` | rail 0 | backend / plane-a | `be-a-leaf-01` |
| `enp2s4` | rail 1 | backend / plane-a | `be-a-leaf-02` |
| `enp2s5` | rail 2 | backend / plane-a | `be-a-leaf-01` |
| `enp2s6` | rail 3 | backend / plane-a | `be-a-leaf-02` |
| `enp2s7` | rail 4 | backend / plane-b | `be-b-leaf-01` |
| `enp2s8` | rail 5 | backend / plane-b | `be-b-leaf-02` |
| `enp2s9` | rail 6 | backend / plane-b | `be-b-leaf-01` |
| `enp2s10` | rail 7 | backend / plane-b | `be-b-leaf-02` |
| `enp2s11` | storage A | storage / default | `st-leaf-01` |
| `enp2s12` | storage B | storage / default | `st-leaf-02` |

Why this assignment (P): rails 0–3 are plane-a and 4–7 plane-b (half the GPUs per plane); within a plane,
alternating rails across the two leaves spreads each server's plane links over both leaves so losing one leaf
degrades rather than severs a plane. This is **my** choice, not a universal GPU layout.

Port naming `enp2sN` follows the generator default (S `vlabbuilder.go:1371-1380`, `ServerPortBase = "enp2s"`),
so these names assume the default server image/`flatcar` stable naming (S `vlabconfig.go` NIC bus math `:1396`:
bridge `nicID/32`, slot `nicID%32`; 13 NICs sit on bridge 0). Switch ports use `E1/N` (S `vlabbuilder.go:1352`).

Shared-service servers (P; role split is my choice, the ticket only says "2"):

| Server | NICs | Fabrics |
|---|---|---|
| `svc-01` | `enp2s1,2` frontend; `enp2s3,4` storage | frontend + storage |
| `svc-02` | `enp2s1,2` frontend | frontend |

### NIC budget (S arithmetic)

| VM | Data NICs | + mgmt | Ceiling | OK |
|---|---|---|---|---|
| gpu-0N | 12 | 13 | 64 (`VLABMaxNICs`) | yes |
| svc-01 | 4 | 5 | 64 | yes |
| svc-02 | 2 | 3 | 64 | yes |
| backend leaf | 16 server + 2 up = 18 ports | — | switch ports, generator allows E1/1..48 then every 4th to ~76 (`vlabbuilder.go:1352-1368`) | yes |

## Topology

| Fabric | Domains | Switches | Server-facing links |
|---|---|---|---|
| `frontend` | default | `fe-spine-01`, `fe-leaf-01`, `fe-leaf-02` | 8 GPU×2 + svc-01×2 + svc-02×2 = 20 |
| `backend` | plane-a, plane-b | `be-a-spine-01`, `be-a-leaf-01/02`, `be-b-spine-01`, `be-b-leaf-01/02` | 8 GPU×8 = 64 |
| `storage` | default | `st-spine-01`, `st-leaf-01`, `st-leaf-02` | 8 GPU×2 + svc-01×2 = 18 |

Uplinks: 2 links per leaf↔spine. Gateway `gateway-1` is cabled to `fe-spine-01` (2 links) in
frontend/default — a Gateway takes exactly one fabric+domain (S `gateway_types.go:31-35`), so only the frontend
has north-south reach. That is a design choice (P), not a requirement.

### Rail-fidelity tradeoff (P)

The ticket's "cheaper form": 2 leaves per plane, each server contributing 2 rail NICs to each leaf, instead of
one leaf per rail. This reproduces the host's multi-plane policy-routing problem (several NICs per plane,
two next-hops) at 6 backend switches instead of 10 (8 rail leaves + 2 spines). It does **not** reproduce
per-rail isolation: two rails share a leaf, so rail-to-rail contention/failure-domain behaviour is not
representative. A full-rail variant would add 4 leaves = +16 vCPU, +20 GiB RAM, +200 GB disk (S arithmetic
from the sizes below).

## ASN plan (S for the rules, P for the chosen numbers)

Rules enforced by `Fabric.Validate` (S `fabric_types.go:184-244`): leaf range required and ordered; spine and
gateway ASNs set, unique, outside every leaf range; leaf ranges must not overlap across Fabrics; no spine or
gateway ASN may equal or fall inside another Fabric's range. Spine ASN must equal its domain's `spineASN`
(S `switch_types.go:568`, `hydrate.go:445-451`).

Numbers continue the generator's asdot convention — spines from `.1`, gateways `.501`, leaves `.1000–.9999`
(S `pkg/fab/defaults.go:11,31-33,52`). `64087.*` is the default Fabric, `64088.*` is the generator's `fabric-b`
(S `vlabbuilder.go:1029-1035`). I start at `64089` so nothing collides with either.

| Fabric | Domain | Spine ASN | Gateway ASN | Leaf range |
|---|---|---|---|---|
| frontend | default | 4200136705 (64089.1) | 4200137205 (64089.501) | 4200137704–4200146703 (64089.1000–.9999) |
| backend | plane-a | 4200202241 (64090.1) | 4200202741 (64090.501) | 4200203240–4200212239 (64090.1000–.9999) |
| backend | plane-b | 4200202242 (64090.2) | 4200202742 (64090.502) | (shared with plane-a) |
| storage | default | 4200267777 (64091.1) | 4200268277 (64091.501) | 4200268776–4200277775 (64091.1000–.9999) |

Switch `asn`, `protocolIP`, `vtepIP`, `ip` are deliberately **not** set; hydration assigns them. Whether
hydration allocates leaf ASNs from the *switch's own* Fabric range is **U** (validation at `hydrate.go:416-427`
checks a pre-set ASN against its Fabric's range; the allocator was not read).

Domain mechanics (S): a spine is in exactly one domain; a leaf may list several (`switch_types.go:146-149`).
Here each backend leaf is in exactly one plane, so planes meet only at the servers.

## Address and VLAN namespaces per Fabric

| Fabric | IPv4Namespace (S fabric-scoped) | VLANNamespace |
|---|---|---|
| frontend | `frontend` 10.10.0.0/16 | `frontend` 1000–1999 |
| backend | `backend` 10.20.0.0/16 | `backend` 2000–2999 |
| storage | `storage` 10.30.0.0/16 | `storage` 3000–3999 |

**Discrepancy with the ticket's premise.** `IPv4Namespace` has `spec.topology.fabric`
(S `ipv4namespace_types.go:41,47`) and VPC validation rejects a VPC whose IPv4Namespace is in another Fabric
(S `vpc_types.go:771-773`). `VLANNamespace` has **no** fabric field (S `vlannamespace_types.go:30-33`: only
`ranges`). So "each Fabric owns its own VLAN namespace" is true here only by convention — distinct names,
disjoint ranges, and `switch.spec.vlanNamespaces`. Uniqueness of VLANs is checked per VLANNamespace name across
VPCs (S `vpc_types.go:898-908`), so separate names are what prevent cross-Fabric VLAN clashes.

Global (not per-Fabric) address spaces come from the Fabricator config, not the wiring (S `pkg/fab/defaults.go:14-37`):
management 172.30.0.0/21, protocol 172.30.8.0/22, VTEP 172.30.12.0/22, fabric `172.30.128.0/17`. VTEP/protocol
IP uniqueness is checked across *all* switches regardless of Fabric (S `hydrate.go:339-346`, `:485-492`).
The IPv4Namespaces above avoid all of these and the generator's `10.0.0.0/16` / `10.1.0.0/16`.

## Management / OOB per Fabric

- **One flat management L2 for everything, not one per Fabric.** VLAB gives every switch a `management:<Boot.MAC>`
  NIC (S `vlabconfig.go:835`) attached to a tap on a single management bridge (S `vlabconfig.go:70-79,1332`;
  taps capped at 100 by `VLABMaxMgmtTaps`). The control node runs DHCP/ZTP for the whole management subnet
  (S `fabric.go` DHCP config `:183-190`). Fabrics are therefore **not** management-isolated; they are only
  isolated in the data plane.
- Boot identity is the MAC: `0c:20:12:ff:NN:00`, `NN` = 01..0c (S template `vlabconfig.go:39`). MACs are
  unique across the 12 switches. **Do not run `hhfab vlab gen` on top of this** — it would regenerate switches
  starting at `ff:01:00` and collide (S `vlabbuilder.go:1429`).
- Management tap count here: 12 switches + control + gateway (+ servers if they take a tap — **U**) ≪ 100.
- Real hardware would need an OOB switch/VLAN reaching all 12 switches; out of scope for VLAB (**U**).

## Switch boot / persistence

Switches boot ONIE and then install the NOS (S `vlabconfig.go:345` default mode `VMSwitchModeONIE`; ONIE
artifacts `vlabrunner.go:383-397`). Each VM's disk is a qcow2 `os.img` created at its full size
(S `vlabrunner.go:346`) and used as the boot drive (S `vlabrunner.go:463`). Consequences for #501 (P):

- The writable disk is mandatory: the NOS is installed *onto* `os.img`. A throwaway/overlay or `tmpfs` workdir
  loses the install and forces a full ONIE re-install every restart.
- 12 switches × 50 GB max = 600 GB maximum virtual size (sparse; actual use far lower). Use standard
  persistent disk, not SSD (`SSD_TOTAL_GB` limit 500, per #501).

## Resource totals (S sizes, P sums)

VM sizes are `DefaultSizes` (S `vlabconfig.go:401-406`); a saved config can only raise them (`:393-397`).
"26.05 has the same defaults" is **U**.

| Group | Count | vCPU each | RAM MiB each | Disk GB each | vCPU | RAM MiB | Disk GB |
|---|---|---|---|---|---|---|---|
| Switch (VS) | 12 | 4 | 5120 | 50 | 48 | 61,440 | 600 |
| GPU server | 8 | 2 | 768 | 14 | 16 | 6,144 | 112 |
| Shared-service server | 2 | 2 | 768 | 14 | 4 | 1,536 | 28 |
| Control | 1 | 6 | 6144 | 100 | 6 | 6,144 | 100 |
| Gateway | 1 | 8 | 8192 | 50 | 8 | 8,192 | 50 |
| **Total** | **24 VMs** | | | | **82** | **83,456 (≈81.5 GiB)** | **890 (max, sparse)** |

Switch count: **12** (3 + 6 + 3). The 768 MiB server default is the floor, not a realistic GPU-host size; raise
it if probes run on the servers (**U**). Reconcile against the sizing ticket with these numbers.

### Sizing for #501 (N1 on the general CPUS pool, limit 200 per #501)

The full set needs 82 guest vCPU and ≈82 GiB, plus KVM/host overhead. Whether a single N1 host runs 24 nested
VMs to convergence in time is **U**. To stay modest, delete objects rather than add files (keep every
Connection's switch and server present):

| Variant | Change | vCPU | RAM MiB |
|---|---|---|---|
| Full (as committed) | — | 82 | 83,456 |
| No gateway | drop `50-gateway.yaml` | 74 | 75,264 |
| No gateway, 2 GPU servers + 2 svc | drop `gpu-03..08` servers + their Connections | 62 | 70,656 |

Anything smaller than 12 switches requires dropping a whole Fabric's switches *and* every Connection into it.
Larger: full-rail backend (above), more GPU servers (each +2 vCPU, +0.75 GiB, +12 links; a backend leaf has 18
ports used, E1/1–48 available), or a second gateway on another Fabric/domain.

## Validation

**Executable validation was not performed.** This agent cannot run `hhfab`, `go`, `python`, or any interpreter.
`hhfab validate` / `apiutil.Loader` remain for #501. Static checks I did perform:

| Check | Result |
|---|---|
| Object inventory | 3 Fabric, 3 VLANNamespace, 3 IPv4Namespace, 12 Switch, 10 Server, 111 Connection, 1 Gateway, 1 GatewayGroup (grep count) |
| Connection count | 8 fabric + 1 gateway + 102 server (96 GPU + 6 svc) = 111 ✔ |
| No port used twice | 240 distinct ports, `uniq -d` empty. 240 = 2×(4+8+4 fabric links) + 4 gateway + 2×102 server ✔ |
| Connection fabric == switch fabric (`connection_types.go:896`) | 20 frontend / 64 backend / 18 storage server connections each land on a same-Fabric switch; 0 mismatches ✔ |
| Each GPU server NIC budget < 64 | 13 ✔ |
| ASN rules (`fabric_types.go:184-244`) | hand-checked: ranges disjoint; spine/gw ASNs outside all ranges and unique; arithmetic of asdot offsets rechecked ✔ |
| Spine in exactly one domain (`switch_types.go:559`) | all 3 spines list 1 domain ✔ |
| Switch MACs unique | `ff:01`..`ff:0c` ✔ |
| Field names vs Go json tags | read by eye against `SwitchSpec`, `ConnectionSpec`, `FabricSpec`, `GatewaySpec`; **not decoded** |
| Switch profile name | `profile: vs` = `meta.SwitchProfileVS` (S `fabric` repo `api/meta/types.go:62`, main branch, not vendored copy) |

Known checks I could **not** do: YAML syntax parse; strict-decode of unknown fields; `Connection` name length
limits; whether `Default()` rewrites names; the actual hydration allocator; webhook-only validations.

## Assumptions tagged U — #501 must confirm

1. **U1 — Server with Connections in multiple Fabrics.** `Server` has no fabric field, and
   `Connection.Validate` only checks the server *exists* (`connection_types.go:956-962`) — absence of a
   prohibition, not support. Needs: loader accepts; hydrate/build accepts; VLAB maps all 12 NICs;
   no code path assumes a server belongs to one Fabric (e.g. `listOthers` by server label, `:997-1000`, which
   lists *other* connections of a server and may apply cross-checks across Fabrics).
2. **U2 — Per-Fabric VPCAttachment coherence.** VPC, VPCAttachment and Connection each carry one Fabric, and an
   attachment requires `vpc.fabric == attachment.fabric == connection.fabric` (S `vpcattachment_types.go:240-245`).
   So one server needs one VPC and one attachment *per Fabric*; nothing relates them. Whether the same server
   gets coherent addressing/VLAN/routing from three Fabrics at once is unproven. Also: VLAN namespaces are global
   (see above), so per-Fabric VLAN separation depends on the naming/range convention here.
3. **U3 — Backend domains.** A server connecting to leaves in two different domains of one Fabric
   (plane-a + plane-b); VPC `topology.domains` vs switch domains (`vpcattachment_types.go:288-292` not fully read);
   whether a backend VPC should list one or both domains.
4. **U4 — Default Fabric.** Whether hhfab/controller requires or seeds `Fabric/default` when none of the
   included objects use it (`DefaultFabricSpec` comment, `fabric_types.go:~140`), and whether it needs
   `default` VLAN/IPv4 namespaces. If seeded, its ASNs (`64087.*`) don't overlap this plan.
5. **U5 — Import path.** That `hhfab init -w`/dropping files into `include/` replaces rather than supplements the
   generator output, without running `vlab gen`; and that the control/gateway nodes in `fab.yaml` exist and are
   named as assumed (`control-1`, **`gateway-1`** — the Gateway name must equal the node name).
6. **U6 — Gateway.** `driver: kernel`, `workers: 4`, interface PCI/kernel names `0000:05:00.0/enp5s0`,
   `0000:06:00.0/enp6s0` are copied from the generator helpers (S `vlab.go:44-58`, `RootPortPCI/Kernel`); a
   Gateway in `frontend` only; behaviour of gateway peering between Fabrics.
7. **U7 — Cross-Fabric reachability.** Fabrics "are not cabled to each other and reach each other by peering as
   externals" (`fabric_types.go` type comment). This wiring defines **no** cross-fabric path; the GPU server is
   the only junction. Whether that's sufficient for the test scenario is a design question for #501.
8. **U8 — Connection naming.** Names like `gpu-01--enp2s10--be-b-leaf-02` (≤29 chars) are accepted.
9. **U9 — NIC model / stability.** 13 NICs per GPU VM keep stable `enp2sN` names; switch to `virtio-net-pci`
   (S `vlabconfig.go:1350-1376`, `flatcar.VLABVirtioNamesLink`) if names or throughput misbehave.
10. **U10 — Resource fit and 26.05.** Defaults hold in 26.05; 24 VMs / 82 vCPU converge on one N1 host; the
    branch at `fb0ceb4d` corresponds to the 26.05 release.
11. **U11 — Hardware profile.** B200-class NIC counts (2 frontend / 8 rail / 2 storage) match the customer's real BOM.
12. **U12 — OOB on real hardware.** Management isolation per Fabric, if wanted, is not modeled.
