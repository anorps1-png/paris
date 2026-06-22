import time
import json
from playwright.sync_api import sync_playwright
from config import get_random_user_agent, CRAWL_DELAY, MAX_RETRIES

def scrape_1xbet_tennis():
    print("Démarrage du scraping 1xbet...")
    matches_data = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=get_random_user_agent(),
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()

        retries = 0
        success = False
        
        while retries < MAX_RETRIES and not success:
            try:
                # L'URL exacte dépend de la région et des redirections 1xbet
                page.goto("https://1xbet.com/fr/line/tennis", timeout=60000)
                page.wait_for_selector(".c-events__item", timeout=15000)
                
                time.sleep(CRAWL_DELAY)
                
                # Exemple de sélection (les sélecteurs exacts nécessitent une analyse DOM en temps réel)
                events = page.query_selector_all(".c-events__item")
                
                for event in events:
                    try:
                        teams = event.query_selector_all(".c-events__team")
                        if len(teams) < 2:
                            continue
                        
                        player1 = teams[0].inner_text().strip()
                        player2 = teams[1].inner_text().strip()
                        
                        odds_elements = event.query_selector_all(".c-bets__bet")
                        if len(odds_elements) >= 2:
                            odds_home = float(odds_elements[0].inner_text().strip() or 0)
                            odds_away = float(odds_elements[1].inner_text().strip() or 0)
                        else:
                            continue

                        # Mock de surface et tournoi pour l'instant (à extraire du header)
                        tournament = "ATP Mock"
                        surface = "Hard"
                        match_date = "2026-06-22T14:00:00Z"

                        matches_data.append({
                            "player1": player1,
                            "player2": player2,
                            "odds_home": odds_home,
                            "odds_away": odds_away,
                            "tournament": tournament,
                            "surface": surface,
                            "match_date": match_date
                        })
                    except Exception as e:
                        print(f"Erreur extraction match: {e}")
                
                success = True
            except Exception as e:
                retries += 1
                print(f"Echec du chargement 1xbet (tentative {retries}/{MAX_RETRIES}) : {e}")
                time.sleep(CRAWL_DELAY * 2)

        browser.close()
    
    return matches_data

if __name__ == "__main__":
    data = scrape_1xbet_tennis()
    print(json.dumps(data, indent=2))
