# Token owner's GitHub availability

Approved in chat after interactive previews: show a red no-entry icon and Busy label when the token owner's status indicates limited availability. Otherwise show a compact green dot with no visible label. Keep the existing GitHub service badge and separate the personal status control with a divider beside the avatar. A popover shows the signed-in identity, status message, and a link to the user's GitHub profile to edit their status there.

Use the existing authenticated GraphQL client and `viewer`, never the tracking username override. Refresh on dashboard refresh and return from GitHub. Expired statuses count as cleared. Unknown/error states must not look green. Status loading failures must not prevent reviews or the avatar loading. No token is included in links. Use safe text rendering; retain zero runtime dependencies.

Alternatives considered: large icon tile saves header space but lacks a clear busy label; an availability strip is most visible but consumes vertical space. User chose the status button with asymmetric busy/default presentation.
