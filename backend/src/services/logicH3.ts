import { MatchData } from './logicH1';

export function validateH3(match: MatchData): { isValid: boolean; reason: string } {
    const { player1, player2 } = match;

    // Déterminer le joueur le mieux classé (le plus petit nombre)
    const bestRankedPlayer = player1.ranking < player2.ranking ? player1 : player2;
    const worstRankedPlayer = player1.ranking > player2.ranking ? player1 : player2;

    // Joueur le mieux classé doit être tête de série
    if (!bestRankedPlayer.is_seeded) {
        return { isValid: false, reason: "Le joueur le mieux classé n'est pas tête de série." };
    }

    // Il affronte un joueur MAL classé comparé à lui (Différence ≥ 50 places)
    // On ignore le classement 0 si la donnée manque
    if (bestRankedPlayer.ranking === 0 || worstRankedPlayer.ranking === 0) {
         return { isValid: false, reason: "Classement manquant pour évaluer la différence." };
    }

    const rankDifference = worstRankedPlayer.ranking - bestRankedPlayer.ranking;
    
    if (rankDifference < 50) {
        return { isValid: false, reason: `La différence de classement est de ${rankDifference}, elle doit être ≥ 50.` };
    }

    return { isValid: true, reason: "Conditions H3 remplies avec succès." };
}
