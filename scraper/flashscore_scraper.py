import time
import json
from playwright.sync_api import sync_playwright
from config import get_random_user_agent, CRAWL_DELAY, MAX_RETRIES

def scrape_flashscore_player(player_name):
    """
    Extrait l'historique et les statistiques d'un joueur.
    """
    player_data = {
        "name": player_name,
        "ranking": 100, # À extraire
        "is_seeded": False, # À extraire ou définir via ATP
        "history": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=get_random_user_agent()
        )
        page = context.new_page()
        
        # Flashscore a une recherche qu'on pourrait utiliser, ou construire l'URL
        try:
            # Note: Ceci est un squelette car Flashscore obfusque fortement ses IDs
            page.goto("https://www.flashscore.fr/tennis/", timeout=60000)
            time.sleep(CRAWL_DELAY)
            
            # TODO: Implémenter la navigation vers la page du joueur
            # et l'extraction des derniers matchs (résultat, breaks)
            
            # Mock de l'historique pour le développement
            player_data["history"].append({
                "role": "tocard",
                "result": "win",
                "total_break_target_reached": True,
                "total_individual_break_reached": True,
                "match_date": "2026-06-20T10:00:00Z"
            })
            
        except Exception as e:
            print(f"Erreur sur flashscore pour {player_name}: {e}")
            
        browser.close()
        
    return player_data

if __name__ == "__main__":
    import sys
    player = "Novak Djokovic"
    if len(sys.argv) > 1:
        player = sys.argv[1]
    data = scrape_flashscore_player(player)
    print(json.dumps(data, indent=2))
