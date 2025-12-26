# ADR-002: File System Path Sanitization

## Status
Accepted

## Context
When implementing client-side file exports using the File System Access API, the application creates directory structures based on user-defined data (Manufacturer names, Series names). 
The Windows operating system has strict limitations on directory names:
- Illegal characters: `<` `>` `:` `"` `/` `\` `|` `?` `*`
- Reserved device names: `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`
- Trailing dots or spaces are generally stripped or cause issues.

Failing to handle these ensures export failures or potentially unsafe directory traversal attempts (though widespread browser sandboxing mitigates the latter, explicit handling is standard practice).

## Decision
We implemented a strict `sanitizePathSegment` helper in `client/src/services/fileSystem.ts` that:
1. Trims whitespace.
2. Replaces all illegal characters (including path separators) with underscores `_`.
3. Removes trailing dots to prevent Windows file system errors.
4. Defaults empty segments to `_`.
5. Prefixes reserved device names with an underscore (e.g., `CON` -> `_CON`) to ensure validity.

This function is applied to every segment in `ensureSubdirectory` before asking the File System API to create/get the directory.

## Testing Strategy
Currently, the client application lacks a dedicated unit testing harness (like Vitest or Jest). 
Therefore, we cannot add an automated unit test file (`fileSystem.test.ts`) at this time without introducing new infrastructure, which is out of scope.

### Manual Verification Procedure
To verify this behavior manually:
1.  **Illegal Characters**: Rename a Manufacturer to include illegal chars (e.g., `ACME:Explosives?`). Export and verify the folder created is `ACME_Explosives_`.
2.  **Path Traversal**: Rename a Series to `../Parent`. Verify the folder created is `__Parent` or similar (dots are not illegal but `..` traversal logic should be neutralized by treating it as a literal name, or if we strip dots... logic actually replaces partial illegal chars. `..` is not strictly illegal char-wise, but `.` is valid. However, `sanitizePathSegment` does NOT currently explicitly strip `..` unless they are trailing. *Correction*: The implementation removes trailing dots. `..` becomes empty string -> `_`. `Folder..` becomes `Folder`.)
3.  **Reserved Names**: Create a Series named `PRN`. Verify the folder created is `_PRN`.

## Future Work
- Introduce `vitest` to the client project.
- Port the logic verification to a proper `fileSystem.test.ts` unit test.
