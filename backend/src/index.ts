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

// Lock to prevent multiple scraping operations from running concurrently
let isScrapingAndAnalyzing = false;

app.use(express.json());

// Middleware CORS pour autoriser le frontend à faire des requêtes API
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

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

function isTargetTournament(tournament: string): boolean {
    const name = tournament.toLowerCase();
    
    // Exclude Challenger, ITF, exhibition, etc.
    if (name.includes('challenger') || name.includes('itf') || name.includes('exhibition') || name.includes('utr')) {
        return false;
    }
    
    // Explicit 1000 or 500 or Grand Slam markers
    if (name.includes('500') || name.includes('1000') || name.includes('grand chelem') || name.includes('grand slam')) {
        return true;
    }
    
    // Grand Slam names
    const slams = ['wimbledon', 'roland garros', 'roland-garros', 'us open', 'australian open', 'australie'];
    if (slams.some(slam => name.includes(slam))) {
        return true;
    }
    
    // ATP/WTA 1000 names
    const m1000 = [
        'indian wells', 'miami', 'monte carlo', 'monte-carlo', 'madrid', 'rome', 
        'toronto', 'montreal', 'cincinnati', 'shanghai', 'bercy', 'wuhan'
    ];
    if (m1000.some(t => name.includes(t))) {
        return true;
    }
    
    // ATP/WTA 500 names
    const m500 = [
        'rotterdam', 'rio', 'acapulco', 'dubai', 'barcelone', 'barcelona', 'halle', 
        'queen\'s', 'queens', 'washington', 'tokyo', 'vienne', 'vienna', 'bale', 
        'basel', 'astana', 'abu dhabi', 'linz', 'strasbourg', 'san diego', 
        'bad homburg', 'berlin', 'ningbo', 'monterrey', 'seoul'
    ];
    if (m500.some(t => name.includes(t))) {
        return true;
    }
    
    // Mixed tier tournaments (500 for WTA, 250 for ATP)
    if (name.includes('eastbourne') || name.includes('adelaide') || name.includes('stuttgart')) {
        if (name.includes('wta')) {
            return true;
        }
    }
    
    return false;
}

// Fonction globale pour récupérer et analyser les matchs (optionnellement filtrés par date)
async function scrapeAndAnalyze(targetDateStr?: string) {
    console.log(`=== Démarrage du scraping et de l'analyse ${targetDateStr ? 'pour ' + targetDateStr : 'du jour'} ===`);
    try {
        // 1. Scraping des matchs via 1xbet (retourne tous les matchs visibles, y compris futurs)
        const matchesList = await runPythonScript('1xbet_scraper.py');
        console.log(`[Scraper] ${matchesList.length} matchs récupérés depuis 1xbet.`);
        
        for (const match of matchesList) {
            if (!isTargetTournament(match.tournament)) {
                console.log(`[Scraper] Match ignoré (hors ATP/WTA 500, 1000, Grand Chelem) : ${match.player1} VS ${match.player2} (${match.tournament})`);
                continue;
            }
            
            // Si une date cible est spécifiée, ne traiter que les matchs de ce jour
            if (targetDateStr) {
                const matchDay = match.match_date ? match.match_date.substring(0, 10) : '';
                if (matchDay !== targetDateStr) {
                    console.log(`[Scraper] Match ignoré (date ${matchDay} != ${targetDateStr}) : ${match.player1} VS ${match.player2}`);
                    continue;
                }
            }
            
            console.log(`[Scraper] Traitement du match : ${match.player1} VS ${match.player2} (${match.match_date})`);
            
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
            
            // 6. Insertion/mise à jour du match
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
        
        // 7. Lancement de l'analyse logique H1/H2/H3 (filtrée si date fournie)
        await runAnalysis(targetDateStr);
        console.log(`=== Scraping et analyse terminés avec succès ${targetDateStr ? 'pour ' + targetDateStr : ''} ===`);
    } catch (err) {
        console.error("[Scraper] Erreur lors du flux de scraping/analyse :", err);
    }
}

// Alias pour compatibilité avec le cron
const scrapeAndAnalyzeToday = () => scrapeAndAnalyze();

// Planification du scraping quotidien à 6h00
cron.schedule('0 6 * * *', async () => {
    console.log('Exécution du cron job de scraping quotidien à 6h00');
    await scrapeAndAnalyze();
});

// Fonction pour récupérer les matchs et appliquer H1/H2/H3 (optionnellement filtrée par date)
async function runAnalysis(targetDateStr?: string) {
    console.log(`Démarrage de l'analyse des matchs${targetDateStr ? ' pour ' + targetDateStr : ''}...`);
    
    // Récupération des données fraîches depuis la BDD (insérées par le scraper)
    let query = supabase
        .from('matches')
        .select(`
            *,
            player1:player1_id(*),
            player2:player2_id(*)
        `);
    
    // Filtrer par date si spécifiée
    if (targetDateStr) {
        const startISO = `${targetDateStr}T00:00:00.000Z`;
        const endISO = `${targetDateStr}T23:59:59.999Z`;
        query = query.gte('match_date', startISO).lte('match_date', endISO);
    }
    
    const { data: matches, error } = await query;
        
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

// Endpoint pour déclencher manuellement l'analyse (avec date optionnelle)
app.post('/api/trigger-analysis', async (req, res) => {
    if (isScrapingAndAnalyzing) {
        return res.status(409).json({ message: "Scraping déjà en cours.", isScraping: true });
    }
    isScrapingAndAnalyzing = true;
    const targetDate: string | undefined = req.body?.date || undefined;
    console.log(`[API] Déclenchement manuel du scraping${targetDate ? ' pour la date ' + targetDate : ' (tous les matchs visibles)'}`);
    scrapeAndAnalyze(targetDate).then(() => {
        isScrapingAndAnalyzing = false;
    }).catch((err) => {
        console.error("Erreur lors du scraping manuel :", err);
        isScrapingAndAnalyzing = false;
    });
    res.json({ message: "Scraping et Analyse déclenchés en arrière-plan avec succès.", date: targetDate || null });
});

// Endpoint pour récupérer le statut du scraping
app.get('/api/scrape-status', (req, res) => {
    res.json({ isScraping: isScrapingAndAnalyzing });
});

// Endpoint pour récupérer les analyses du jour (pour le dashboard)
app.get('/api/predictions', async (req, res) => {
    try {
        const dateParam = req.query.date as string;
        
        let targetDateStr = dateParam;
        if (!targetDateStr || targetDateStr === 'undefined') {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            targetDateStr = `${yyyy}-${mm}-${dd}`;
        }

        let targetStart = new Date(`${targetDateStr}T00:00:00Z`);
        let targetEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

        // S'assurer que les dates sont valides, sinon se rabattre sur aujourd'hui
        if (isNaN(targetStart.getTime()) || isNaN(targetEnd.getTime())) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            targetDateStr = `${yyyy}-${mm}-${dd}`;
            targetStart = new Date(`${targetDateStr}T00:00:00Z`);
            targetEnd = new Date(`${targetDateStr}T23:59:59.999Z`);
        }

        // Obtenir la date d'aujourd'hui au format YYYY-MM-DD
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        // Note: Le scraping automatique a été retiré - l'utilisateur déclenche manuellement via le bouton

        // Récupérer et renvoyer les prédictions filtrées par la date du match
        const { data, error } = await supabase
            .from('predictions')
            .select('*, matches!inner(*, player1:player1_id(*), player2:player2_id(*))')
            .gte('matches.match_date', targetStart.toISOString())
            .lte('matches.match_date', targetEnd.toISOString())
            .order('created_at', { ascending: false });
            
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (err: any) {
        console.error("Erreur dans /api/predictions :", err);
        try {
            require('fs').writeFileSync(require('path').join(__dirname, '../err_log.txt'), err.stack || err.message || String(err));
        } catch (fsErr) {}
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`TennisBetAI Backend en cours d'exécution sur le port ${port}`);
});
