-- update_gu_items_updated_at() quedó huérfana: ningún trigger la usa desde que la
-- reconstrucción del circuito (migraciones 01..05) recreó gu_items con fn_set_updated_at, que hace
-- exactamente lo mismo. Era el último WARN del advisor (search_path mutable).
-- RESTRICT (default): si algo dependiera de ella, esto falla en vez de romper en silencio.
--
-- IF EXISTS porque la función solo existe en la base de producción, que viene de antes del
-- repo: sobre una base nueva nunca se creó, y sin esto la cadena de migraciones cortaba acá.
-- No afloja el RESTRICT, que es sobre dependencias, no sobre existencia.
DROP FUNCTION IF EXISTS public.update_gu_items_updated_at();