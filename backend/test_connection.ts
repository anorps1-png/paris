import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { validateH1 } from './src/services/logicH1';
import { validateH2 } from './src/services/logicH2';
import { validateH3 } from './src/services/logicH3';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== DB Verification ===");
  
  // 1. Get matches
  const { data: matches, error } = await supabase
      .from('matches')
      .select(`
          *,
          player1:player1_id(*),
          player2:player2_id(*)
      `);
      
  if (error || !matches) {
      console.error("Error fetching matches:", error);
      return;
  }
  
  console.log(`Found ${matches.length} matches in database.`);
  
  let validH1 = 0, validH2 = 0, validH3 = 0;
  
  for (const m of matches) {
      // Get player history from DB
      const { data: p1History } = await supabase
          .from('player_match_history')
          .select('*')
          .eq('player_id', m.player1_id)
          .order('match_date', { ascending: false })
          .limit(1);

      const { data: p2History } = await supabase
          .from('player_match_history')
          .select('*')
          .eq('player_id', m.player2_id)
          .order('match_date', { ascending: false })
          .limit(1);

      const lastMatch1 = p1History && p1History[0] ? {
          role: p1History[0].role as any,
          result: p1History[0].result as any,
          total_break_target_reached: !!p1History[0].total_break_target_reached,
          total_individual_tocard_reached: !!p1History[0].total_individual_break_reached,
          total_individual_favori_reached: !!p1History[0].total_individual_break_reached
      } : { role: 'tocard' as const, result: 'loss' as const, total_break_target_reached: false, total_individual_tocard_reached: false, total_individual_favori_reached: false };

      const lastMatch2 = p2History && p2History[0] ? {
          role: p2History[0].role as any,
          result: p2History[0].result as any,
          total_break_target_reached: !!p2History[0].total_break_target_reached,
          total_individual_tocard_reached: !!p2History[0].total_individual_break_reached,
          total_individual_favori_reached: !!p2History[0].total_individual_break_reached
      } : { role: 'tocard' as const, result: 'loss' as const, total_break_target_reached: false, total_individual_tocard_reached: false, total_individual_favori_reached: false };

      const matchData = {
          player1: {
              name: m.player1.name,
              ranking: m.player1.ranking,
              is_seeded: m.player1.is_seeded,
              last_match: lastMatch1
          },
          player2: {
              name: m.player2.name,
              ranking: m.player2.ranking,
              is_seeded: m.player2.is_seeded,
              last_match: lastMatch2
          },
          odds_home: Number(m.odds_home),
          odds_away: Number(m.odds_away)
      };

      const resH1 = validateH1(matchData);
      const resH2 = validateH2(matchData);
      const resH3 = validateH3(matchData);

      if (resH1.isValid) validH1++;
      if (resH2.isValid) validH2++;
      if (resH3.isValid) {
          validH3++;
          console.log(`[H3 MATCH MATCHED] Match ID ${m.id}: ${m.player1.name} (Rank ${m.player1.ranking}, Seeded: ${m.player1.is_seeded}) VS ${m.player2.name} (Rank ${m.player2.ranking}, Seeded: ${m.player2.is_seeded})`);
          console.log(`Reason: ${resH3.reason}`);
      }
  }
  
  console.log(`Summary of matches satisfying rules in memory:`);
  console.log(`H1: ${validH1}`);
  console.log(`H2: ${validH2}`);
  console.log(`H3: ${validH3}`);
  
  // 2. Fetch predictions
  const { data: predictions } = await supabase.from('predictions').select('logic_type');
  const counts = (predictions || []).reduce((acc: any, curr: any) => {
      acc[curr.logic_type] = (acc[curr.logic_type] || 0) + 1;
      return acc;
  }, {});
  console.log("Predictions in DB:", counts);
}
run();
