/**
 * Right now, just a wrapper around the underlying raw processed crash data.
 *
 * The interesting top-level values are:
 * - json_dump: the heart of the useful data, expanded upon below.
 * - uuid: the crash ID
 * - crash_id: also the crash ID
 * - proto_signature: The crashing thread's call stack's `normalized` values all
 *   concatenated together.  Useful to search on if the automatic signature is
 *   dumb.
 * - signature: The digested signature after getting rid of blacklisted frames,
 *   plus prepending magic like "shutdownhang" to the front when the crash was
 *   self-triggered via explicit mechanisms.
 * About the build:
 * - product
 * - productid: because we have GUID's for the app from XUL-fun or what not.
 * - build: should be the build date.
 * - process_type: **foo**
 * - release_channel: also "ReleaseChannel"
 * About the OS:
 * - os_name
 * - os_version:
 * About the crash:
 * - reason: low level reason like "EXCEPTION_BREAKPOINT" or segfault etc.
 * - crash_time: crash time in Number epoch-seconds it looks like
 * - started_datetime: date-string of FF start time.
 * About the hardware:
 * - cpu_name: CPU brand?
 * - cpu_info: detailed CPU info that you need to loom at `cpu_name` to make
 *   sure you know Intel versus AMD, etc.
 *

 * In the `json_dump`:
 * - crashing_thread:
 *   - frames:
 *   - thread_name
 *   - total_frames
 *   - threads_index
 * - threads: An array of objects with keys:
 *   - thread_name: string
 *   - frame_count: redundant
 *   - frames: An array of objects with keys:
 *     - function: demangled pretty symbol name which inclues arguments and
 *       template gunk, where the template gunk may also be very misleading
 *       because many invocations result in the same series of bytes, and
 *       de-duplication means the full function is probably a lie.  You very
 *       likely want `normalized` instead.
 *     - function_offset: hex string of offset in function
 *     - module_offset: hex string of offset relative to containing module.
 *     - frame: 0-based Number
 *     - module: string name of module that should exist in toplevel `modules`
 *     - normalized: The symbol with template gunk reduced to <T> and the
 *       arguments chopped off.
 *     - file: colon-delimited string whose pieces are:
 *       - "hg" I guess this could be git
 *       - "hg.mozilla.org/releases/mozilla-release" the repo but without
 *         protocol gunk
 *       - "mozglue/misc/ConditionVariable_windows.cpp" the relative path in the
 *         repo.
 *       - "975058795980dfbba1daedfe5fc82d1abcb5638b" the revision control hash
 *     - offset: hex string of absolute memory address
 *     - line: probably 1-based Number of the line
 *     - trust: The mechanism by which the frame was found.  See the breakpad
 *       mozilla code, but basically the values are, and I'm going from memory
 *       here.  In general "scan" means the stack looked obviously wrong so all
 *       beta may be off.
 *       - "context": this is what the registers for the thread say.
 *       - "cfi": unwound the previous frame and the PC looked legit.
 *       - "cfi_scan": cfi didn't quite work out so we scanned until we found
 *         something that looked like a reasonable PC.
 *       - "frame_pointer": eh
 * - modules: Array of objects where the key dict keys are:
 *   - filename: The module name; should correspond to a frames' module
 *   - version: version string
 *   - cert_subject: if it was signed
 *   - base_addr: hex string of start of memory range
 *   - end_addr: hex string of end of memory range
 *   - symbol_url: full HTTPS URL you can pull the symbol file from
 *   - debug_file: the name of the PDB file that existed on disk next to the
 *     module and the symbols were probably slurped out from.
 *   - code_id: dunno
 *
 * There's also the "meta" we get from the RawCrash endpoint that includes some
 * of the info not included above, and that notably has:
 * - MozCrashReason: If we did a custom MOZ_CRASH payload that got data-review
 *   sign-off, it's in here.
 * - DOMIPCEnabled: "1" if we're e10s I guess?
 * - ShutdownProgress: Sorta like MozCrashReason, I think this is an annotation.
 * - StartupCrash: same deal, I think a flag
 * This may include private data if authenticated with the right cookies, etc:
 * - Email: Reporter's email
 * - URL: The page the user was viewing
 *
 * There's also a bunch of memory info here that would be useful.
 */
export default class FancyCrash {
  constructor({ raw, rawMeta }) {
    this.raw = raw;
    this.rawMeta = rawMeta;
  }
}
