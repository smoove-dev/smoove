# @smoove/studio

## 0.1.8

### Patch Changes

- Updated dependencies [[`b4d6fdb`](https://github.com/smoove-dev/smoove/commit/b4d6fdb0f24d5775d9d26cc65d7ccfe5b8e66cbf)]:
  - @smoove/player@0.1.8
  - @smoove/core@0.1.8
  - @smoove/renderer@0.1.8

## 0.1.7

### Patch Changes

- [#5](https://github.com/smoove-dev/smoove/pull/5) [`060725d`](https://github.com/smoove-dev/smoove/commit/060725d6784ee4a702431ec93c06620b2336d9e5) Thanks [@shemi](https://github.com/shemi)! - Restyle the render and export dialogs to match the rest of the studio. The
  export-frame preview now shows the real captured frame, sized to the
  composition's aspect ratio, instead of a placeholder, and a still reports a
  realistic file size. In the render dialog, width and height stay locked to the
  source aspect ratio (edit either, the other follows) and the resolution preset
  dropdown is gone; the range control appears only when a loop region is set.
  Primary buttons use a solid accent color and form inputs are borderless filled
  fields, shared with the props inspector so the two surfaces stay consistent.
- Updated dependencies []:
  - @smoove/core@0.1.7
  - @smoove/player@0.1.7
  - @smoove/renderer@0.1.7
