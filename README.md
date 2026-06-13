# Pi Setup

Personal Pi setup bundle for the OrderProtection-style workflow.

Installs:

- `neon-friendly` theme
- `neon-footer` extension
- custom spinner verbs
- runtime patches for the installed Pi package:
  - recover interactive UI after errors instead of exiting
  - force full redraw after extension overlays close
  - dynamic `/cd` / `cd` command support
  - footer repo/directory detection improvements
  - random spinner verbs from `~/.pi/agent/spinner-verbs.json`

## Install

```bash
git clone <this-repo-url> pi-setup
cd pi-setup
./install.sh
```

Then restart Pi once.

## Reload-only changes

Theme, footer extension, and spinner verb config can be adjusted and reloaded with:

```text
/reload
```

Runtime patches require restarting Pi because Node caches the loaded modules.
