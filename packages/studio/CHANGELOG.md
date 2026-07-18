# @smoove/studio

## 0.2.0

### Patch Changes

- Updated dependencies [[`194d6b2`](https://github.com/smoove-dev/smoove/commit/194d6b28bd7c6f804343038c4f91626766f8a912), [`1d08c62`](https://github.com/smoove-dev/smoove/commit/1d08c623b1efa3864257ccdbfcff8d9210246821), [`bce47d8`](https://github.com/smoove-dev/smoove/commit/bce47d880632b3c3149368f8416772c7b35c15c5), [`3139b13`](https://github.com/smoove-dev/smoove/commit/3139b13a10f650e625096e17b7dab07f28763010)]:
  - @smoove/core@0.2.0
  - @smoove/player@0.2.0
  - @smoove/renderer@0.2.0

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
