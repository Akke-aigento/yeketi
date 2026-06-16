GRANT INSERT ON TABLE public.quote_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_requests TO authenticated;
GRANT ALL ON TABLE public.quote_requests TO service_role;