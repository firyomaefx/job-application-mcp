# Job Application MCP — Chrome extension

A Manifest V3 extension that captures form fields on a career page and asks
your **local** Job Application MCP HTTP bridge to **preview** an autofill
mapping. It never submits anything.

## What it does

1. You open a job application form on any company career page.
2. Click the extension → **Capture form fields on this page**. The extension
   reads field `name` / `label` / `type` from the page (no values are sent for
   password/hidden/file fields — those are skipped entirely).
3. Enter the **Application ID** you got from `match_cv` / `save_application` in
   the MCP server.
4. Click **Preview autofill via MCP**. The extension POSTs the field list to
   your local bridge (`autofill_form` tool) and shows the preview mapping.
5. You review the preview (sensitive fields like salary / work-authorization
   are flagged `requires_user_review`) and fill the real form yourself.

## What it does NOT do

- ❌ Never submits a form.
- ❌ Never autofills a real field in the page. (A future Pro version might, with
  explicit per-field confirmation.)
- ❌ Does not touch LinkedIn or Indeed — those are analysis-only per their ToS.
- ❌ Sends data only to `127.0.0.1` (your own machine).

## Install (developer mode)

1. Build the icons: `node extension/build-icons.js` (generates `icons/*.png`).
2. Open Chrome → `chrome://extensions` → enable **Developer mode** (top right).
3. Click **Load unpacked** → select this `extension/` folder.
4. Pin the extension for easy access.

## Configure

Click the extension → **Bridge settings** (or right-click → Options):

- **Bridge URL** — default `http://127.0.0.1:8787`. Must match
  `JOB_MCP_HTTP_PORT` on the server.
- **Bearer token** — only if you started the bridge with `JOB_MCP_HTTP_TOKEN`
  set.

Start the bridge in the project root:

```bash
npm run serve:http
# or: node dist/cli/cli.js serve:http
```

The popup shows a green dot when the bridge is reachable.

## Files

```text
extension/
├── manifest.json            # MV3 manifest
├── build-icons.js           # generates icons/*.png (run once)
├── icons/                   # generated PNGs (16/48/128)
├── popup/                   # toolbar popup UI
│   ├── popup.html / .css / .js
├── options/                 # bridge URL + token settings
│   ├── options.html / .js
└── background/background.js # service worker
```

## Permissions, explained

| Permission | Why |
| --- | --- |
| `activeTab` + `scripting` | Inject the field-capture function into the tab you clicked on. |
| `storage` | Remember your bridge URL / token. |
| `host_permissions` (`127.0.0.1`, `localhost`) | Talk to your local HTTP bridge. Nothing else. |

The extension has **no remote host permissions**. It cannot phone home.

## Testing the capture logic manually

The capture function is plain DOM code with no Chrome APIs, so you can test it
in any browser devtools console on a page with a form:

```js
// paste the body of captureFieldsInPage() from popup/popup.js
```

## Privacy

Field metadata (name/label/type) is sent only to your local bridge. Field
*values* are captured for display in the popup but are **not** sent to the
bridge — only `name`, `label`, and `type` are transmitted.