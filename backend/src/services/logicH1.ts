export interface MatchData {
    player1: PlayerData;
    player2: PlayerData;
    odds_home: number;
    odds_away: number;
}

export interface PlayerData {
    name: string;
    ranking: number;
    is_seeded: boolean;
    last_match: {
        role: 'tocard' | 'favori';
        result: 'win' | 'loss';
        total_break_target_reached: boolean;
        total_individual_tocard_reached: boolean;
        total_individual_favori_reached: boolean;
    };
}

export function validateH1(match: MatchData): { isValid: boolean; reason: string } {
    const { player1, player2 } = match;

    // Aucun des 2 n'est tête de série
    if (player1.is_seeded || player2.is_seeded) {
        return { isValid: false, reason: "Au moins l'un des joueurs est tête de série." };
    }

    // Les 2 joueurs doivent avoir été TOCARD dans leurs derniers matchs
    if (player1.last_match.role !== 'tocard' || player2.last_match.role !== 'tocard') {
        return { isValid: false, reason: "Les deux joueurs n'étaient pas des tocards lors de leur dernier match." };
    }

    // Conditions sur les breaks pour player 1
    if (!player1.last_match.total_break_target_reached ||
        !player1.last_match.total_individual_tocard_reached ||
        !player1.last_match.total_individual_favori_reached) {
        return { isValid: false, reason: "Les conditions de break n'ont pas été atteintes pour le joueur 1 dans son dernier match." };
    }

    // Conditions sur les breaks pour player 2
    if (!player2.last_match.total_break_target_reached ||
        !player2.last_match.total_individual_tocard_reached ||
        !player2.last_match.total_individual_favori_reached) {
        return { isValid: false, reason: "Les conditions de break n'ont pas été atteintes pour le joueur 2 dans son dernier match." };
    }

    return { isValid: true, reason: "Conditions H1 remplies avec succès." };
}
