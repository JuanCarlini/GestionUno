## Qué cambia

<!-- Una o dos líneas: qué hace distinto el sistema después de este PR. -->

## Por qué

<!-- El problema o el requisito. Si hay issue o historia, linkearla. -->

## Cómo probarlo

<!-- Pasos para verificarlo a mano, o el test que lo cubre. -->

## Definition of Done

- [ ] Tests nuevos para las reglas que cambian
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build` en verde
- [ ] Migración versionada en `supabase/migrations/` si cambia la base (probada en un branch de Supabase, no en producción)
- [ ] `src/lib/supabase/database.types.ts` regenerado si cambió el esquema
- [ ] Requisito o historia actualizada en `docs/requisitos/`
- [ ] Probado en desktop y mobile si toca la UI
- [ ] Revisado en modo claro y oscuro si toca la UI

## Pendiente o fuera de alcance

<!-- Lo que se encontró en el camino y no entra acá. -->
