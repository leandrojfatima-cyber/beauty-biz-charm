-- Migration: Etapa 8 — Aplicativo de Agendamento do Cliente
-- Permite auto-atendimento de clientes com segurança, isolamento e integração total à agenda administrativa.

-- 1. Políticas de leitura pública para o catálogo da barbearia
DROP POLICY IF EXISTS "public_read_salon_settings" ON public.salon_settings;
CREATE POLICY "public_read_salon_settings" ON public.salon_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_read_salon_photos" ON public.salon_photos;
CREATE POLICY "public_read_salon_photos" ON public.salon_photos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_read_active_professionals" ON public.professionals;
CREATE POLICY "public_read_active_professionals" ON public.professionals
  FOR SELECT TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "public_read_active_services" ON public.services;
CREATE POLICY "public_read_active_services" ON public.services
  FOR SELECT TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "public_read_active_products" ON public.products;
CREATE POLICY "public_read_active_products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (active = true AND for_sale = true);

-- Permite consultar slots ocupados sem expor nomes ou telefones de outros clientes
DROP POLICY IF EXISTS "public_read_occupied_slots" ON public.appointments;
CREATE POLICY "public_read_occupied_slots" ON public.appointments
  FOR SELECT TO anon, authenticated
  USING (status <> 'cancelado');

-- 2. Função Segura: Agendar Horário pelo Aplicativo do Cliente
CREATE OR REPLACE FUNCTION public.book_client_appointment(
  p_salon_id uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_client_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_client_id uuid;
  v_is_vip boolean := false;
  v_vip_plan text := null;
  v_duration_min integer := 45;
  v_ends_at timestamptz;
  v_conflict_count integer;
  v_appointment_id uuid;
  v_clean_phone text;
BEGIN
  -- Limpar telefone
  v_clean_phone := regexp_replace(p_client_phone, '\D', '', 'g');

  -- Obter o owner_id da barbearia
  IF p_salon_id IS NOT NULL THEN
    SELECT owner_id INTO v_owner_id FROM public.salon_settings WHERE id = p_salon_id LIMIT 1;
  ELSE
    SELECT owner_id, id INTO v_owner_id, p_salon_id FROM public.salon_settings LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Barbearia não configurada no sistema.';
  END IF;

  -- Obter duração do serviço
  SELECT coalesce(duration_min, 45) INTO v_duration_min
  FROM public.services
  WHERE id = p_service_id;

  v_ends_at := p_starts_at + (v_duration_min || ' minutes')::interval;

  -- Localizar ou criar cliente pelo telefone
  SELECT id, is_vip, vip_plan_name INTO v_client_id, v_is_vip, v_vip_plan
  FROM public.clients
  WHERE owner_id = v_owner_id AND (phone = v_clean_phone OR phone = p_client_phone)
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (owner_id, salon_id, name, phone, notes)
    VALUES (v_owner_id, p_salon_id, p_client_name, v_clean_phone, 'Cadastrado via App de Agendamento')
    RETURNING id, is_vip, vip_plan_name INTO v_client_id, v_is_vip, v_vip_plan;
  ELSE
    -- Atualizar nome se fornecido
    UPDATE public.clients SET name = p_client_name WHERE id = v_client_id AND (name IS NULL OR name = '');
  END IF;

  -- Checar conflito estrito para o mesmo profissional (a menos que seja VIP)
  IF NOT v_is_vip THEN
    SELECT count(*) INTO v_conflict_count
    FROM public.appointments
    WHERE professional_id = p_professional_id
      AND status <> 'cancelado'
      AND starts_at < v_ends_at
      AND ends_at > p_starts_at;

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Este horário acabou de ser reservado por outro cliente. Por favor, selecione outro horário.';
    END IF;
  END IF;

  -- Inserir agendamento
  INSERT INTO public.appointments (
    owner_id,
    salon_id,
    client_id,
    professional_id,
    service_id,
    starts_at,
    ends_at,
    status,
    notes,
    is_vip,
    vip_simultaneous_override
  )
  VALUES (
    v_owner_id,
    p_salon_id,
    v_client_id,
    p_professional_id,
    p_service_id,
    p_starts_at,
    v_ends_at,
    'agendado',
    p_client_notes,
    v_is_vip,
    v_is_vip
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'is_vip', v_is_vip,
    'vip_plan_name', v_vip_plan,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_client_appointment TO anon, authenticated, service_role;

-- 3. Função Segura: Consultar Agendamentos e Assinatura do Cliente pelo Telefone
CREATE OR REPLACE FUNCTION public.get_client_portal_data(
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
  v_client record;
  v_appointments jsonb;
BEGIN
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');

  SELECT * INTO v_client
  FROM public.clients
  WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('found', false, 'message', 'Nenhum cadastro encontrado com este telefone.');
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'notes', a.notes,
      'is_vip', a.is_vip,
      'service_name', s.name,
      'service_price', s.price,
      'service_duration', s.duration_min,
      'professional_name', p.name,
      'professional_photo', p.photo_url
    ) ORDER BY a.starts_at DESC
  ), '[]'::jsonb) INTO v_appointments
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.professionals p ON p.id = a.professional_id
  WHERE a.client_id = v_client.id;

  RETURN jsonb_build_object(
    'found', true,
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'phone', v_client.phone,
      'is_vip', v_client.is_vip,
      'vip_plan_name', v_client.vip_plan_name,
      'created_at', v_client.created_at
    ),
    'appointments', v_appointments
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_data TO anon, authenticated, service_role;

-- 4. Função Segura: Cancelar Agendamento pelo Cliente
CREATE OR REPLACE FUNCTION public.cancel_client_appointment(
  p_appointment_id uuid,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
  v_appt record;
BEGIN
  v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');

  SELECT a.*, c.phone as client_phone INTO v_appt
  FROM public.appointments a
  JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id;

  IF v_appt IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Agendamento não encontrado.');
  END IF;

  IF regexp_replace(v_appt.client_phone, '\D', '', 'g') <> v_clean_phone THEN
    RETURN jsonb_build_object('success', false, 'message', 'Telefone não corresponde ao titular do agendamento.');
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado'
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado com sucesso.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_client_appointment TO anon, authenticated, service_role;
