import time
import json
import sys
from playwright.sync_api import sync_playwright
from config import get_random_user_agent, CRAWL_DELAY, MAX_RETRIES

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def scrape_flashscore_player(player_name):
    """
    Extrait l'historique et les statistiques d'un joueur.
    """
    player_data = {
        "name": player_name,
        "ranking": 100, # À extraire
        "is_seeded": False, # À extraire ou définir via ATP
        "history": [
            {
                "role": "tocard",
                "result": "win",
                "total_break_target_reached": True,
                "total_individual_break_reached": True,
                "match_date": "2026-06-20T10:00:00Z"
            }
        ]
    }
    return player_data

if __name__ == "__main__":
    import sys
    player = "Novak Djokovic"
    if len(sys.argv) > 1:
        player = sys.argv[1]
    data = scrape_flashscore_player(player)
    print(json.dumps(data, indent=2))
