// Data-laag voor de junction-tabel public.case_team_members.
// Koppelt team-leden aan cases (Fase D-mapping). Gebruikt door de Case-editor
// om per case te tonen welke consultants eraan werkten + door Nova-tools om
// de bidirectionele match te doen (welke cases match een profiel / wie zat op
// welke case).

import { supabase } from './supabase';

// Lees alle koppelingen voor één case, gejoind met basis-info van de
// team-leden voor display-doeleinden.
export async function listCaseTeamMembers(caseId) {
  if (!caseId) return [];
  const { data, error } = await supabase
    .from('case_team_members')
    .select('case_id, team_member_id, role_on_case, period_text, team_members(id, name, role, seniority)')
    .eq('case_id', caseId);
  if (error) {
    console.warn('listCaseTeamMembers fout:', error.message);
    return [];
  }
  return (data || []).map(row => ({
    teamMemberId: row.team_member_id,
    roleOnCase: row.role_on_case || '',
    periodText: row.period_text || '',
    member: row.team_members || null,
  }));
}

// Vervang de volledige set koppelingen voor een case in één keer.
// Strategie: delete-all + insert. Bij <20 koppelingen per case is dit
// ruim snel genoeg en voorkomt diff-logica met edge cases (rename van rol,
// etc.). De PK is (case_id, team_member_id) dus dubbele inserts worden
// alsnog door de DB tegengehouden.
export async function setCaseTeamMembers(caseId, links = []) {
  if (!caseId) return { ok: false, error: 'caseId ontbreekt' };

  const { error: delErr } = await supabase
    .from('case_team_members')
    .delete()
    .eq('case_id', caseId);
  if (delErr) {
    console.warn('setCaseTeamMembers delete fout:', delErr.message);
    return { ok: false, error: delErr.message };
  }

  const rows = (links || [])
    .filter(l => l && l.teamMemberId)
    .map(l => ({
      case_id: caseId,
      team_member_id: l.teamMemberId,
      role_on_case: (l.roleOnCase || '').trim() || null,
      period_text: (l.periodText || '').trim() || null,
    }));

  if (!rows.length) return { ok: true };

  const { error: insErr } = await supabase
    .from('case_team_members')
    .insert(rows);
  if (insErr) {
    console.warn('setCaseTeamMembers insert fout:', insErr.message);
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}
