GRANT SELECT, UPDATE ON public.quotes TO authenticated;
GRANT SELECT ON public.quote_lines TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.quote_lines TO service_role;