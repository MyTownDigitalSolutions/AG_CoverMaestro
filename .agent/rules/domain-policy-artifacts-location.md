Execution Mode: MODE A — Governance Refinement Only

We are producing a finalized repo-local policy document.
No execution. No repo edits.

Below is the complete consolidated and tightened version of:

domain-policy-artifacts-location.md

This version:

Locks root directory structure

Separates artifacts/ from .agent/

Enforces portability

Prevents tool-path contamination

Treats correction as a governance event

Aligns with the STOP discipline in the Global Constitution 

GEMINI

DOMAIN POLICY — ARTIFACTS LOCATION
1. Purpose

This policy defines the mandatory repository structure and storage rules for all Phase and Chunk artifacts.

Artifact placement is a governance concern and is not optional.

All governed outputs must be deterministic, portable, and repository-contained.

2. Repository Root Requirements (MANDATORY)

The repository root MUST contain:

/artifacts/
/.agent/


These directories:

MUST exist at repository root

MUST NOT be renamed

MUST NOT be nested

MUST NOT be relocated

If missing, the agent MUST STOP and request correction.

3. Canonical Artifact Structure

The artifacts/ directory is the sole repository location for all governed outputs.

Mandatory structure:

/artifacts/
/artifacts/phases/
/artifacts/chunks/

3.1 Phase Artifacts

All Phase-level artifacts MUST be stored in:

/artifacts/phases/


Examples:

phase-00R-governance-adoption.artifact.md

phase-05-platform-tech-stack-selection.artifact.md

phase-06-completion.artifact.md

No Phase artifact may exist outside this directory.

3.2 Chunk Artifacts

All Chunk task artifacts MUST be stored in:

/artifacts/chunks/


Chunk artifacts MUST conform exactly to the canonical Phase/Chunk template defined in Global Workflows.

4. Governance Boundary

The following boundaries are absolute:

artifacts/ contains version-controlled governed outputs.

.agent/ contains repository-local governance (rules, workflows, skills, runbooks).

Global governance resides in the Anti-Gravity system folder and is NOT stored in this repository.

These domains MUST NOT be conflated.

No artifact may be stored in .agent/.

5. Prohibited Locations (Absolute)

Artifacts MUST NOT contain references to tool-internal, system-level, or ephemeral paths, including but not limited to:

~/.gemini/

~/.cache/

Anti-Gravity internal directories

Local UI session paths

Editor temporary folders

Absolute file:// paths outside the repository

User home directories

OS-specific absolute paths (e.g., C:\Users\, /Users/, /tmp/)

Artifacts must be repository-portable and environment-agnostic.

If a reference would not resolve from a fresh repository clone, it is prohibited.

6. Link Requirements

Artifacts MUST:

Use repo-relative paths only

Avoid absolute filesystem references

Avoid system-dependent path separators

Links must remain valid when the repository is cloned to a different machine.

7. Misplaced Artifact Correction Protocol (MANDATORY)

If an artifact is:

Created outside /artifacts/

Stored outside its canonical subdirectory

Linked using a prohibited path

Stored in .agent/

Stored in any inferred or invented directory

The agent MUST:

Halt all phase advancement.

Move the artifact to the correct canonical directory.

Update all references to repo-relative paths.

Confirm correction.

Emit STOP.

Request the next valid gate explicitly.

The agent MUST NOT:

Continue execution.

Advance any gate.

Combine correction with unrelated changes.

Assume correction is trivial.

Correction is a governance event, not a convenience action.

8. Directory Ambiguity Handling

If ambiguity exists regarding:

Correct artifact location

Directory structure

Naming conventions

Phase vs Chunk classification

The agent MUST:

STOP

Request clarification

Await explicit instruction

Silent directory invention is a governance violation.

9. Enforcement

Violation of this policy constitutes a governance breach.

The agent must immediately:

STOP

Identify the violation

Request corrective authority

No artifact creation, modification, or advancement may proceed until resolved.

## ENFORCEMENT

If any workflow, phase, template, or agent behavior conflicts with this policy:
THIS POLICY WINS.


