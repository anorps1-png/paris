import express from 'express';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import path from 'path';
import { validateH1, MatchData } from './services/logicH1';
import { validateH2 } from './services/logicH2';
import { validateH3 } from './services/logicH3';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Initialisation de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

// Helper pour exécuter un script Python dans le venv et parser sa sortie JSON
function runPythonScript(scriptName: string, args: string[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        const scraperDir = path.resolve(__dirname, '../../scraper');
        const pythonExe = path.join(scraperDir, 'venv', 'Scripts', 'python.exe');
        const scriptPath = path.join(scraperDir, scriptName);
        
        const escapedArgs = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
        const command = `"${pythonExe}" -u "${scriptPath}" ${escapedArgs}`;
        
        console.log(`[Python] Exécution : ${command}`);
        
        exec(command, { cwd: scraperDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Python] Erreur script ${scriptName}:`, error);
                console.error(`[Python] Stderr:`, stderr);
                return reject(error);
            }
            
            try {
                const cleanedStdout = stdout.trim();
                const jsonStartIndex = cleanedStdout.indexOf('[');
                const jsonObjectStartIndex = cleanedStdout.indexOf('{');
                
                let jsonString = cleanedStdout;
                if (jsonStartIndex !== -1 && (jsonObjectStartIndex === -1 || jsonStartIndex < jsonObjectStartIndex)) {
                    jsonString = cleanedStdout.substring(jsonStartIndex);
                } else if (jsonObjectStartIndex !== -1) {
                    jsonString = cleanedStdout.substring(jsonObjectStartIndex);
                }
                
                const data = JSON.parse(jsonString);
                resolve(data);
            } catch (parseError) {
                console.error(`[Python] Erreur parsing JSON pour ${scriptName}. Sortie brute : ${stdout}`);
                reject(parseError);
            }
        });
    });
}

// Fonction globale pour récupérer et analyser les matchs du jour
async function scrapeAndAnalyzeToday() {
    console.log("=== Démarrage du scraping et de l'analyse du jour ===");
    try {
        // 1. Scraping des matchs du jour via 1xbet
        const matchesList = await runPythonScript('1xbet_scraper.py');
        console.log(`[Scraper] ${matchesList.length} matchs récupérés depuis 1xbet.`);
        
        for (const match of matchesList) {
            console.log(`[Scraper] Traitement du match : ${match.player1} VS ${match.player2}`);
            
            // 2. Scraping des statistiques Flashscore pour les deux joueurs
            let p1Data, p2Data;
            try {
                p1Data = await runPythonScript('flashscore_scraper.py', [match.player1]);
            } catch (err) {
                console.error(`[Scraper] Erreur Flashscore pour ${match.player1}:`, err);
                p1Data = { name: match.player1, ranking: 100, is_seeded: false, history: [] };
            }
            
            try {
                p2Data = await runPythonScript('flashscore_scraper.py', [match.player2]);
            } catch (err) {
                console.error(`[Scraper] Erreur Flashscore pour ${match.player2}:`, err);
                p2Data = { name: match.player2, ranking: 100, is_seeded: false, history: [] };
            }
            
            // 3. Upsert des joueurs dans la table `players`
            const { data: p1Db, error: p1Err } = await supabase
                .from('players')
                .upsert({ name: p1Data.name, ranking: p1Data.ranking, is_seeded: p1Data.is_seeded }, { onConflict: 'name' })
                .select('id')
                .single();
                
            const { data: p2Db, error: p2Err } = await supabase
                .from('players')
                .upsert({ name: p2Data.name, ranking: p2Data.ranking, is_seeded: p2Data.is_seeded }, { onConflict: 'name' })
                .select('id')
                .single();
                
            if (p1Err || p2Err || !p1Db || !p2Db) {
                console.error("[Database] Erreur d'upsert des joueurs :", p1Err || p2Err);
                continue;
            }
            
            const player1Id = p1Db.id;
            const player2Id = p2Db.id;
            
            // 4. Insertion de l'historique des matchs pour le joueur 1
            if (p1Data.history && p1Data.history.length > 0) {
                await supabase.from('player_match_history').delete().eq('player_id', player1Id);
                for (const hist of p1Data.history) {
                    await supabase.from('player_match_history').insert({
                        player_id: player1Id,
                        role: hist.role,
                        result: hist.result,
                        total_break_target_reached: hist.total_break_target_reached,
                        total_individual_break_reached: hist.total_individual_break_reached,
                        match_date: hist.match_date
                    });
                }
            }
            
            // 5. Insertion de l'historique des matchs pour le joueur 2
            if (p2Data.history && p2Data.history.length > 0) {
                await supabase.from('player_match_history').delete().eq('player_id', player2Id);
                for (const hist of p2Data.history) {
                    await supabase.from('player_match_history').insert({
                        player_id: player2Id,
                        role: hist.role,
                        result: hist.result,
                        total_break_target_reached: hist.total_break_target_reached,
                        total_individual_break_reached: hist.total_individual_break_reached,
                        match_date: hist.match_date
                    });
                }
            }
            
            // 6. Insertion du match du jour
            const { data: existing } = await supabase
                .from('matches')
                .select('id')
                .eq('player1_id', player1Id)
                .eq('player2_id', player2Id)
                .eq('match_date', match.match_date)
                .limit(1);
                
            let matchId;
            if (existing && existing.length > 0 && existing[0]) {
                matchId = existing[0].id;
                // Mise à jour des cotes
                await supabase
                    .from('matches')
                    .update({ odds_home: match.odds_home, odds_away: match.odds_away })
                    .eq('id', matchId);
            } else {
                const { data: insertedMatch, error: matchErr } = await supabase
                    .from('matches')
                    .insert({
                        tournament: match.tournament,
                        surface: match.surface,
                        match_date: match.match_date,
                        player1_id: player1Id,
                        player2_id: player2Id,
                        odds_home: match.odds_home,
                        odds_away: match.odds_away
                    })
                    .select('id')
                    .single();
                    
                if (matchErr || !insertedMatch) {
                    console.error("[Database] Erreur insertion match :", matchErr);
                    continue;
                }
                matchId = insertedMatch.id;
            }
        }
        
        // 7. Lancement de l'analyse logique H1/H2/H3
        await runAnalysis();
        console.log("=== Scraping et analyse du jour terminés avec succès ===");
    } catch (err) {
        console.error("[Scraper] Erreur lors du flux de scraping/analyse :", err);
    }
}

// Planification du scraping quotidien à 6h00
cron.schedule('0 6 * * *', async () => {
    console.log('Exécution du cron job de scraping quotidien à 6h00');
    await scrapeAndAnalyzeToday();
});

// Fonction pour récupérer les matchs du jour et appliquer H1/H2/H3
async function runAnalysis() {
    console.log("Démarrage de l'analyse des matchs...");
    
    // Récupération des données fraîches depuis la BDD (insérées par le scraper)
    const { data: matches, error } = await supabase
        .from('matches')
        .select(`
            *,
            player1:player1_id(*),
            player2:player2_id(*)
        `);
        
    if (error || !matches) {
        console.error("Erreur récupération des matchs:", error);
        return;
    }

    for (const matchRow of matches) {
        // Hydratation de la structure attendue en récupérant le dernier match de l'historique
        let lastMatch1 = {
            role: 'tocard' as const,
            result: 'loss' as const,
            total_break_target_reached: false,
            total_individual_tocard_reached: false,
            total_individual_favori_reached: false
        };

        const { data: p1History } = await supabase
            .from('player_match_history')
            .select('*')
            .eq('player_id', matchRow.player1_id)
            .order('match_date', { ascending: false })
            .limit(1);

        if (p1History && p1History.length > 0 && p1History[0]) {
            lastMatch1 = {
                role: (p1History[0].role === 'favori' ? 'favori' : 'tocard') as any,
                result: (p1History[0].result === 'win' ? 'win' : 'loss') as any,
                total_break_target_reached: !!p1History[0].total_break_target_reached,
                total_individual_tocard_reached: !!p1History[0].total_individual_break_reached,
                total_individual_favori_reached: !!p1History[0].total_individual_break_reached
            };
        }

        let lastMatch2 = {
            role: 'tocard' as const,
            result: 'loss' as const,
            total_break_target_reached: false,
            total_individual_tocard_reached: false,
            total_individual_favori_reached: false
        };

        const { data: p2History } = await supabase
            .from('player_match_history')
            .select('*')
            .eq('player_id', matchRow.player2_id)
            .order('match_date', { ascending: false })
            .limit(1);

        if (p2History && p2History.length > 0 && p2History[0]) {
            lastMatch2 = {
                role: (p2History[0].role === 'favori' ? 'favori' : 'tocard') as any,
                result: (p2History[0].result === 'win' ? 'win' : 'loss') as any,
                total_break_target_reached: !!p2History[0].total_break_target_reached,
                total_individual_tocard_reached: !!p2History[0].total_individual_break_reached,
                total_individual_favori_reached: !!p2History[0].total_individual_break_reached
            };
        }

        const matchData: MatchData = {
            player1: {
                name: matchRow.player1.name,
                ranking: matchRow.player1.ranking,
                is_seeded: matchRow.player1.is_seeded,
                last_match: lastMatch1
            },
            player2: {
                name: matchRow.player2.name,
                ranking: matchRow.player2.ranking,
                is_seeded: matchRow.player2.is_seeded,
                last_match: lastMatch2
            },
            odds_home: Number(matchRow.odds_home),
            odds_away: Number(matchRow.odds_away)
        };

        // Application des logiques
        const resH1 = validateH1(matchData);
        if (resH1.isValid) {
            await insertPrediction(matchRow.id, 'H1', resH1.reason);
        }

        const resH2 = validateH2(matchData);
        if (resH2.isValid) {
            await insertPrediction(matchRow.id, 'H2', resH2.reason);
        }

        const resH3 = validateH3(matchData);
        if (resH3.isValid) {
            await insertPrediction(matchRow.id, 'H3', resH3.reason);
        }
    }
}

async function insertPrediction(matchId: number, logic: string, details: string) {
    // Vérifier si la prédiction existe déjà
    const { data: existing } = await supabase
        .from('predictions')
        .select('id')
        .eq('match_id', matchId)
        .eq('logic_type', logic)
        .limit(1);

    if (existing && existing.length > 0) {
        console.log(`Prédiction ${logic} déjà existante pour le match ${matchId}`);
        return;
    }

    const { error } = await supabase.from('predictions').insert([
        { match_id: matchId, logic_type: logic, is_valid: true, details: { reason: details } }
    ]);
    if (error) {
        console.error(`Erreur d'insertion prédiction ${logic} pour match ${matchId}:`, error);
    } else {
        console.log(`✅ Prédiction ${logic} enregistrée pour le match ${matchId}`);
    }
}

// Endpoint pour déclencher manuellement l'analyse
app.post('/api/trigger-analysis', async (req, res) => {
    await scrapeAndAnalyzeToday();
    res.json({ message: "Scraping et Analyse déclenchés avec succès." });
});

// Endpoint pour récupérer les analyses du jour (pour le dashboard)
app.get('/api/predictions', async (req, res) => {
    // Vérifier s'il y a déjà des prédictions pour aujourd'hui
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: todayPredictions, error: checkError } = await supabase
        .from('predictions')
        .select('id')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());

    // S'il n'y a pas de prédictions, on lance le scraping & analyse automatique
    if (checkError || !todayPredictions || todayPredictions.length === 0) {
        console.log("Aucune prédiction pour aujourd'hui. Lancement automatique du scraping...");
        await scrapeAndAnalyzeToday();
    }

    // Récupérer et renvoyer toutes les prédictions
    const { data, error } = await supabase
        .from('predictions')
        .select('*, matches(*, player1:player1_id(*), player2:player2_id(*))')
        .order('created_at', { ascending: false });
        
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

app.listen(port, () => {
    console.log(`TennisBetAI Backend en cours d'exécution sur le port ${port}`);
});
