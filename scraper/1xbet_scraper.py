import time
import json
import sys
from playwright.sync_api import sync_playwright
from config import get_random_user_agent, CRAWL_DELAY, MAX_RETRIES

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def log(msg):
    print(msg, file=sys.stderr, flush=True)


def scrape_1xbet_tennis():
    log("Démarrage du scraping 1xbet...")
    matches_data = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        context = browser.new_context()
        page = context.new_page()

        retries = 0
        success = False
        
        while retries < MAX_RETRIES and not success:
            try:
                # L'URL exacte dépend de la région et des redirections 1xbet
                page.goto("https://1xbet.com/fr/line/tennis", timeout=60000)
                
                # Attendre le popup d'âge ou directement l'élément dashboard-game
                try:
                    page.wait_for_selector(".notification-age-restriction button", state="attached", timeout=25000)
                    page.evaluate("() => document.querySelector('.notification-age-restriction button').click()")
                    log("Popup limite d'âge fermé avec succès.")
                    time.sleep(10) # attente de stabilisation après fermeture
                except Exception as e:
                    log("Pas de popup d'âge à fermer ou déjà fermé.")
                
                # Attendre le chargement des matchs dans le DOM (attached)
                page.wait_for_selector(".dashboard-game", state="attached", timeout=25000)
                
                # Collect matches step-by-step during scrolling to handle virtualized list (lazy rendering)
                log("Défilement de la page et collecte des cotes...")
                matches_dict = {}

                def extract_visible():
                    return page.evaluate("""() => {
                        const matches = [];
                        const gameElements = document.querySelectorAll('.dashboard-game');
                        gameElements.forEach(game => {
                            try {
                                const teamElements = game.querySelectorAll('.dashboard-game-team-info__name');
                                if (teamElements.length < 2) return;
                                const player1 = teamElements[0].innerText.trim();
                                const player2 = teamElements[1].innerText.trim();
                                
                                let odds_home = 0.0;
                                let odds_away = 0.0;
                                const marketElts = game.querySelectorAll('.dashboard-markets__market');
                                marketElts.forEach(m => {
                                    const btn = m.querySelector('button');
                                    const valElt = m.querySelector('.ui-market__value');
                                    if (btn && valElt) {
                                        const label = btn.getAttribute('aria-label');
                                        const val = parseFloat(valElt.innerText.trim());
                                        if (label === 'V1' && !isNaN(val)) odds_home = val;
                                        if (label === 'V2' && !isNaN(val)) odds_away = val;
                                    }
                                });
                                
                                if (odds_home === 0 || odds_away === 0) return; // ignorer si pas de cotes
                                
                                let tournament = "Tennis Tournament";
                                const champBlock = game.closest('.dashboard-champ') || game.closest('[class*="champ"]') || game.closest('[class*="body"]');
                                if (champBlock) {
                                    const headerElt = champBlock.querySelector('.dashboard-champ-name') || champBlock.querySelector('[class*="header"]') || champBlock.querySelector('[class*="title"]');
                                    if (headerElt) {
                                        tournament = headerElt.innerText.split('\\n')[0].trim();
                                    }
                                }
                                
                                let surface = "Hard";
                                const lowerTourn = tournament.toLowerCase();
                                if (lowerTourn.includes('terre battue') || lowerTourn.includes('clay') || lowerTourn.includes('terre')) {
                                    surface = "Clay";
                                } else if (lowerTourn.includes('gazon') || lowerTourn.includes('grass')) {
                                    surface = "Grass";
                                } else if (lowerTourn.includes('dur') || lowerTourn.includes('hard')) {
                                    surface = "Hard";
                                }
                                
                                const dateElt = game.querySelector('.dashboard-game-info__date');
                                const timeElt = game.querySelector('.dashboard-game-info__time');
                                let match_date = new Date().toISOString();
                                if (dateElt && timeElt) {
                                    const dateStr = dateElt.innerText.trim();
                                    const timeStr = timeElt.innerText.trim();
                                    const currentYear = new Date().getFullYear();
                                    const [day, month] = dateStr.split('/');
                                    const [hour, minute] = timeStr.split(':');
                                    const d = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                                    match_date = d.toISOString();
                                }
                                
                                matches.push({
                                    player1,
                                    player2,
                                    odds_home,
                                    odds_away,
                                    tournament,
                                    surface,
                                    match_date
                                });
                            } catch (e) {
                                // Ignorer
                            }
                        });
                        return matches;
                    }""")

                # 1. Collect first screen
                try:
                    page.wait_for_selector(".dashboard-markets", state="attached", timeout=15000)
                except Exception:
                    pass
                for m in extract_visible():
                    key = f"{m['player1']} VS {m['player2']}"
                    matches_dict[key] = m

                # 2. Scroll and collect
                for i in range(15):
                    page.evaluate("window.scrollBy(0, 1200)")
                    time.sleep(1.0)
                    for m in extract_visible():
                        key = f"{m['player1']} VS {m['player2']}"
                        matches_dict[key] = m

                matches_data = list(matches_dict.values())
                log(f"[Scraper] Extraction réussie. {len(matches_data)} matchs uniques collectés.")
                
                log(f"[Scraper] Extraction réussie. {len(matches_data)} matchs avec cotes récupérés.")
                success = True
            except Exception as e:
                retries += 1
                log(f"Echec du chargement 1xbet (tentative {retries}/{MAX_RETRIES}) : {e}")
                try:
                    log(f"Titre de la page lors de l'echec: {page.title()}")
                    log(f"URL de la page lors de l'echec: {page.url}")
                    page.screenshot(path=f"screenshot_failure_{retries}.png")
                    log(f"Capture d'ecran sauvegardee: screenshot_failure_{retries}.png")
                except Exception as screenshot_err:
                    log(f"Impossible de prendre une capture d'ecran: {screenshot_err}")
                time.sleep(CRAWL_DELAY * 2)

        browser.close()
    
    return matches_data

if __name__ == "__main__":
    data = scrape_1xbet_tennis()
    print(json.dumps(data, indent=2))
