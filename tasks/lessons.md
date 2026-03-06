# Lessons

- When designing a core domain document from spec, do not bake in one object type (`place`) unless the spec scope is explicitly object-type-specific. Keep the core model generic and derive object-type-specific views separately.
- Do not embed governance references or final governance-derived decisions inside the core object document when governance is resolved in a separate step before the main query.
- Avoid schema shapes that imply index multiplication for large update sets. Prefer generic update stores plus pointer/state maps in the core document, and use a separate small query projection document for indexed query surfaces.
- Do not duplicate derived field state inside the core document unless the document is explicitly a projection/cache. For the core truth model, store object metadata plus active updates only and derive current field state later.
