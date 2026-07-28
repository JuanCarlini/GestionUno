-- update_gu_items_updated_at() quedó huérfana: ningún trigger la usa desde que la
-- reconstrucción del circuito (migraciones 01..05) recreó gu_items con fn_set_updated_at, que hace
-- exactamente lo mismo. Era el último WARN del advisor (search_path mutable).
-- RESTRICT (default): si algo dependiera de ella, esto falla en vez de romper en silencio.
DROP FUNCTION public.update_gu_items_updated_at();