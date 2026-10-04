// Supabase Edge Function: manage-staff
//
// Staff credentials must be created through the Auth admin API, which needs
// the service-role key. That key can never ship to the browser, so this
// function is the only path for a manager to create, reset, or remove a
// staff login.
//
// Every request is authorised by verifying the caller's JWT resolves to an
// active manager profile before any privileged action is taken.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ACTIONS = ['create', 'reset-password', 'delete'];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0] || 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is missing required configuration' }, 500);
  }

  // Caller identity: the anon client forwards the user's access token.
  const authHeader = req.headers.get('Authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return json({ error: 'Missing authorization token' }, 401);
  }

  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser(accessToken);
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const { data: callerProfile, error: profileErr } = await callerClient
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .single();

  if (profileErr || !callerProfile) {
    return json({ error: 'Caller profile not found' }, 403);
  }
  if (callerProfile.role !== 'manager' || callerProfile.is_active !== true) {
    return json({ error: 'Only an active Operations Manager may perform this action' }, 403);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = payload?.action;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return json({ error: 'Unsupported action' }, 400);
  }

  // Privileged client: bypasses RLS, used only after the manager check above.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = String(payload?.email || '').trim().toLowerCase();
  const fullName = String(payload?.full_name || '').trim();
  const phone = payload?.phone ? String(payload.phone).trim() : null;
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const targetId = payload?.staff_id ? String(payload.staff_id) : null;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordOk = password.length >= 8;

  try {
    if (action === 'create') {
      if (!emailOk) return json({ error: 'A valid email address is required' }, 400);
      if (!fullName) return json({ error: 'Full name is required' }, 400);
      if (!passwordOk) return json({ error: 'Password must be at least 8 characters' }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      // The DB trigger creates the profile as 'staff'. Enforce it here too so
      // the role can never be influenced by the request payload.
      const { error: profileErr2 } = await admin
        .from('profiles')
        .update({ role: 'staff', full_name: fullName, phone })
        .eq('id', created.user.id);
      if (profileErr2) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: 'Could not create staff profile' }, 500);
      }

      return json({ success: true, staff_id: created.user.id, email });
    }

    if (action === 'reset-password') {
      if (!targetId) return json({ error: 'staff_id is required' }, 400);
      if (!passwordOk) return json({ error: 'Password must be at least 8 characters' }, 400);

      const { data: target, error: targetErr } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', targetId)
        .single();
      if (targetErr || !target) return json({ error: 'Staff profile not found' }, 404);
      if (target.role === 'manager') {
        return json({ error: 'Cannot reset an Operations Manager account here' }, 403);
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(targetId, {
        password,
      });
      if (updateErr) return json({ error: updateErr.message }, 400);

      return json({ success: true });
    }

    // action === 'delete'
    if (!targetId) return json({ error: 'staff_id is required' }, 400);
    if (targetId === userData.user.id) {
      return json({ error: 'You cannot delete your own account' }, 400);
    }

    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', targetId)
      .single();
    if (targetErr || !target) return json({ error: 'Staff profile not found' }, 404);
    if (target.role === 'manager') {
      return json({ error: 'Operations Manager accounts cannot be deleted here' }, 403);
    }

    // profiles.id cascades from auth.users, so removing the auth user also
    // removes the profile row and revokes every outstanding JWT.
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ success: true });
  } catch (err) {
    return json({ error: err?.message || 'Unexpected server error' }, 500);
  }
});
