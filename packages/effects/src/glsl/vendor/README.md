# Vendored shaders

GLSL fragments in this directory are derived from
[paper-design/shaders](https://github.com/paper-design/shaders) (Apache-2.0 —
see the package `NOTICE`). Adaptation rules: inline the upstream helper chunks
(`shader-utils.ts`), delete the sizing/fit vertex system and read plain `v_uv`
stretched to the node, keep upstream param uniforms and `u_time` (our runtime
supplies composition-clock time), and rewrite to the GLSL ES 1.00-compatible
subset (`transpileTo100`): no array constructors, no `switch`, no `fwidth`, no
integer `%`, constant loop bounds with inner `if` guards instead of dynamic
`break`, and procedural hash noise instead of the upstream noise texture
(`renderSource` binds no textures). Every vendored fragment must keep a
`// Derived from paper-design/shaders <file> (Apache-2.0)` header comment.
