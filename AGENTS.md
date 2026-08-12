## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Testing

The gate is two commands, not one:

```
pnpm run check && pnpm run test:e2e
```

`check` covers lint, typecheck, format, both Vitest projects and React Doctor. It
does **not** run Playwright, so a broken end-to-end suite passes it.

`test:e2e` runs against the **built Worker**, not `astro dev`: it migrates,
seeds, builds and boots `wrangler dev` before the first test. CI runs one browser
per job (`--project=<browser>` in a matrix); locally all three point at a single
server, which is why `workers` is capped rather than sized from the CPU count.

Two failure modes on Windows look like broken code and are not:

- **A run that passes every test and still exits 1.** WebKit intermittently fails
  to exit and Playwright force-kills it after 300000 ms — the run takes five
  extra minutes and reports `worker-N process did not exit within 300000ms`. It
  is upstream (microsoft/playwright#40637). The test results above it are real.
- **A run where whole spec files fail on `page.goto` timeouts, or that produces
  no output at all.** That is almost always a leftover server: the force-kill
  above orphans `workerd` and `WebKitNetworkProcess`, and stopping a shell does
  not kill its descendants on Windows. The next run then finds a wedged process
  holding port 3000 that accepts connections and never answers.

**Killing by image name is not enough**, and this is the part that wastes an
afternoon. `wrangler` runs a supervising `node` process that **respawns
`workerd` as soon as it dies**, so `taskkill //IM workerd.exe` frees the port for
about two seconds. Worse, the orphans stack: every interrupted run leaves
another supervisor behind, and four of them queued on the same port is what a
"hung" suite usually is.

Kill the **root** of the tree, and repeat until the port is actually free:

```
powershell -NoProfile -Command "$p = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess; while ($p) { $proc = Get-CimInstance Win32_Process -Filter \"ProcessId=$p\"; $root = $proc; while ($true) { $parent = Get-CimInstance Win32_Process -Filter \"ProcessId=$($root.ParentProcessId)\" -ErrorAction SilentlyContinue; if (-not $parent -or $parent.Name -notin @('node.exe','sh.exe','cmd.exe','pnpm.exe')) { break }; $root = $parent }; Stop-Process -Id $root.ProcessId -Force; Start-Sleep -Seconds 3; $p = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess }"
```

Then the orphaned browsers, which hold no port but do consume memory:

```
taskkill //IM WebKitNetworkProcess.exe //F
```

The tell that it is pollution rather than a regression: each `--project` passes
alone while the combined run fails. Running per project is also what CI does, so
it is a faithful gate and not a weaker one — reach for it when the combined run
misbehaves rather than debugging the branch.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
