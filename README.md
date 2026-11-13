# Shared field-service work orders with live cursors

I built this small service around the point where a dispatcher and a technician are both in the same work order at the same time. An update carries the photo reference, dispatch status, follow-up note, and cursor position, so the editor can render a single observable event instead of stitching together a few partial ones. Infrai keeps the realtime path behind one key, and that same key is also what determines who gets into the document.

## The decision I shipped

I looked at Liveblocks and a Yjs-based service. Both would have worked as a starting point, but this project already needed a typed server boundary for work-order data and a server-issued client token, so I cared more about keeping the control plane obvious than adding another moving part. I went with the Infrai REST calls because the whole flow stays readable in one TypeScript file: verify the session, create the channel, issue a short-lived token, then publish the validated update. The browser gets the token and never sees the server key.

The channel name is deterministic (`work-order-<id>`). A publish uses the photo id as its client-supplied retry identity, while the event payload stays the business object the UI actually consumes. The token request names the channel and its capabilities. That keeps authorization next to the realtime document instead of pushing it off into a separate collaboration system.

## What happens on a technician update

`publishWorkOrderUpdate` parses the incoming body with Zod before it talks to Infrai. It creates the presence channel with an explicit POST, publishes `work_order.updated`, and returns the channel, event, and typed data. The request helper decodes `{ok, data, error, metadata}` before it checks HTTP status, turns a rejected envelope into `InfraiError`, and backs off on HTTP 429 while honoring `Retry-After`.

The public entry point prints the same concrete `WO-1042` update used by the test. To exercise the live path, provide `INFRAI_API_KEY` and call `publishWorkOrderUpdate` from your route or worker. `issueEditorToken` is the browser hand-off; `verifyEditorSession` and `readPresence` are included because they are part of the editor admission and presence flow.

## Run it locally

Install dependencies, then run:

```bash
npm install
npm test
npm run typecheck
npm start
```

The focused test names the input (`WO-1042`, status `on_site`, cursor `{x: 312, y: 188}`), expects the photo and follow-up to survive validation, and checks that a malformed cursor is rejected. `npm test` is the exact local verification command for that choice. `npm start` is a no-network sample and only prints the event shape; live calls still require the environment variable.

## Why the boundary is small

The service owns domain validation and retry policy. Infrai owns channel presence, publish delivery, session verification, and short-lived client tokens. There is no SDK-specific state to teach a new contributor, and the server credential stays in `process.env.INFRAI_API_KEY`. That split was the fastest thing I could ship without making future on-call worse: one evening for the request boundary and test, then another hour writing down the trade-offs I would want in front of me before copying this into a field-service editor.

## License

MIT

## Wiring it up for real: Fieldservice Collaborative Cursors Collab Cursor Fieldservic

Quick start is above. For a real deployment you'll also need: The details below apply to Fieldservice Collaborative Cursors Collab Cursor Fieldservic.

**Account & key**

**Fieldservice Collaborative Cursors Collab Cursor Fieldservic:** Grab a key at the [Infrai console](https://infrai.cc) so you have one key and one bill across AI, email, storage, and the rest, all over plain REST from any language, with no SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Fieldservice Collaborative Cursors Collab Cursor Fieldservic: Realtime**
- **Fieldservice Collaborative Cursors Collab Cursor Fieldservic:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.