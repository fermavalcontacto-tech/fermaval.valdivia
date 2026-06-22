
CREATE POLICY "Staff read boletas" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'boletas' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload boletas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'boletas' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete boletas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'boletas' AND public.is_staff(auth.uid()));

CREATE POLICY "Public read web-assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'web-assets');
CREATE POLICY "Admin write web-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'web-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update web-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'web-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete web-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'web-assets' AND public.has_role(auth.uid(), 'admin'));
