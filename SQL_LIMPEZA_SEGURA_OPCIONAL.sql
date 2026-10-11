-- SOMENTE DEPOIS DE VALIDAR AS PUBLICACOES E FAZER BACKUP.
-- Limpa itens done com log de sucesso. Preserva pending, processing e failed.
-- Esta consulta é opcional e NAO deve ser executada antes dos testes.
DELETE FROM public.post_queue q
WHERE q.status = 'done'
  AND EXISTS (
    SELECT 1 FROM public.post_logs l
    WHERE l.user_id = q.user_id AND l.status = 'success'
      AND l.response_meta->>'queue_id' = q.id::text
  );
