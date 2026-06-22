import { MatchData } from './logicH1';

export function validateH2(match: MatchData): { isValid: boolean; reason: string } {
    const { player1, player2 } = match;

    // Les 2 sont têtes de série
    if (!player1.is_seeded || !player2.is_seeded) {
        return { isValid: false, reason: "Les deux joueurs doivent être têtes de série." };
    }

    // Les 2 joueurs doivent avoir été FAVORIS dans leurs derniers matchs
    if (player1.last_match.role !== 'favori' || player2.last_match.role !== 'favori') {
        return { isValid: false, reason: "Les deux joueurs n'étaient pas favoris lors de leur dernier match." };
    }

    // Conditions sur les breaks pour player 1 (NON ATTEINT)
    if (player1.last_match.total_break_target_reached ||
        player1.last_match.total_individual_tocard_reached ||
        player1.last_match.total_individual_favori_reached) {
        return { isValid: false, reason: "Les conditions de break ont été atteintes pour le joueur 1 (devraient être non atteintes)." };
    }

    // Conditions sur les breaks pour player 2 (NON ATTEINT)
    if (player2.last_match.total_break_target_reached ||
        player2.last_match.total_individual_tocard_reached ||
        player2.last_match.total_individual_favori_reached) {
        return { isValid: false, reason: "Les conditions de break ont été atteintes pour le joueur 2 (devraient être non atteintes)." };
    }

    return { isValid: true, reason: "Conditions H2 remplies avec succès." };
}
