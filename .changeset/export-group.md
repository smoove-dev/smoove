---
"@smoove/core": minor
---

Add a `Group` container to `@smoove/core` — a thin `Konva.Group` subclass stamped with a marker attr (`isGroupNode`), mirroring how the media nodes flag themselves. Apps get the plain transform/grouping container without reaching into `Konva.*`, and the mark lets tooling tell author-created groups apart from the internal groups smoove builds inside `Text`/`Flex`. For automatic layout, reach for `Flex`/`Block`.
